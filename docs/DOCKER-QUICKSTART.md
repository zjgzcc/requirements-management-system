# Docker 快速入门指南

## 🚀 5 分钟快速部署

### 第一步：检查环境

```bash
# 确认已安装 Docker
docker --version
docker-compose --version
```

### 第二步：构建镜像

```bash
cd /home/admin/.openclaw/workspace

# 使用构建脚本（推荐）
./scripts/build-docker.sh prod 1.0.0

# 或者手动构建
docker build -t requirements-management-system:latest .
```

### 第三步：启动服务

```bash
# 使用 docker-compose（推荐）
docker-compose up -d

# 或者使用 docker 命令
docker run -d -p 8000:8000 -p 3000:3000 requirements-management-system:latest
```

### 第四步：验证部署

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 访问应用
# 后端 API 文档：http://localhost:8000/docs
# 前端界面：http://localhost:3000
```

## 📋 常用命令速查

### 服务管理

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

### 镜像管理

```bash
# 构建镜像
./scripts/build-docker.sh prod 1.0.0

# 查看镜像
docker images

# 删除镜像
docker rmi requirements-management-system:1.0.0
```

### 容器操作

```bash
# 进入容器
docker exec -it requirements-management-system bash

# 查看容器资源
docker stats requirements-management-system

# 重启容器
docker restart requirements-management-system
```

### 数据管理

```bash
# 查看数据卷
docker volume ls

# 备份数据
docker run --rm -v rms-uploads-data:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz -C /data .

# 恢复数据
docker run --rm -v rms-uploads-data:/data -v $(pwd):/backup alpine tar xzf /backup/uploads.tar.gz -C /data
```

## 🔧 环境配置

### 开发环境

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**特点:**
- ✅ 源代码热重载
- ✅ 详细日志输出
- ✅ 宽松的资源限制

### 生产环境

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**特点:**
- ✅ 优化的性能配置
- ✅ 严格的安全设置
- ✅ 自动重启策略
- ✅ 日志轮转

## 📊 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 8000 | FastAPI | 后端 API 服务 |
| 3000 | Node.js | 前端 Web 服务 |
| 80 | Nginx | HTTP (生产环境) |
| 443 | Nginx | HTTPS (生产环境) |

## 🐛 快速故障排查

### 容器无法启动

```bash
# 查看错误日志
docker-compose logs app

# 检查端口占用
lsof -i :8000
lsof -i :3000

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 应用无响应

```bash
# 检查健康状态
docker inspect --format='{{.State.Health.Status}}' requirements-management-system

# 重启服务
docker-compose restart

# 查看资源使用
docker stats
```

### 数据丢失

```bash
# 检查数据卷
docker volume ls | grep rms

# 确保使用持久化卷
# 参考 docker-compose.yml 中的 volumes 配置
```

## 📖 更多文档

- **完整部署指南**: `docs/DOCKER-DEPLOYMENT.md`
- **环境变量配置**: `.env.example`
- **Nginx 配置**: `nginx/nginx.conf`

## 💡 提示

1. **首次运行**: 构建镜像可能需要 5-10 分钟
2. **数据持久化**: 使用命名卷确保数据安全
3. **定期更新**: 使用 `docker-compose pull` 更新镜像
4. **备份重要**: 定期备份数据卷

---

**需要帮助？** 查看完整文档或运行 `./scripts/build-docker.sh --help`
