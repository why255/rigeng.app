部署前请确认
• 你的服务器是 Ubuntu，已安装 Git、Nginx、PostgreSQL、Redis，并已启动。
• 你的域名 www.rigeng.com 已解析到服务器 IP。
• 你已 SSH 登录服务器，且具备 sudo 权限。
 
🤖 Claude Code 执行指令

# 部署 rigengapp 项目 (Python FastAPI + React PC/Mobile 双前端 + UA 分流)

## 0. 设置变量（请根据实际修改）
- 站点根目录: /www/wwwroot/www.rigeng.com
- 仓库地址: https://github.com/why255/rigeng.app.git
- 数据库: PostgreSQL (用户 myuser, 密码 your_db_password, 数据库 mydb)
- Redis: 默认 localhost:6379
- 后端端口: 8000
- 域名: www.rigeng.com

## 1. 拉取代码
```bash
sudo mkdir -p /www/wwwroot
cd /www/wwwroot
if [ -d "www.rigeng.com/.git" ]; then
  cd www.rigeng.com
  git fetch origin
  git reset --hard origin/main
  git clean -fd
else
  sudo rm -rf www.rigeng.com
  git clone https://github.com/why255/rigengapp.git www.rigeng.com
fi
cd /www/wwwroot/www.rigeng.com
 
 
2. 构建 PC 前端
bash

cd /www/wwwroot/www.rigeng.com/frontend
npm install
npm run build
 
 
3. 构建 Mobile 前端
bash

cd /www/wwwroot/www.rigeng.com/mobile
npm install
npm run build
 
 
4. 配置后端环境
4.1 安装 Python 依赖（建议使用虚拟环境）
bash
 
cd /www/wwwroot/www.rigeng.com/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
 
 
4.2 创建 .env 文件（替换密码和密钥）
bash 

cd /www/wwwroot/www.rigeng.com/backend
cat > .env <<EOF
DATABASE_URL=postgresql://myuser:your_db_password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=$(openssl rand -hex 32)
ENV=production
EOF
 
 
4.3 运行数据库迁移
bash

cd /www/wwwroot/www.rigeng.com/backend
source venv/bin/activate
alembic upgrade head
 
 
5. 启动后端服务（PM2）
bash

pm2 stop rigeng-backend 2>/dev/null
pm2 delete rigeng-backend 2>/dev/null
cd /www/wwwroot/www.rigeng.com/backend
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" \
  --name rigeng-backend \
  --interpreter python3
pm2 save
pm2 startup   # 按提示执行命令以启用开机自启
 
 
6. 配置 Nginx（实现同一域名 UA 分流 + 反向代理）
6.1 创建 Nginx 配置文件（覆盖原有配置）
bash
 
sudo cat > /etc/nginx/sites-available/www.rigeng.com <<'EOF'
server {
    listen 80;
    server_name www.rigeng.com;

    # 后端 API 代理
    location ~ ^/(api|docs|openapi.json) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源：根据 UA 分发到不同前端目录
    location / {
        root /www/wwwroot/www.rigeng.com/frontend/dist;
        try_files $uri $uri/ /index.html;
        if ($http_user_agent ~* "(mobile|android|iphone|ipod|blackberry|iemobile|opera mini|opera mobi)") {
            root /www/wwwroot/www.rigeng.com/mobile/dist;
            try_files $uri $uri/ /index.html;
        }
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
 
 
6.2 启用站点并重启 Nginx
bash
 
sudo ln -sf /etc/nginx/sites-available/www.rigeng.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
 
 
7. 阿里云安全组设置（提醒）
请在控制台放行 80 端口（HTTP）和 443（如需 HTTPS），后端 8000 建议仅内网。
8. 验证
• 浏览器访问 http://www.rigeng.com → 应显示 PC 版页面
• 手机访问同一地址 → 应显示移动版页面
• 访问 http://www.rigeng.com/docs → 应出现 FastAPI Swagger 文档
9. 后续更新命令（备用）
bash

cd /www/wwwroot/www.rigeng.com
git pull
cd frontend && npm run build && cd ..
cd mobile && npm run build && cd ..
cd backend && source venv/bin/activate && pip install -r requirements.txt && alembic upgrade head
pm2 restart rigeng-backend
 
 
⚠️ 注意事项
• 请确保 PostgreSQL 和 Redis 已启动且用户/密码正确。
• 如遇错误，请检查日志：pm2 logs rigeng-backend 或 /var/log/nginx/error.log。
• 若使用 HTTPS，后续可追加 SSL 证书配置。


