# 导出模板模块 - 实现文档

## 概述

导出模板模块提供了可自定义的导出模板功能，支持 Word 和 Excel 两种格式，允许用户创建、管理和应用模板来导出测试用例等数据。

## 功能特性

### 1. 模板管理
- ✅ 创建导出模板（Word/Excel）
- ✅ 模板配置（包含字段/样式/布局）
- ✅ 模板预览
- ✅ 模板编辑
- ✅ 模板删除

### 2. 模板分类
- ✅ 公有模板（所有用户可用）
- ✅ 私有模板（仅创建者可用）
- ✅ 系统模板（内置，不可删除）

### 3. 模板应用
- ✅ 导出时选择模板
- ✅ 按模板格式导出
- ✅ 模板字段映射

## 技术实现

### 文件结构
```
web/
├── templates.html          # 模板管理页面
├── templates.json          # 模板数据存储
├── api-server.js           # API 服务器（已增强）
└── test-templates-api.js   # API 测试脚本
```

### API 接口

#### 获取模板列表
```
GET /api/templates?visibility=all|public|private
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": [
    {
      "id": "tpl_xxx",
      "name": "模板名称",
      "description": "描述",
      "type": "excel|word",
      "visibility": "public|private",
      "createdBy": "user_id",
      "createdByName": "username",
      "createdAt": "2026-03-17T00:00:00.000Z",
      "fields": [...],
      "styles": {...}
    }
  ]
}
```

#### 获取单个模板
```
GET /api/templates/:id
Authorization: Bearer {token}
```

#### 创建模板
```
POST /api/templates
Authorization: Bearer {token}
Content-Type: application/json

请求体:
{
  "name": "模板名称",
  "description": "模板描述",
  "type": "excel|word",
  "visibility": "public|private",
  "fields": [
    {
      "name": "字段名称",
      "key": "field_key",
      "type": "text|number|date|select|richtext",
      "width": 15  // Excel 列宽
    }
  ],
  "styles": {
    "header": {
      "bold": true,
      "backgroundColor": "#4472C4",
      "color": "#FFFFFF"
    },
    "row": {
      "height": 30
    },
    "border": true
  }
}
```

#### 更新模板
```
PUT /api/templates/:id
Authorization: Bearer {token}
Content-Type: application/json

请求体：同创建模板（只包含需要更新的字段）
```

#### 删除模板
```
DELETE /api/templates/:id
Authorization: Bearer {token}
```

#### 按模板导出
```
GET /api/templates/:id/export?data={JSON 编码的导出数据}
Authorization: Bearer {token}

响应：二进制文件（Excel 或 Word）
Content-Type: application/vnd.openxmlformats-officedocument...
Content-Disposition: attachment; filename="export_..."
```

## 数据模型

### 模板结构
```json
{
  "id": "tpl_unique_id",
  "name": "模板名称",
  "description": "模板描述",
  "type": "excel|word",
  "visibility": "public|private",
  "createdBy": "user_id",
  "createdByName": "username",
  "createdAt": "ISO 日期时间",
  "updatedAt": "ISO 日期时间",
  "fields": [
    {
      "name": "显示名称",
      "key": "数据字段键",
      "type": "字段类型",
      "width": 列宽（Excel 专用）
    }
  ],
  "styles": {
    // Excel 样式
    "header": { "bold", "backgroundColor", "color" },
    "row": { "height" },
    "border": boolean,
    
    // Word 样式
    "heading1": { "bold", "fontSize", "spacing" },
    "paragraph": { "fontSize", "spacing" }
  }
}
```

## 权限控制

- **查看模板**: 
  - 公有模板：所有用户可见
  - 私有模板：仅创建者可见
  - 系统模板：所有用户可见

- **编辑模板**: 仅创建者或管理员

- **删除模板**: 仅创建者或管理员（系统模板不可删除）

- **使用模板导出**: 公有模板和系统模板所有用户可用，私有模板仅创建者可用

## 内置模板

系统预置了 3 个默认模板：

1. **功能测试模板** (Excel)
   - 字段：用例 ID、用例名称、前置条件、操作步骤、预期结果、优先级、测试类型
   - 适用：常规功能测试场景

2. **登录测试模板** (Excel)
   - 字段：测试场景、测试步骤、测试数据、预期结果
   - 适用：登录相关测试

3. **Word 文档模板** (Word)
   - 字段：用例标题、用例 ID、项目、前置条件、测试步骤、预期结果、备注
   - 适用：正式文档导出

## 使用示例

### 1. 访问模板管理页面
```
http://localhost:8001/templates.html
```

### 2. 创建自定义模板
1. 点击"新建模板"按钮
2. 填写模板名称和描述
3. 选择导出类型（Excel/Word）
4. 设置可见性（公有/私有）
5. 添加字段配置
6. 保存模板

### 3. 使用模板导出
1. 在模板列表中找到目标模板
2. 点击"导出"按钮
3. 选择数据范围（全部/选中/筛选）
4. 确认导出，自动下载文件

## 测试

### 运行 API 测试
```bash
cd /home/admin/.openclaw/workspace/web
node test-templates-api.js
```

### 运行导出测试
```bash
cd /home/admin/.openclaw/workspace/web
node test-export.js
```

### 测试结果
所有测试通过：
- ✅ 登录认证
- ✅ 权限控制
- ✅ 模板 CRUD
- ✅ Excel 导出
- ✅ Word 导出

## 依赖库

- `docx` - Word 文档生成
- `xlsx` - Excel 文档生成

## 注意事项

1. **文件名编码**: 为避免编码问题，导出文件名使用 ASCII 字符（中文字符替换为下划线）
2. **模板字段**: 字段键（key）必须与导出数据对象的属性名匹配
3. **权限检查**: 所有模板操作都需要登录认证
4. **系统模板**: 内置模板标记为 `createdBy: "system"`，不可删除

## 后续优化建议

1. 支持模板导入/导出功能
2. 支持模板预览（在线查看效果）
3. 支持更多字段类型（日期、选项、公式等）
4. 支持模板版本管理
5. 支持批量应用模板导出
6. 优化文件名编码，支持 UTF-8 文件名

## 更新日志

### v1.0.0 (2026-03-17)
- ✅ 实现模板 CRUD API
- ✅ 实现模板管理 UI
- ✅ 实现 Excel 导出功能
- ✅ 实现 Word 导出功能
- ✅ 实现权限控制
- ✅ 添加系统内置模板
- ✅ 添加 API 测试脚本
