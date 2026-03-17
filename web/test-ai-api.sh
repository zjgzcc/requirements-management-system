#!/bin/bash

# ===== AI 智能助手 API 测试脚本 =====

BASE_URL="http://localhost:8001"
API_BASE="$BASE_URL/api/ai"

echo "========================================="
echo "  AI 智能助手 API 测试"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL=0
PASSED=0
FAILED=0

# 测试函数
test_api() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    TOTAL=$((TOTAL + 1))
    echo -n "测试 $TOTAL: $name ... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" == "200" ]; then
        echo -e "${GREEN}✓ 通过${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        
        # 显示部分响应
        if [ ${#body} -gt 200 ]; then
            echo "  响应：${body:0:200}..."
        else
            echo "  响应：$body"
        fi
    else
        echo -e "${RED}✗ 失败${NC} (HTTP $http_code)"
        echo "  错误：$body"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
}

# 检查服务是否运行
echo "检查服务状态..."
if ! curl -s "$BASE_URL/api/health" > /dev/null; then
    echo -e "${RED}错误：API 服务未运行${NC}"
    echo "请先启动服务：node api-server.js"
    exit 1
fi
echo -e "${GREEN}✓ 服务运行正常${NC}"
echo ""

# 1. 测试 AI 状态
echo "=== 基础功能测试 ==="
test_api "AI 服务状态" "GET" "/status" ""

# 2. 测试需求生成
echo "=== AI 需求生成 ==="
test_api "生成需求 - 登录功能" "POST" "/generate-requirement" \
    '{"userInput": "用户登录功能，支持手机号和邮箱登录"}'

# 3. 测试测试用例生成
echo "=== AI 测试用例生成 ==="
test_api "生成测试用例" "POST" "/generate-testcase" \
    '{"requirementDoc": "用户登录功能：用户输入用户名和密码，系统验证后登录"}'

# 4. 测试需求审查
echo "=== AI 需求审查 ==="
test_api "审查需求" "POST" "/review-requirement" \
    '{"requirementText": "用户应该可以登录系统，可能需要输入密码"}'

# 5. 测试缺陷分类
echo "=== AI 缺陷分类 ==="
test_api "缺陷分类" "POST" "/classify-defect" \
    '{"defectDescription": "登录页面在移动端显示异常，按钮错位", "includeHistory": false}'

# 6. 测试智能搜索
echo "=== AI 智能搜索 ==="
test_api "智能搜索 - 登录相关" "POST" "/search" \
    '{"query": "登录相关的测试用例"}'

# 7. 测试变更影响分析
echo "=== AI 变更影响分析 ==="
test_api "变更影响分析" "POST" "/impact-analysis" \
    '{"changeDescription": "修改登录密码规则，从 6 位改为 8-16 位"}'

# 8. 测试智能建议
echo "=== AI 智能建议 ==="
test_api "获取智能建议" "GET" "/suggestions?context=requirement" ""

# 9. 测试错误处理
echo "=== 错误处理测试 ==="
test_api "错误处理 - 空输入" "POST" "/generate-requirement" \
    '{"userInput": ""}'

test_api "错误处理 - 缺少参数" "POST" "/generate-testcase" \
    '{}'

# 测试结果汇总
echo "========================================="
echo "  测试结果汇总"
echo "========================================="
echo -e "总计：$TOTAL"
echo -e "通过：${GREEN}$PASSED${NC}"
echo -e "失败：${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  部分测试失败，请检查日志${NC}"
    exit 1
fi
