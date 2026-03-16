# 用例管理模块开发文档

**版本**: v1.0  
**开发日期**: 2026-03-16  
**开发者**: Agent-Testcase  
**审核**: 云龙虾 1 号 🦞

---

## 📋 模块概述

用例管理模块是需求管理系统的核心组件之一，提供完整的测试用例创建、编辑、管理和导出功能。

### 核心功能
- ✅ 用例 CRUD（创建/读取/更新/删除）
- ✅ 富文本编辑器集成（Quill.js）
- ✅ 用例层级管理（关联标题）
- ✅ 用例附件管理
- ✅ 用例历史记录
- ✅ 用例导入导出（Excel/CSV/JSON）
- ✅ 用例模板系统
- ✅ 批量操作

---

## 📁 文件结构

```
web/
├── testcases.html          # 用例管理前端页面（新增）
├── api-server.js           # API 服务器（已更新）
├── testcases.json          # 用例数据存储
└── uploads/                # 附件存储目录
```

---

## 🎨 前端功能

### 1. 富文本编辑器

集成 **Quill.js** 富文本编辑器，支持：

#### 文本格式化
- 标题（H1-H6）
- 粗体、斜体、下划线、删除线
- 字体颜色、背景色
- 字体选择
- 对齐方式

#### 列表与缩进
- 有序列表
- 无序列表
- 缩进调整

#### 多媒体内容
- **表格** - 插入和编辑表格
- **图片** - 上传图片并插入
- **视频** - 嵌入视频链接
- **代码块** - 语法高亮的代码块

#### 富文本配置
```javascript
const editorOptions = {
    theme: 'snow',
    modules: {
        toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'font': [] }],
            [{ 'align': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            ['link', 'image', 'video'],
            ['table'],
            ['code-block'],
            ['clean']
        ]
    }
};
```

### 2. 用例模板系统

#### 预定义模板（6 种）
1. **功能测试模板** - 常规功能测试场景
2. **登录测试模板** - 用户登录相关测试
3. **API 测试模板** - 接口测试场景
4. **UI 测试模板** - 界面和交互测试
5. **性能测试模板** - 性能和负载测试
6. **安全测试模板** - 安全性测试场景

#### 自定义模板
- 用户可创建自己的模板
- 模板存储在 localStorage
- 支持模板名称、描述、步骤、预期结果、适用场景

#### 模板使用流程
```
1. 点击"使用模板"按钮
2. 选择所需模板
3. 模板内容自动填充到编辑器
4. 根据需要修改内容
5. 保存为新用例
```

### 3. 批量导入导出

#### Excel 导入
- 支持拖拽上传
- 支持 .xlsx, .xls 格式
- 自动解析 Excel 数据
- 预览导入内容
- 批量创建用例

**Excel 格式要求**:
| 用例 ID | 操作步骤 | 预期结果 | 优先级 | 备注 |
|---------|----------|----------|--------|------|
| (可选)  | (必填)   | (可选)   | (可选) | (可选) |

#### 多格式导出
- **Excel (.xlsx)** - 使用 SheetJS 库生成
- **CSV** - 逗号分隔值文件
- **JSON** - 原始数据格式

#### 导出选项
- 全部用例
- 已选用例

### 4. 批量操作
- 全选/反选
- 批量删除
- 批量导出
- 选中计数显示

### 5. 历史记录
- 查看用例的创建、更新、删除历史
- 显示操作时间和操作人
- 最多显示 50 条记录

---

## 🔌 API 接口

### 基础 CRUD

