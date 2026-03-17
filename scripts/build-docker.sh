#!/bin/bash
# =============================================================================
# Docker 镜像构建脚本
# =============================================================================
# 用途：构建优化的 Docker 镜像，支持多环境
# 使用：./scripts/build-docker.sh [dev|prod] [version]
# =============================================================================

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1" }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" }
log_error() { echo -e "${RED}[ERROR]${NC} $1" }

# 默认参数
ENV="${1:-prod}"
VERSION="${2:-latest}"
IMAGE_NAME="requirements-management-system"
TAG="${IMAGE_NAME}:${VERSION}"

# 帮助信息
show_help() {
    cat << EOF
Docker 镜像构建脚本

用法：$0 [选项] [版本]

选项:
    dev     构建开发环境镜像
    prod    构建生产环境镜像（默认）
    
版本:
    自定义版本号，如 1.0.0, 2024.03.18 等
    默认为 latest

示例:
    $0                    # 构建生产环境 latest 版本
    $0 prod 1.0.0         # 构建生产环境 1.0.0 版本
    $0 dev                # 构建开发环境镜像
    $0 prod 2024.03.18    # 构建带日期的版本

EOF
}

# 检查参数
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# 验证环境参数
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
    log_error "无效的环境参数：$ENV"
    log_info "请使用 'dev' 或 'prod'"
    exit 1
fi

# 选择 Dockerfile 和目标
if [[ "$ENV" == "dev" ]]; then
    DOCKERFILE="Dockerfile"
    TARGET="production"
    log_info "构建开发环境镜像"
else
    DOCKERFILE="Dockerfile"
    TARGET="production"
    log_info "构建生产环境镜像"
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    log_error "未找到 Docker，请先安装 Docker"
    exit 1
fi

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    log_error "Docker 未运行，请启动 Docker 服务"
    exit 1
fi

# 显示构建信息
echo ""
echo "============================================================"
echo "  Docker 镜像构建"
echo "============================================================"
echo "  环境：    $ENV"
echo "  版本：    $VERSION"
echo "  镜像名：  $TAG"
echo "  项目根目录：$PROJECT_ROOT"
echo "============================================================"
echo ""

# 清理旧镜像（可选）
log_info "清理悬空镜像..."
docker image prune -f > /dev/null 2>&1 || true

# 构建镜像
log_info "开始构建镜像..."
echo ""

BUILD_ARGS="--build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
BUILD_ARGS="$BUILD_ARGS --build-arg VERSION=$VERSION"
BUILD_ARGS="$BUILD_ARGS --build-arg VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

if [[ "$ENV" == "prod" ]]; then
    BUILD_ARGS="$BUILD_ARGS --target production"
fi

# 执行构建
docker build \
    $BUILD_ARGS \
    -f "$DOCKERFILE" \
    -t "$TAG" \
    -t "${IMAGE_NAME}:${ENV}" \
    .

# 检查构建结果
if [ $? -eq 0 ]; then
    echo ""
    log_success "镜像构建成功！"
    echo ""
    
    # 显示镜像信息
    log_info "镜像信息:"
    docker images "$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    # 显示构建建议
    echo ""
    echo "============================================================"
    echo "  下一步操作"
    echo "============================================================"
    echo ""
    echo "  1. 运行容器:"
    echo "     docker run -d -p 8000:8000 -p 3000:3000 $TAG"
    echo ""
    echo "  2. 使用 docker-compose:"
    echo "     docker-compose up -d"
    echo ""
    if [[ "$ENV" == "prod" ]]; then
        echo "  3. 推送到镜像仓库:"
        echo "     docker tag $TAG your-registry/$TAG"
        echo "     docker push your-registry/$TAG"
        echo ""
    fi
    echo "============================================================"
    echo ""
    
    exit 0
else
    log_error "镜像构建失败！"
    exit 1
fi
