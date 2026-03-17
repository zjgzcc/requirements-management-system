#!/bin/bash

# 修订模块 API 测试脚本

API_BASE="http://localhost:8001"

echo "======================================"
echo "修订模块 API 测试"
echo "======================================"
echo ""

# 测试 1: 标记变更
echo "测试 1: 标记变更 (POST /api/revision/mark)"
echo "--------------------------------------"

curl -X POST "$API_BASE/api/revision/mark" \
  -H "Content-Type: application/json" \
  -d '{
    "objectType": "requirement",
    "objectId": "REQ001",
    "userId": "user123",
    "userName": "测试用户",
    "description": "初始测试变更",
    "changes": [
      {
        "type": "added",
        "field": "description",
        "currentValue": "这是新增的需求描述",
        "description": "创建需求"
      }
    ]
  }' | jq '.'

echo ""
echo ""

# 测试 2: 获取更多变更
echo "测试 2: 标记更多变更 (POST /api/revision/mark)"
echo "--------------------------------------"

curl -X POST "$API_BASE/api/revision/mark" \
  -H "Content-Type: application/json" \
  -d '{
    "objectType": "requirement",
    "objectId": "REQ001",
    "userId": "user456",
    "userName": "张三",
    "description": "修改需求描述",
    "changes": [
      {
        "type": "modified",
        "field": "description",
        "previousValue": "这是新增的需求描述",
        "currentValue": "这是修改后的需求描述",
        "description": "根据评审意见修改"
      },
      {
        "type": "added",
        "field": "acceptanceCriteria",
        "currentValue": "验收标准：功能正常运行",
        "description": "补充验收标准"
      }
    ]
  }' | jq '.'

echo ""
echo ""

# 测试 3: 获取修订历史
echo "测试 3: 获取修订历史 (GET /api/revision/requirement/REQ001)"
echo "--------------------------------------"

curl -X GET "$API_BASE/api/revision/requirement/REQ001" | jq '.'

echo ""
echo ""

# 测试 4: 获取变更列表
echo "测试 4: 获取变更列表 (GET /api/revision/requirement/REQ001/changes)"
echo "--------------------------------------"

curl -X GET "$API_BASE/api/revision/requirement/REQ001/changes" | jq '.'

echo ""
echo ""

# 测试 5: 生成修订报告
echo "测试 5: 生成修订报告 (GET /api/revision/report?type=requirement&id=REQ001)"
echo "--------------------------------------"

curl -X GET "$API_BASE/api/revision/report?type=requirement&id=REQ001" | jq '.'

echo ""
echo ""

# 测试 6: 生成所有修订报告
echo "测试 6: 生成所有修订报告 (GET /api/revision/report)"
echo "--------------------------------------"

curl -X GET "$API_BASE/api/revision/report" | jq '.'

echo ""
echo ""

echo "======================================"
echo "测试完成!"
echo "======================================"
