# API 接口契约文档

**版本**: v1.0  
**最后更新**: 2026-03-16  
**负责人**: 云龙虾 1 号 🦞

---

## 📋 目录

1. [用户认证](#用户认证)
2. [项目管理](#项目管理)
3. [需求管理](#需求管理)
4. [用例管理](#用例管理)
5. [标题层级](#标题层级)
6. [追踪矩阵](#追踪矩阵)
7. [基线版本](#基线版本)
8. [文件上传](#文件上传)

---

## 用户认证

### 登录
```
POST /api/login
```

**请求体**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应**:
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "id": "1",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active"
  }
}
```

---

## 项目管理

### 获取项目列表
```
GET /api/projects
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "name": "项目名称",
      "description": "描述",
      "owner": "",
      "createdAt": "2026-03-16T...",
      "updatedAt": "2026-03-16T..."
    }
  ]
}
```

### 创建项目
```
POST /api/projects
```

**请求体**:
```json
{
  "name": "项目名称",
  "description": "描述（可选）",
  "owner": "负责人（可选）"
}
```

### 更新项目
```
PUT /api/projects/:id
```

### 删除项目
```
DELETE /api/projects/:id
```

---

## 需求管理

### 获取需求列表
```
GET /api/requirements?projectId=xxx&headerId=yyy
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "reqId": "REQ-1",
      "projectId": "proj_xxx",
      "prefix": "REQ",
      "description": "需求描述",
      "acceptanceCriteria": "验收标准",
      "headerId": "header_xxx",
      "richContent": "<p>富文本内容</p>",
      "attachments": [],
      "createdAt": "2026-03-16T...",
      "updatedAt": "2026-03-16T..."
    }
  ]
}
```

### 创建需求
```
POST /api/requirements
```

**请求体**:
```json
{
  "projectId": "proj_xxx",
  "prefix": "REQ",
  "description": "简要描述",
  "richContent": "<p>富文本内容</p>",
  "acceptanceCriteria": "验收标准",
  "headerId": "header_xxx",
  "attachments": [],
  "savePrefix": false
}
```

**必填字段**: `projectId`, `richContent`

### 更新需求
```
PUT /api/requirements/:id
```

**请求体** (只传需要更新的字段):
```json
{
  "description": "新描述",
  "richContent": "<p>新内容</p>",
  "acceptanceCriteria": "新标准",
  "headerId": "new_header_id"
}
```

### 删除需求
```
DELETE /api/requirements/:id
```

---

## 用例管理

### 获取用例列表
```
GET /api/testcases?projectId=xxx&headerId=yyy
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "tcId": "TC-1",
      "projectId": "proj_xxx",
      "prefix": "TC",
      "steps": "操作步骤",
      "expectedResult": "预期结果",
      "headerId": "header_xxx",
      "richContent": "<p>富文本内容</p>",
      "attachments": [],
      "createdAt": "2026-03-16T...",
      "updatedAt": "2026-03-16T..."
    }
  ]
}
```

### 创建用例
```
POST /api/testcases
```

**请求体**:
```json
{
  "projectId": "proj_xxx",
  "prefix": "TC",
  "steps": "操作步骤",
  "richContent": "<p>富文本内容</p>",
  "expectedResult": "预期结果",
  "headerId": "header_xxx",
  "attachments": [],
  "savePrefix": false
}
```

**必填字段**: `projectId`, `richContent`

### 更新用例
```
PUT /api/testcases/:id
```

### 删除用例
```
DELETE /api/testcases/:id
```

---

## 标题层级

### 获取标题列表
```
GET /api/headers?projectId=xxx
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "projectId": "proj_xxx",
      "name": "第一章 引言",
      "level": 1,
      "parentId": null,
      "createdAt": "2026-03-16T..."
    }
  ]
}
```

### 创建标题
```
POST /api/headers
```

**请求体**:
```json
{
  "projectId": "proj_xxx",
  "name": "章节名称",
  "level": 2,
  "parentId": "parent_header_id"
}
```

### 更新标题
```
PUT /api/headers/:id
```

### 删除标题
```
DELETE /api/headers/:id
```

---

## 追踪矩阵

### 获取追踪矩阵
```
GET /api/trace-matrix?projectId=xxx
```

**响应**:
```json
{
  "success": true,
  "data": {
    "projectId": "xxx",
    "requirements": [
      { "id": "req1", "reqId": "REQ-1", "description": "描述" }
    ],
    "testcases": [
      { "id": "tc1", "tcId": "TC-1", "steps": "步骤" }
    ],
    "traceMap": {
      "req1:tc1": {
        "traceId": "trace_xxx",
        "requirementId": "req1",
        "testcaseId": "tc1",
        "createdAt": "..."
      }
    },
    "stats": {
      "totalRequirements": 10,
      "totalTestcases": 15,
      "totalTraces": 12,
      "coveredRequirements": 8,
      "coveredTestcases": 10
    }
  }
}
```

### 创建追踪关系
```
POST /api/traces
```

**请求体**:
```json
{
  "requirementId": "req_xxx",
  "testcaseId": "tc_xxx"
}
```

### 删除追踪关系
```
DELETE /api/traces/:id
```

### 导出追踪矩阵
```
GET /api/trace-matrix/export?projectId=xxx&format=csv|json
```

---

## 基线版本

### 获取基线列表
```
GET /api/baselines?projectId=xxx&type=requirement|testcase
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "projectId": "proj_xxx",
      "type": "requirement",
      "name": "V1.0 版本发布",
      "version": "V1",
      "items": [...],
      "createdAt": "...",
      "createdBy": "admin"
    }
  ]
}
```

### 创建基线
```
POST /api/baselines
```

**请求体**:
```json
{
  "projectId": "proj_xxx",
  "type": "requirement",
  "name": "基线名称",
  "version": "V1",
  "itemIds": ["req1", "req2", "req3"]
}
```

### 获取基线详情
```
GET /api/baselines/:id
```

### 删除基线
```
DELETE /api/baselines/:id
```

---

## 文件上传

### 上传文件
```
POST /api/upload
```

**请求**: `multipart/form-data`

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "originalName": "image.png",
      "fileName": "1710590000_xxx.png",
      "mimeType": "image/png",
      "size": 102400,
      "url": "/uploads/1710590000_xxx.png",
      "uploadedAt": "..."
    }
  ]
}
```

**限制**:
- 最大文件大小：50MB
- 支持格式：图片、视频、PDF、Word、Excel 等

---

## 历史记录

### 获取历史记录
```
GET /api/history?type=requirement|testcase&itemId=xxx&limit=50
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "type": "requirement",
      "itemId": "req_xxx",
      "action": "create|update|delete|baseline",
      "changes": {...},
      "userId": "admin",
      "timestamp": "..."
    }
  ]
}
```

---

## 前缀设置

### 获取默认前缀
```
GET /api/prefixes
```

**响应**:
```json
{
  "success": true,
  "data": {
    "requirement": "REQ",
    "testcase": "TC"
  }
}
```

### 更新前缀
```
PUT /api/prefixes
```

**请求体**:
```json
{
  "requirement": "FR",
  "testcase": "CASE"
}
```

---

_所有 API 统一响应格式，错误时返回 `success: false` 和 `message` 字段_
