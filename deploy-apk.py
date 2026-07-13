"""
日耕 APK 一键部署脚本。

每次发布新版本只需要:
  1. 修改 VERSION / VERSION_CODE / RELEASE_NOTES
  2. python deploy-apk.py

自动完成: 构建前端 → 同步Android → 构建APK → 上传服务器 → 更新后端 → 重启
"""
import os, sys, json, re, shutil, subprocess, time, hashlib

# Force UTF-8 encoding for subprocess output (Windows GBK issue)
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', buffering=1)

# ═══════════════════ 修改这里 ═══════════════════
VERSION = "0.9.0"
VERSION_CODE = 9
RELEASE_NOTES = "v0.9: 智能记录实时转写(WebSocket PCM音频流+AudioContext采 集) + 录音音频保存播放 + 批量ASR转写完整音频 + 真实录音时长"
IS_CRITICAL = False
# ═══════════════════════════════════════════════

HOST = "47.96.187.229"
USER = "root"
SERVER_APK_PATH = "/opt/rigeng.app/mobile/dist/mobile/rigeng-latest.apk"
MOBILE_DIST_REMOTE = "/opt/rigeng.app/mobile/dist/mobile"
BACKEND_MAIN_REMOTE = "/opt/rigeng.app/backend/app/main.py"
VOICE_SERVICE_REMOTE = "/opt/rigeng.app/backend/app/services/voice_engine/service.py"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOBILE_DIR = os.path.join(BASE_DIR, "mobile", "frontend")
DIST_DIR = os.path.join(BASE_DIR, "mobile", "dist", "mobile")  # Vite outDir: ../dist/mobile
APK_SRC = os.path.join(MOBILE_DIR, "android", "app", "build", "outputs", "apk", "release", "app-release.apk")

def run_cmd(cmd, cwd=None, check=True):
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
    if check and result.returncode != 0:
        print(f"  ERROR: {result.stderr[-300:]}")
        result.check_returncode()
    return result.stdout.strip() if result.stdout else ""

