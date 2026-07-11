"""
日耕 APK 一键部署脚本。

每次发布新版本只需要:
  1. 修改 VERSION / VERSION_CODE / RELEASE_NOTES
  2. python deploy-apk.py

自动完成: 构建前端 → 同步Android → 构建APK → 上传服务器 → 更新后端 → 重启
"""
import os, sys, json, shutil, subprocess, time

# Force UTF-8 encoding for subprocess output (Windows GBK issue)
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', buffering=1)

# ═══════════════════ 修改这里 ═══════════════════
VERSION = "0.3.1"
VERSION_CODE = 3
RELEASE_NOTES = "多模型接入:豆包Seed2.0Pro/通义千问Qwen3.7/KimiK2.5/DeepSeekV4/通义听悟ASR/通义TTS-HD/智谱GLM4.5"
IS_CRITICAL = False
# ═══════════════════════════════════════════════

HOST = "47.103.197.189"
USER = "root"
PWD = "Why20060220!"
SERVER_APK_PATH = "/opt/rigeng.app/mobile/dist/mobile/日耕-latest.apk"
MOBILE_DIST_REMOTE = "/opt/rigeng.app/mobile/dist/mobile"
BACKEND_MAIN_REMOTE = "/opt/rigeng.app/backend/app/main.py"
VOICE_SERVICE_REMOTE = "/opt/rigeng.app/backend/app/services/voice_engine/service.py"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOBILE_DIR = os.path.join(BASE_DIR, "mobile", "frontend")
DIST_DIR = os.path.join(BASE_DIR, "mobile", "dist", "mobile")  # Vite outDir: ../dist/mobile
APK_SRC = os.path.join(MOBILE_DIR, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")

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

    # Step 1: Build mobile frontend
    print("\n[1/5] Building mobile frontend...")
    run_cmd("npm run build", cwd=MOBILE_DIR)

    # Step 2: Sync & build APK
    print("\n[2/5] Building APK...")
    run_cmd("npx cap sync android", cwd=MOBILE_DIR)
    android_dir = os.path.join(MOBILE_DIR, "android")
    # Set JAVA_HOME for gradle
    env = os.environ.copy()
    env["JAVA_HOME"] = "C:/Program Files/Java/jdk-21.0.10"
    env["ANDROID_HOME"] = "C:/Android"
    env["ANDROID_SDK_ROOT"] = "C:/Android"
    subprocess.run(
        "bash gradlew assembleDebug",
        shell=True, cwd=android_dir, env=env, check=True,
        capture_output=True, text=True, encoding='utf-8', errors='replace',
    )

    if not os.path.exists(APK_SRC):
        print(f"ERROR: APK not found at {APK_SRC}")
        sys.exit(1)
    apk_size = os.path.getsize(APK_SRC)
    print(f"  APK built: {apk_size} bytes")

    # Step 3: Upload to server via paramiko
    print("\n[3/5] Uploading to server...")
    import paramiko
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PWD, timeout=30)
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

    # Upload APK as latest.apk (stable fixed path)
    print("  Uploading APK...")
    sftp.put(APK_SRC, SERVER_APK_PATH)
    # Also keep versioned copy
    ver_apk = f"/opt/rigeng.app/mobile/dist/mobile/日耕-v{VERSION}-debug.apk"
    sftp.put(APK_SRC, ver_apk)
    print(f"  APK → {SERVER_APK_PATH}")
    print(f"  APK → {ver_apk}")

    sftp.close()

    # Update version.json
    print("  Updating version.json...")
    ver_data = {
        "version": VERSION,
        "versionCode": VERSION_CODE,
        "download_url": f"http://{HOST}/日耕-latest.apk",
        "release_notes": RELEASE_NOTES,
        "is_critical": IS_CRITICAL,
    }
    def write_remote_file(path, content):
        sftp = ssh.open_sftp()
        f = sftp.file(path, 'w')
        f.write(content)
        f.flush()
        f.close()
        sftp.close()

    write_remote_file(f"{MOBILE_DIST_REMOTE}/version.json", json.dumps(ver_data, ensure_ascii=False))

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
        f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost/日耕-latest.apk"
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
    print(f"  Download: http://{HOST}/日耕-latest.apk")

if __name__ == "__main__":
    main()
