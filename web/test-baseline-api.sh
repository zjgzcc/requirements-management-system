#!/bin/bash

# 基线版本管理模块 API 测试脚本
# 使用方法：./test-baseline-api.sh

BASE_URL="http://localhost:8001/api"

echo "======================================"
echo "基线版本管理模块 API 测试"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    
    echo -n "测试：$name ... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -X GET "$url" -H "Content-Type: application/json")
    else
        response=$(curl -s -X POST "$url" -H "Content-Type: application/json" -d "$data")
    fi
    
    if echo "$response" | grep -q '"success": true'; then
        echo -e "${GREEN}✓ 通过${NC}"
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "响应：$response"
    fi
}

# 1. 测试获取基线列表
echo "1. 测试获取基线列表"
test_api "获取所有基线" "GET" "$BASE_URL/baselines"

# 2. 测试按项目筛选
echo ""
echo "2. 测试按项目筛选基线"
test_api "按项目筛选" "GET" "$BASE_URL/baselines?projectId=mmslip4ss321w2qimp"

# 3. 测试按类型筛选
echo ""
echo "3. 测试按类型筛选基线"
test_api "按类型筛选" "GET" "$BASE_URL/baselines?type=requirement"

# 4. 测试排序
echo ""
echo "4. 测试排序功能"
test_api "按版本号排序" "GET" "$BASE_URL/baselines?sortBy=version&sortOrder=asc"

# 5. 测试获取基线详情
echo ""
echo "5. 测试获取基线详情"
test_api "获取基线详情" "GET" "$BASE_URL/baselines/mmsw3ni5hpf1nm209u5"

# 6. 测试获取基线摘要
echo ""
echo "6. 测试获取基线摘要"
test_api "获取基线摘要" "GET" "$BASE_URL/baselines/mmsw3ni5hpf1nm209u5/summary"

# 7. 测试基线对比
echo ""
echo "7. 测试基线对比"
test_api "对比两个基线" "GET" "$BASE_URL/baselines/compare?baselineId1=mmsw3ni5hpf1nm209u5&baselineId2=bl_v2_example"

# 8. 测试创建基线 (示例)
echo ""
echo "8. 测试创建基线 (需要实际数据)"
# 这个测试需要实际的项目和需求数据，这里仅展示请求格式
echo "请求格式:"
echo 'POST /api/baselines'
echo '{
  "projectId": "mmslip4ss321w2qimp",
  "type": "requirement",
  "name": "测试基线",
  "itemIds": ["mmslknyfp5e34r68ywn"]
}'

echo ""
echo "======================================"
echo "测试完成"
echo "======================================"