def main():
    print("=" * 60)
    print(f"日耕 APK 部署 v{VERSION} (code={VERSION_CODE})")
    print("=" * 60)
    print(f"  Release Notes: {RELEASE_NOTES}")
    print(f"  Critical Update: {IS_CRITICAL}")
    print(f"  Min Version Code: {max(1, VERSION_CODE - 2)}")
    print(f"  APK URL: http://47.96.187.229/rigeng-latest.apk")
    print("=" * 60)

    # Step 1: Build mobile frontend
    print("\n[1/5] Building mobile frontend...")
    run_cmd("npm run build", cwd=MOBILE_DIR)

    # Step 2: Sync & build APK
    print("\n[2/5] Building APK...")
    run_cmd("npx cap sync android", cwd=MOBILE_DIR)
    android_dir = os.path.join(MOBILE_DIR, "android")

    # 自动同步 build.gradle 中的 versionCode / versionName（消除手动同步遗漏）
    gradle_path = os.path.join(android_dir, "app", "build.gradle")
    with open(gradle_path, 'r', encoding='utf-8') as f:
        gradle_content = f.read()
    gradle_content = re.sub(r'versionCode\s+\d+', f'versionCode {VERSION_CODE}', gradle_content)
    gradle_content = re.sub(r'versionName\s+"[^"]*"', f'versionName "{VERSION}"', gradle_content)
    with open(gradle_path, 'w', encoding='utf-8') as f:
        f.write(gradle_content)
    print(f"  ✓ build.gradle synced: versionCode={VERSION_CODE}, versionName={VERSION}")

    # Set JAVA_HOME for gradle
    env = os.environ.copy()
    env["JAVA_HOME"] = "C:/Program Files/Java/jdk-21.0.10"
    env["ANDROID_HOME"] = "C:/Android"
    env["ANDROID_SDK_ROOT"] = "C:/Android"
    subprocess.run(
        "bash gradlew assembleRelease",
        shell=True, cwd=android_dir, env=env, check=True,
        capture_output=True, text=True, encoding='utf-8', errors='replace',
    )

    if not os.path.exists(APK_SRC):
        print(f"ERROR: APK not found at {APK_SRC}")
        sys.exit(1)
    apk_size = os.path.getsize(APK_SRC)
    apk_sha256 = hashlib.sha256(open(APK_SRC, 'rb').read()).hexdigest()
    print(f"  APK built: {apk_size} bytes")
    print(f"  SHA256: {apk_sha256}")

    # Step 3: Upload to server via paramiko
    print("\n[3/5] Uploading to server...")
    sys.path.insert(0, os.path.join(BASE_DIR, 'scripts'))
    from rigeng_ssh import connect_ssh

    ssh = connect_ssh(HOST)
    sftp = ssh.open_sftp()

    # Upload dist files
    print("  Uploading mobile dist...")
    for root, dirs, files in os.walk(DIST_DIR):
        for fname in files:
            local_path = os.path.join(root, fname)
            rel_path = os.path.relpath(local_path, DIST_DIR).replace("\\", "/")
            remote_path = f"{MOBILE_DIST_REMOTE}/{rel_path}"
            remote_dir = os.path.dirname(remote_path)
            parts = remote_dir.strip("/").split("/")
            for i in range(1, len(parts) + 1):
                sub_path = "/" + "/".join(parts[:i])
                try: sftp.stat(sub_path)
                except: sftp.mkdir(sub_path)
            sftp.put(local_path, remote_path)

    # Upload APK as latest.apk (atomic: .tmp → mv 避免用户下载半截文件)
    print("  Uploading APK...")
    tmp_apk = SERVER_APK_PATH + ".tmp"
    # Clean up stale .tmp from any previously failed upload
    try: sftp.remove(tmp_apk)
    except: pass
    sftp.put(APK_SRC, tmp_apk)
    # 版本化副本（仅归档，无并发下载风险，可直接写入）
    ver_apk = f"/opt/rigeng.app/mobile/dist/mobile/rigeng-v{VERSION}.apk"
    sftp.put(APK_SRC, ver_apk)
    # 原子替换：同文件系统的 mv 是瞬时操作，消除竞态窗口
    ssh.exec_command(f"mv {tmp_apk} {SERVER_APK_PATH}")
    print(f"  APK → {SERVER_APK_PATH}")

    sftp.close()

    # Update version.json — unified format (BOTH backend + nginx static)
    print("  Updating version.json...")
    from datetime import datetime, timezone, timedelta
    tz = timezone(timedelta(hours=8))
    ver_data = {
        "apk_version": VERSION,
        "apk_version_code": VERSION_CODE,
        "apk_url": "http://47.96.187.229/rigeng-latest.apk",
        "sha256": apk_sha256,
        "h5_version": VERSION,
        "version": VERSION,  # alias for H5 polling compatibility
        "h5_build_time": datetime.now(tz).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "release_notes": RELEASE_NOTES,
        "is_critical": IS_CRITICAL,
        "force_update": IS_CRITICAL,
        "min_apk_version_code": max(1, VERSION_CODE - 2),  # 最近2个版本不强制
    }

    # 后端单一来源: backend/app/version.json（后续 backend 上传步骤会同步到服务器）
    backend_ver_path = os.path.join(BASE_DIR, "backend", "app", "version.json")
    with open(backend_ver_path, 'w', encoding='utf-8') as f:
        json.dump(ver_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Local backend: {backend_ver_path}")

    # 根目录 version.json（git  tracked，与后端保持一致）
    root_ver_path = os.path.join(BASE_DIR, "version.json")
    with open(root_ver_path, 'w', encoding='utf-8') as f:
        json.dump(ver_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Local root: {root_ver_path}")

    # nginx 静态文件: 远程写入（H5 浏览器直接 fetch /version.json）
    def write_remote_file(path, content):
        sftp = ssh.open_sftp()
        f = sftp.file(path, 'w')
        f.write(content)
        f.flush()
        f.close()
        sftp.close()

    write_remote_file(f"{MOBILE_DIST_REMOTE}/version.json", json.dumps(ver_data, ensure_ascii=False))
    print(f"  ✓ Remote: {MOBILE_DIST_REMOTE}/version.json")

    # Step 4: Update backend files & rebuild
    print("\n[4/5] Uploading backend files & rebuilding...")

    # Upload ALL backend Python source files (multi-model architecture changed many files)
    BACKEND_SRC = os.path.join(BASE_DIR, "backend", "app")
    BACKEND_REMOTE = "/opt/rigeng.app/backend/app"
    sftp = ssh.open_sftp()
    uploaded_count = 0
    for root, dirs, files in os.walk(BACKEND_SRC):
        # Skip __pycache__ and other artifacts
        dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git", ".pytest_cache", "node_modules")]
        for fname in files:
            if fname.endswith((".pyc", ".pyo", ".db")):
                continue
            local_path = os.path.join(root, fname)
            rel_path = os.path.relpath(local_path, BACKEND_SRC).replace("\\", "/")
            remote_path = f"{BACKEND_REMOTE}/{rel_path}"
            remote_dir = os.path.dirname(remote_path)
            parts = remote_dir.strip("/").split("/")
            for i in range(1, len(parts) + 1):
                sub_path = "/" + "/".join(parts[:i])
                try: sftp.stat(sub_path)
                except: sftp.mkdir(sub_path)
            sftp.put(local_path, remote_path)
            uploaded_count += 1
    sftp.close()
    print(f"  Uploaded {uploaded_count} backend files")

    # Also upload .env
    local_env = os.path.join(BASE_DIR, "backend", ".env")
    if os.path.exists(local_env):
        sftp = ssh.open_sftp()
        sftp.put(local_env, "/opt/rigeng.app/backend/.env")
        sftp.close()
        print("  .env uploaded")

    # Rebuild backend
    print("  Rebuilding backend...")
    stdin, stdout, stderr = ssh.exec_command(
        f"cd /opt/rigeng.app && docker compose up -d --build backend 2>&1",
        timeout=300
    )
    out = stdout.read().decode()
    for line in out.strip().split('\n')[-3:]:
        print(f"  {line}")

    # Step 5: Reload nginx & verify
    print("\n[5/5] Reloading nginx & verifying...")
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command("docker exec rigengapp-nginx-1 nginx -s reload 2>&1")
    print(f"  nginx: {stdout.read().decode().strip()}")

    # Verify
    stdin, stdout, stderr = ssh.exec_command(
        f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost/rigeng-latest.apk"
    )
    print(f"  latest.apk: HTTP {stdout.read().decode().strip()}")

    stdin, stdout, stderr = ssh.exec_command(
        "curl -s 'http://localhost/api/v1/version/check?apk_version_code={}' "
        "| python3 -c \"import sys,json; d=json.load(sys.stdin)['data']; "
        "print('  needs_update=' + str(d.get('needs_update', 'N/A')))\"".format(VERSION_CODE)
    )
    print(f"  {stdout.read().decode().strip()}")

    ssh.close()
    print(f"\n✓ Deploy complete!")
    print(f"  Download: http://47.96.187.229/rigeng-latest.apk")

if __name__ == "__main__":
    main()