#### 获取用例列表
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
      "columns": [...],
      "createdAt": "2026-03-16T...",
      "updatedAt": "2026-03-16T..."
    }
  ]
}
```

#### 创建用例
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

#### 更新用例
```
PUT /api/testcases/:id
```

#### 删除用例
```
DELETE /api/testcases/:id
```

### 批量操作 API（新增）

#### 批量导入
```
POST /api/testcases/batch-import
```

**请求体**:
```json
{
  "projectId": "proj_xxx",
  "testcases": [
    {
      "steps": "操作步骤 1",
      "expectedResult": "预期结果 1",
      "richContent": "<p>...</p>"
    },
    {
      "steps": "操作步骤 2",
      "expectedResult": "预期结果 2"
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "message": "导入完成：成功 10/10 条",
  "data": [
    { "success": true, "tcId": "TC-10", "id": "xxx" },
    { "success": true, "tcId": "TC-11", "id": "yyy" }
  ]
}
```

#### 批量导出
```
GET /api/testcases/batch-export?projectId=xxx&format=json|csv&ids=id1,id2,id3
```

**参数**:
- `projectId` - 项目 ID（可选）
- `format` - 导出格式：json, csv（可选，默认 json）
- `ids` - 用例 ID 列表，逗号分隔（可选）

### 模板 API（新增）

#### 获取模板列表
```
GET /api/templates
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "default_functional",
      "name": "功能测试模板",
      "description": "适用于常规功能测试场景",
      "steps": "<p>1. 打开系统/页面</p>...",
      "result": "系统响应符合预期",
      "scenarios": "功能测试，回归测试"
    }
  ]
}
```

### 历史记录 API

#### 获取历史记录
```
GET /api/history?type=testcase&itemId=xxx&limit=50
```

---

## 💾 数据结构

### 用例对象
```javascript
{
  id: string,              // 唯一 ID
  tcId: string,            // 用例编号（如 TC-1）
  projectId: string,       // 所属项目 ID
  prefix: string,          // 前缀（如 TC）
  steps: string,           // 操作步骤（纯文本）
  expectedResult: string,  // 预期结果
  headerId: string|null,   // 关联标题 ID
  richContent: string,     // 富文本内容（HTML）
  attachments: array,      // 附件列表
  columns: array,          // 列数据（兼容旧版）
  createdAt: ISODate,      // 创建时间
  updatedAt: ISODate       // 更新时间
}
```

### 附件对象
```javascript
{
  id: string,              // 文件 ID
  originalName: string,    // 原始文件名
  fileName: string,        // 存储文件名
  mimeType: string,        // MIME 类型
  size: number,            // 文件大小（字节）
  url: string,             // 访问 URL
  uploadedAt: ISODate      // 上传时间
}
```

### 模板对象
```javascript
{
  id: string,              // 模板 ID
  name: string,            // 模板名称
  description: string,     // 模板描述
  steps: string,           // 步骤模板（HTML）
  result: string,          // 预期结果模板
  scenarios: string        // 适用场景
}
```

---

## 🎯 使用指南

### 创建用例

#### 方法 1：从头创建
1. 点击"+ 新建用例"
2. 选择所属标题（可选）
3. 选择 ID 前缀
4. 在富文本编辑器中输入操作步骤
5. 填写预期结果
6. 上传附件（可选）
7. 点击"保存用例"

#### 方法 2：使用模板
1. 点击"使用模板"
2. 选择合适的模板
3. 模板内容自动填充
4. 修改内容
5. 保存

#### 方法 3：批量导入
1. 准备 Excel 文件
2. 点击"导入"
3. 拖拽或选择文件
4. 预览数据
5. 确认导入

### 编辑用例
1. 在用例列表中找到目标用例
2. 点击"编辑"按钮
3. 修改内容
4. 保存

### 删除用例
1. 点击用例的"删除"按钮
2. 确认删除
3. 或用批量删除功能

### 导出用例
1. 点击"导出 Excel"
2. 或切换到"批量导出"标签
3. 选择格式和范围
4. 开始导出

---

## 🔧 技术实现

### 前端技术栈
- **HTML5** - 页面结构
- **CSS3** - 样式和布局
- **JavaScript (ES6+)** - 交互逻辑
- **Quill.js 1.3.6** - 富文本编辑器
- **SheetJS (xlsx)** - Excel 处理

### 后端技术栈
- **Node.js** - 运行环境
- **HTTP 模块** - Web 服务器
- **Formidable** - 文件上传处理
- **Crypto** - 密码加密

### 数据存储
- **JSON 文件** - 本地数据存储
- **文件系统** - 附件存储

---

## 📊 开发规范遵循

### 代码规范 ✅
- 文件命名：kebab-case (testcases.html)
- 变量命名：camelCase
- API 响应：统一格式 { success, message, data }
- 注释：关键功能已添加注释

### API 规范 ✅
- RESTful 风格
- 统一响应格式
- 错误处理完善

### 前端规范 ✅
- 使用类名，避免 ID 选择器
- async/await 异步处理
- 适当的错误处理
- 加载状态显示

---

## 🧪 测试建议

### 功能测试
- [ ] 创建用例（空内容验证）
- [ ] 编辑用例
- [ ] 删除用例
- [ ] 富文本编辑器所有功能
- [ ] 图片/视频上传
- [ ] 表格插入
- [ ] 代码块插入
- [ ] 模板使用
- [ ] 自定义模板创建
- [ ] Excel 导入
- [ ] 多格式导出
- [ ] 批量选择
- [ ] 批量删除
- [ ] 历史记录查看

### 兼容性测试
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### 性能测试
- [ ] 大量用例加载（100+）
- [ ] 大文件上传（接近 50MB）
- [ ] 批量导入大量数据（100+ 条）

---

## 🚀 后续优化建议

### 短期优化
1. **用例评审流程** - 添加用例审核状态
2. **用例版本控制** - 记录用例版本变化
3. **用例评论** - 支持用例讨论
4. **用例收藏** - 常用用例快速访问

### 中期优化
1. **用例自动化** - 关联自动化测试脚本
2. **测试执行** - 在用例管理中添加执行功能
3. **缺陷关联** - 用例与缺陷关联
4. **测试计划** - 用例组成测试计划

### 长期优化
1. **AI 辅助** - AI 生成测试用例
2. **智能推荐** - 基于需求推荐用例
3. **覆盖率分析** - 需求覆盖率统计
4. **测试报告** - 自动生成测试报告

---

## 📞 问题反馈

如有问题或建议，请联系：
- **首席架构师**: 云龙虾 1 号 🦞
- **模块负责人**: Agent-Testcase

---

_最后更新：2026-03-16_  
_制定：Agent-Testcase_
