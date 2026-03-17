# 自定义字段模块 - 实现文档

## 📋 概述

自定义字段模块允许用户根据项目需求为需求和用例添加自定义字段，提供灵活的字段管理能力。

## ✨ 核心功能

### 1. 字段管理
- ✅ 创建自定义字段（文本/数字/日期/下拉/多选）
- ✅ 字段配置（名称/类型/必填/默认值）
- ✅ 字段排序（拖拽排序）
- ✅ 字段启用/禁用

### 2. 字段应用
- ✅ 需求自定义字段
- ✅ 用例自定义字段
- ✅ 字段值编辑和保存
- ✅ 字段验证（必填、类型检查）

### 3. 字段显示
- ✅ 列表页显示自定义字段
- ✅ 详情页显示自定义字段
- ✅ 导出时包含自定义字段

## 📁 文件结构

```
web/
├── custom-fields.html          # 字段管理页面
├── custom-fields.json          # 字段配置存储
├── api-server.js               # API 服务器（已增强）
└── test-custom-fields-api.sh   # API 测试脚本
```

## 🔌 API 接口

### 获取字段列表
```http
GET /api/custom-fields
Authorization: Bearer {token}

Query Parameters:
- scope: requirement | testcase (可选，按范围过滤)
- enabled: true | false (可选，是否只返回启用字段)

Response:
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "优先级",
      "type": "select",
      "scope": "requirement",
      "description": "需求优先级",
      "required": true,
      "enabled": true,
      "defaultValue": "medium",
      "options": ["high", "medium", "low"],
      "order": 0,
      "createdAt": "2026-03-17T14:00:00.000Z",
      "updatedAt": "2026-03-17T14:00:00.000Z"
    }
  ]
}
```

### 创建字段
```http
POST /api/custom-fields
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "优先级",
  "type": "select",
  "scope": "requirement",
  "description": "需求优先级",
  "required": true,
  "enabled": true,
  "defaultValue": "medium",
  "options": ["high", "medium", "low"]
}

Response:
{
  "success": true,
  "message": "字段创建成功",
  "data": { ... }
}
```

### 更新字段
```http
PUT /api/custom-fields/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "优先级",
  "enabled": false,
  "order": 1
}

Response:
{
  "success": true,
  "message": "字段更新成功",
  "data": { ... }
}
```

### 删除字段
```http
DELETE /api/custom-fields/:id
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "字段删除成功"
}
```

### 重排字段顺序
```http
POST /api/custom-fields/reorder
Authorization: Bearer {token}
Content-Type: application/json

{
  "scope": "requirement",
  "fieldIds": ["1", "3", "2"]
}

Response:
{
  "success": true,
  "message": "排序更新成功"
}
```

### 获取指定范围的字段
```http
GET /api/custom-fields/for/:scope
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": [ ... ]
}
```

## 📊 字段类型

| 类型 | 描述 | 示例值 |
|------|------|--------|
| text | 文本 | "高优先级" |
| number | 数字 | 5, 3.14 |
| date | 日期 | "2026-03-17" |
| select | 下拉选择 | "high" |
| multiselect | 多选 | ["option1", "option2"] |

## 🔧 在需求/用例中使用自定义字段

### 创建需求时添加自定义字段值
```http
POST /api/requirements
Authorization: Bearer {token}
Content-Type: application/json

{
  "projectId": "project123",
  "title": "需求标题",
  "description": "需求描述",
  "customFields": {
    "1": "high",  // 字段 ID: 值
    "2": 5
  }
}
```

### 更新需求时修改自定义字段值
```http
PUT /api/requirements/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "更新后的标题",
  "customFields": {
    "1": "medium",
    "2": 3
  }
}
```

## 🎨 前端集成示例

### 获取字段列表并渲染
```javascript
// 获取需求字段
async function loadRequirementFields() {
  const response = await fetch('/api/custom-fields?scope=requirement', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data: fields } = await response.json();
  
  // 渲染字段表单
  fields.forEach(field => {
    renderFieldInput(field);
  });
}

// 根据字段类型渲染输入控件
function renderFieldInput(field) {
  switch (field.type) {
    case 'text':
      return `<input type="text" value="${field.defaultValue}">`;
    case 'number':
      return `<input type="number" value="${field.defaultValue}">`;
    case 'date':
      return `<input type="date" value="${field.defaultValue}">`;
    case 'select':
      return `<select>
        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
      </select>`;
    case 'multiselect':
      return `<select multiple>
        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
      </select>`;
  }
}
```

### 保存自定义字段值
```javascript
async function saveRequirementWithCustomFields(data) {
  const customFields = {};
  
  // 收集表单中的自定义字段值
  document.querySelectorAll('[data-custom-field]').forEach(input => {
    const fieldId = input.dataset.customField;
    customFields[fieldId] = input.value;
  });
  
  const response = await fetch('/api/requirements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...data,
      customFields
    })
  });
  
  return await response.json();
}
```

## ✅ 字段验证

系统会自动验证自定义字段：

1. **必填验证**: 必填字段不能为空
2. **类型验证**: 
   - number: 必须是有效数字
   - date: 必须是有效日期
   - select: 值必须在选项中
   - multiselect: 必须是数组，所有值必须在选项中
3. **重名验证**: 同一范围内不能有重名字段

## 📤 导出支持

自定义字段会自动包含在导出文件中：

- **Excel 导出**: 自定义字段作为额外列
- **Word 导出**: 自定义字段显示在文档中
- **批量导出**: 所有自定义字段都会包含

## 🧪 测试

运行测试脚本：
```bash
chmod +x test-custom-fields-api.sh
./test-custom-fields-api.sh
```

测试流程：
1. 登录获取 Token
2. 创建测试字段（文本、数字、下拉、多选）
3. 获取字段列表
4. 按范围过滤字段
5. 验证 API 响应

## 🔐 权限控制

所有自定义字段 API 都需要认证：
- 需要有效的 Session Token
- 通过 `requireAuth` 中间件验证
- 未认证请求返回 401 错误

## 📝 数据存储

字段配置存储在 `custom-fields.json`:
```json
{
  "fields": [
    {
      "id": "1",
      "name": "优先级",
      "type": "select",
      "scope": "requirement",
      "required": true,
      "enabled": true,
      "options": ["high", "medium", "low"],
      "order": 0
    }
  ],
  "nextId": 2
}
```

需求和用例的自定义字段值存储在各自的 `columns` 数组中：
```json
{
  "id": "req123",
  "reqId": "REQ-1",
  "columns": [
    { "id": "desc", "name": "描述", "type": "text", "value": "..." },
    { "id": "1", "name": "优先级", "type": "select", "value": "high" }
  ]
}
```

## 🚀 快速开始

1. **访问字段管理页面**: 
   - 打开 `http://localhost:8001/custom-fields.html`
   
2. **创建第一个字段**:
   - 点击"+ 新建字段"
   - 填写字段信息
   - 选择字段类型
   - 保存

3. **在需求/用例中使用**:
   - 创建或编辑需求/用例
   - 填写自定义字段值
   - 保存

## 📚 相关文档

- [API 服务器文档](./API-DOCUMENTATION.md)
- [需求管理模块](./requirements.html)
- [用例管理模块](./testcases.html)

## 🔄 版本历史

- **v1.0.0** (2026-03-17): 初始版本
  - 基础字段管理功能
  - 5 种字段类型支持
  - 完整的 CRUD API
  - 字段验证
  - 导出支持

---

**开发完成时间**: 2026-03-17  
**开发者**: 云龙虾 1 号 🦞
