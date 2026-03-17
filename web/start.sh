#!/bin/bash

# 需求管理系统 - 启动脚本
# 使用 PM2 实现自动重启和进程守护

cd /home/admin/.openclaw/workspace/web

echo "🚀 启动需求管理系统..."

# 停止旧的进程
pm2 stop requirements-system 2>/dev/null || true
pm2 delete requirements-system 2>/dev/null || true

# 启动新进程
pm2 start api-server.js \
    --name "requirements-system" \
    --instances 1 \
    --autorestart \
    --watch \
    --max-memory-restart 500M \
    --env production

# 保存 PM2 配置（开机自启）
pm2 save

echo ""
echo "✅ 系统已启动！"
echo ""
echo "📊 查看状态：pm2 status"
echo "📋 查看日志：pm2 logs requirements-system"
echo "🔄 重启服务：pm2 restart requirements-system"
echo "⏹️ 停止服务：pm2 stop requirements-system"
echo ""
echo "访问地址：http://localhost:8001"
echo "远程访问：http://8.215.93.217:8001"
