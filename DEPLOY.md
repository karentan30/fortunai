# 善缘 ShenYuan — 部署指南 (HK 服务器 47.242.80.65)

## 前置条件
- 服务器：阿里云香港 47.242.80.65
- 已安装：Node.js v18+, PM2, Caddy
- 已运行：Ollama (port 11434)

## 1️⃣ 拉取最新代码

```bash
cd /opt/shenyuan  # 或自定义目录
git clone https://github.com/karentan30/fortunai.git .
git checkout main
```

## 2️⃣ 后端部署

```bash
cd server
npm install
npm start  # 测试启动，应输出 "Server running on port 3020"
```

## 3️⃣ PM2 守护进程

```bash
pm2 start npm --name "shenyuan-api" -- start
pm2 save
pm2 startup
```

## 4️⃣ Caddy 反代配置

编辑 `/etc/caddy/Caddyfile`，添加反代：

```
shenyuan.example.com {
  root * /opt/shenyuan
  file_server
  
  # 前端路由
  try_files {path} /index.html
  
  # API反代
  reverse_proxy /api* localhost:3020
}
```

重启 Caddy：
```bash
sudo systemctl restart caddy
```

## 5️⃣ 检查部署

```bash
# 前端
curl -s http://47.242.80.65 | head -20

# 后端
curl -s http://47.242.80.65/api/health

# 日志
pm2 logs shenyuan-api
```

---

## 🚨 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `EADDRINUSE 3020` | 端口被占用 | `lsof -i :3020` 后 kill |
| `Ollama 连接失败` | Ollama 未启动或地址错误 | 检查 `.env` OLLAMA_URL |
| `npm install 失败` | 网络或依赖版本冲突 | 清除 package-lock.json 重试 |

---

## 📦 GPUs 生成的图片集成

执行本地：
```bash
# 从5090服务器下载完整图片后
ls assets/images/generated/ | wc -l
# 应显示 ~345 张

# Commit and push
git add assets/images/generated/
git commit -m "feat: integrate GPU-generated images (345 assets)"
git push origin main

# 然后在HK服务器上 pull
cd /opt/shenyuan && git pull origin main
```

---

## ⏱️ 部署耗时
- 后端启动：~10s
- 前端加载：~2s
- 首次API调用（Ollama）：~3-5s

---

**部署者**：Claude CEO | **日期**：2026-07-23
