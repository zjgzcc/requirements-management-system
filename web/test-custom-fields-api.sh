#!/bin/bash
# 自定义字段 API 测试脚本

BASE_URL="http://localhost:8001"
TOKEN=""

# 登录获取 Token
login() {
    echo "=== 登录 ==="
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}')
    
    TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        echo "登录失败：$RESPONSE"
        exit 1
    fi
    
    echo "登录成功，Token: ${TOKEN:0:20}..."
    echo ""
}

# 测试创建字段
create_field() {
    echo "=== 创建字段：$1 ==="
    curl -s -X POST "$BASE_URL/api/custom-fields" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$2" | jq .
    echo ""
}

# 测试获取字段列表
get_fields() {
    echo "=== 获取字段列表 ==="
    curl -s -X GET "$BASE_URL/api/custom-fields" \
        -H "Authorization: Bearer $TOKEN" | jq .
    echo ""
}

# 测试更新字段
update_field() {
    echo "=== 更新字段 $1 ==="
    curl -s -X PUT "$BASE_URL/api/custom-fields/$1" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$2" | jq .
    echo ""
}

# 测试删除字段
delete_field() {
    echo "=== 删除字段 $1 ==="
    curl -s -X DELETE "$BASE_URL/api/custom-fields/$1" \
        -H "Authorization: Bearer $TOKEN" | jq .
    echo ""
}

# 主测试流程
main() {
    login
    
    # 创建文本字段
    create_field "优先级" '{
        "name": "优先级",
        "type": "select",
        "scope": "requirement",
        "description": "需求优先级",
        "required": true,
        "enabled": true,
        "defaultValue": "medium",
        "options": ["high", "medium", "low"]
    }'
    
    # 创建数字字段
    create_field "复杂度" '{
        "name": "复杂度",
        "type": "number",
        "scope": "requirement",
        "description": "需求复杂度评分",
        "required": false,
        "enabled": true,
        "defaultValue": 1
    }'
    
    # 创建用例字段
    create_field "测试环境" '{
        "name": "测试环境",
        "type": "multiselect",
        "scope": "testcase",
        "description": "适用的测试环境",
        "required": false,
        "enabled": true,
        "options": ["开发环境", "测试环境", "预发布环境", "生产环境"]
    }'
    
    # 获取字段列表
    get_fields
    
    # 获取需求字段
    echo "=== 获取需求字段 ==="
    curl -s -X GET "$BASE_URL/api/custom-fields?scope=requirement" \
        -H "Authorization: Bearer $TOKEN" | jq .
    echo ""
    
    # 获取用例字段
    echo "=== 获取用例字段 ==="
    curl -s -X GET "$BASE_URL/api/custom-fields?scope=testcase" \
        -H "Authorization: Bearer $TOKEN" | jq .
    echo ""
    
    echo "=== 测试完成 ==="
}

main
