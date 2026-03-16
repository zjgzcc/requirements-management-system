# 需求管理系统 - 开发规范

## 📋 团队架构

```
首席架构师：云龙虾 1 号 🦞
├── 用户认证模块：Agent-Auth
├── 项目管理模块：Agent-Project
├── 需求管理模块：Agent-Requirement
├── 用例管理模块：Agent-Testcase
├── 追踪矩阵模块：Agent-Trace
├── 基线版本模块：Agent-Baseline
└── 基础设施模块：Agent-Infra
```

---

## 🔧 代码规范

### 1. 文件命名
- **后端 API**: `api-server.js` (统一入口)
- **前端页面**: `kebab-case.html` (如 `requirements.html`)
- **样式文件**: `kebab-case.css`
- **脚本文件**: `kebab-case.js`

### 2. 变量命名
```javascript
// ✅ 正确
const currentUser = null;
let selectedReqs = new Set();
function loadRequirements() {}

// ❌ 错误
const currentuser = null;
let SelectedReqs = new Set();
function LoadRequirements() {}
```

### 3. API 响应格式（统一）
```javascript
// 成功响应
{
  "success": true,
  "message": "操作成功",
  "data: { ... }
}

// 错误响应
{
  "success": false,
  "message": "错误描述"
}
```

### 4. 数据库文件命名
- `users.json` - 用户数据
- `projects.json` - 项目数据
- `requirements.json` - 需求数据
- `testcases.json` - 用例数据
- `traces.json` - 追踪关系
- `headers.json` - 标题层级
- `baselines.json` - 基线版本
- `history.json` - 操作历史
- `prefixes.json` - 前缀设置
- `attachments.json` - 附件信息

---

## 📐 API 设计规范

### RESTful 风格
```
GET    /api/resource          # 获取列表
GET    /api/resource/:id      # 获取单个
POST   /api/resource          # 创建
PUT    /api/resource/:id      # 更新
DELETE /api/resource/:id      # 删除
```

### 查询参数
```
GET /api/requirements?projectId=xxx&headerId=yyy
GET /api/testcases?projectId=xxx&prefix=TC
```

### 请求体格式
```javascript
// 创建
{
  "projectId": "xxx",
  "name": "xxx",
  "description": "xxx"
}

// 更新（只传需要更新的字段）
{
  "description": "new value"
}
```

---

## 🎨 前端规范

### 1. 样式优先级
```css
/* 使用类名，避免 ID 选择器 */
.btn-primary { }
.modal-overlay { }

/* 避免内联样式 */
/* ❌ style="color: red" */
/* ✅ class="text-danger" */
```

### 2. JavaScript 规范
```javascript
// 使用 const/let，避免 var
const API_BASE = 'http://8.215.93.217:8001/api';
let currentProjectId = '';

// 异步函数使用 async/await
async function loadData() {
  const response = await fetch(...);
  const data = await response.json();
}

// 错误处理
try {
  await someOperation();
} catch (error) {
  console.error('操作失败:', error);
  showToast('操作失败', 'error');
}
```

### 3. 组件命名
```javascript
// 模态框 ID
requirementModal
testcaseModal
headerModal

// 数据变量
requirementsData
testcasesData
headersData
```

---

## 📝 注释规范

### 必须注释的场景
1. 复杂业务逻辑
2. API 接口定义
3. 数据结构定义
4. 关键算法

### 注释格式
```javascript
// ===== 用户管理 API =====
// 获取用户列表
// 支持按角色过滤
if (url === '/api/users' && method === 'GET') {
  ...
}

// 密码加密 (SHA-256)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}
```

---

## 🔄 提交流程

### 1. 开发前
- [ ] 阅读本规范
- [ ] 确认 API 接口定义
- [ ] 确认数据结构

### 2. 开发中
- [ ] 遵循代码规范
- [ ] 添加必要注释
- [ ] 本地测试通过

### 3. 提交前
- [ ] 自检代码
- [ ] 测试核心功能
- [ ] 更新相关文档

### 4. 提交内容
```
【模块名称】功能描述

修改内容:
- 新增 XXX 功能
- 修复 XXX bug
- 优化 XXX 性能

测试情况:
- [ ] 创建功能正常
- [ ] 更新功能正常
- [ ] 删除功能正常
- [ ] 列表显示正常
```

---

## 📊 质量检查清单

### 代码质量
- [ ] 无 console.log 调试代码
- [ ] 无未使用的变量
- [ ] 函数长度 < 50 行
- [ ] 适当的错误处理

### 功能完整性
- [ ] CRUD 功能完整
- [ ] 输入验证
- [ ] 错误提示友好
- [ ] 加载状态显示

### 性能
- [ ] 避免重复请求
- [ ] 大数据分页处理
- [ ] 图片/文件压缩上传

---

## 📞 沟通机制

### 每日站会（自动）
- 进度同步
- 问题反馈
- 需要协调的事项

### 代码审查
- 首席架构师审查所有提交
- 审查通过后合并到主分支
- 审查意见 24 小时内反馈

### 紧急问题
- 直接 @首席架构师
- 说明问题现象和影响
- 提供错误日志

---

_最后更新：2026-03-16_
_制定：云龙虾 1 号 - 首席架构师_
