"""部署修复：更新后端短信代码到服务器"""
import paramiko, time, json, os

cfg_path = os.path.join(os.path.dirname(__file__), '.deploy-config.json')
cfg = json.load(open(cfg_path))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(cfg['host'], username=cfg['user'], password=cfg['pwd'], timeout=15)

def run(cmd):
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out: print(out)
    if err: print('[stderr]', err)
    return out

# 1. git pull
run('cd /opt/rigeng.app && git pull')

# 2. copy updated files to container
run('docker cp /opt/rigeng.app/backend/app/services/push_service/service.py rigengapp-backend-1:/app/app/services/push_service/service.py')
run('docker cp /opt/rigeng.app/backend/app/services/user_auth/service.py rigengapp-backend-1:/app/app/services/user_auth/service.py')

# 3. restart
run('docker restart rigengapp-backend-1')
time.sleep(5)

# 4. test
print('\n=== TEST send-code ===')
run('curl -s -X POST http://localhost:8000/api/v1/auth/send-code -H "Content-Type: application/json" -d \'{"phone":"13800000001","purpose":"register"}\'')

ssh.close()
print('\nDone!')
