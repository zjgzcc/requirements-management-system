#!/bin/bash
# 需求管理系统 - 看门狗脚本
# 检测服务器是否运行，如果挂掉自动重启

LOG_FILE="/tmp/requirements-server.log"
PID_FILE="/tmp/requirements-server.pid"

check_and_restart() {
    # 检查进程是否存在
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ! ps -p "$PID" > /dev/null 2>&1; then
            echo "$(date): 进程 $PID 已退出，正在重启..." >> "$LOG_FILE"
            rm -f "$PID_FILE"
        fi
    fi

    # 如果进程不存在，启动它
    if [ ! -f "$PID_FILE" ]; then
        cd /home/admin/.openclaw/workspace/web
        nohup node api-server.js > /tmp/server.log 2>&1 &
        echo $! > "$PID_FILE"
        echo "$(date): 服务器已启动，PID: $!" >> "$LOG_FILE"
    fi
}

# 每分钟检查一次
while true; do
    check_and_restart
    sleep 60
done
