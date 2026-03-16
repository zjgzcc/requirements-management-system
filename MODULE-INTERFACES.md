# 模块间接口规范

**版本**: v1.0  
**最后更新**: 2026-03-16  
**制定**: 云龙虾 1 号 - 首席架构师

---

## 🎯 设计原则

1. **高内聚低耦合** - 每个模块独立完整，模块间依赖最小化
2. **统一数据格式** - 所有模块使用统一的 JSON 数据结构
3. **事件驱动** - 模块间通过事件通知，避免直接调用
4. **向后兼容** - 接口变更必须保持向后兼容

---

## 📦 模块清单

| 模块名 | 负责人 | 核心职责 | 依赖模块 |
|--------|--------|----------|----------|
| **用户认证** | Agent-Auth | 登录/权限/会话 | 无 |
| **项目管理** | Agent-Project | 项目/标题层级 | 用户认证 |
| **需求管理** | Agent-Requirement | 需求 CRUD/富文本 | 项目、文件上传 |
| **用例管理** | Agent-Testcase | 用例 CRUD/富文本 | 项目、文件上传 |
| **追踪矩阵** | Agent-Trace | 追踪关系/导出 | 需求、用例 |
| **基线版本** | Agent-Baseline | 版本管理/对比 | 需求、用例 |
| **基础设施** | Agent-Infra | 文件上传/API 规范 | 无 |

---

## 🔗 模块间数据流

### 1. 项目 → 需求/用例
```
项目管理模块
    ↓ (创建项目)
projects.json
    ↓ (读取项目 ID)
需求管理模块 / 用例管理模块
```

**接口数据**:
```json
{
  "projectId": "mmsxxx",
  "projectName": "项目名称"
}
```

### 2. 标题层级 → 需求/用例
```
项目管理模块 (标题层级)
    ↓ (创建标题)
headers.json
    ↓ (关联 headerId)
需求管理模块 / 用例管理模块
```

**接口数据**:
```json
{
  "headerId": "header_xxx",
  "headerName": "第一章 引言",
  "headerLevel": 1
}
```

### 3. 文件上传 → 所有模块
```
基础设施模块
    ↓ (上传文件)
uploads/ 目录
    ↓ (返回文件 URL)
需求/用例/任何模块
```

**接口数据**:
```json
{
  "id": "file_xxx",
  "url": "/uploads/1710590000_xxx.png",
  "mimeType": "image/png",
  "size": 102400
}
```

### 4. 需求/用例 → 追踪矩阵
```
需求管理模块 → traces.json ← 用例管理模块
    ↓                        ↓
(创建需求)              (创建用例)
    ↓                        ↓
追踪矩阵模块 (建立关联)
```

**接口数据**:
```json
{
  "requirementId": "req_xxx",
  "testcaseId": "tc_xxx",
  "traceId": "trace_xxx"
}
```

### 5. 需求/用例 → 基线版本
```
需求管理模块 → baselines.json ← 用例管理模块
    ↓                              ↓
(选中需求)                    (选中用例)
    ↓                              ↓
基线版本模块 (创建快照)
```

**接口数据**:
```json
{
  "baselineId": "baseline_xxx",
  "type": "requirement|testcase",
  "itemIds": ["req1", "req2"],
  "version": "V1"
}
```

---

## 📡 共享数据结构

### 项目结构 (所有模块通用)
```javascript
{
  id: string,           // 唯一 ID (时间戳 + 随机)
  projectId: string,    // 所属项目 ID
  createdAt: ISODate,   // 创建时间
  updatedAt: ISODate,   // 更新时间
  createdBy: string     // 创建者用户名
}
```

### 响应格式 (所有 API 统一)
```javascript
// 成功
{
  success: true,
  message?: string,
  data: any
}

// 失败
{
  success: false,
  message: string,
  error?: string
}
```

### 错误码规范
```javascript
// 通用错误码
ERROR_CODES = {
  // 1xxx - 用户认证
  UNAUTHORIZED: 1001,
  FORBIDDEN: 1002,
  
  // 2xxx - 项目
  PROJECT_NOT_FOUND: 2001,
  
  // 3xxx - 需求
  REQUIREMENT_NOT_FOUND: 3001,
  
  // 4xxx - 用例
  TESTCASE_NOT_FOUND: 4001,
  
  // 5xxx - 文件
  FILE_TOO_LARGE: 5001,
  INVALID_FILE_TYPE: 5002,
  
  // 9xxx - 系统
  INTERNAL_ERROR: 9000
}
```

---

## 🔄 事件通知机制

### 事件类型
```javascript
// 需求相关事件
EVENTS = {
  REQUIREMENT_CREATED: 'requirement:created',
  REQUIREMENT_UPDATED: 'requirement:updated',
  REQUIREMENT_DELETED: 'requirement:deleted',
  
  // 用例相关
  TESTCASE_CREATED: 'testcase:created',
  TESTCASE_UPDATED: 'testcase:updated',
  TESTCASE_DELETED: 'testcase:deleted',
  
  // 项目相关
  PROJECT_CREATED: 'project:created',
  PROJECT_DELETED: 'project:deleted',
  
  // 追踪相关
  TRACE_CREATED: 'trace:created',
  TRACE_DELETED: 'trace:deleted'
}
```

### 事件监听示例
```javascript
// 追踪矩阵模块监听需求/用例删除
addEventListener('requirement:deleted', (event) => {
  // 自动删除相关追踪关系
  deleteTracesByRequirement(event.requirementId);
});

addEventListener('testcase:deleted', (event) => {
  // 自动删除相关追踪关系
  deleteTracesByTestcase(event.testcaseId);
});
```

---

## 📝 模块协作流程

### 场景 1: 创建需求并关联标题
```
1. 用户选择项目 → 项目管理模块返回项目列表
2. 用户选择标题 → 项目管理模块返回标题树
3. 用户填写需求 → 需求管理模块创建需求
4. 需求保存 → 触发 REQUIREMENT_CREATED 事件
5. 追踪矩阵模块监听到事件 → 更新矩阵视图
6. 基线模块监听到事件 → 记录到可用列表
```

### 场景 2: 建立追踪关系
```
1. 用户选择需求 → 需求管理模块返回需求列表
2. 用户选择用例 → 用例管理模块返回用例列表
3. 用户点击关联 → 追踪矩阵模块创建追踪关系
4. 追踪保存 → 触发 TRACE_CREATED 事件
5. 需求模块监听到 → 更新需求的追踪计数
6. 用例模块监听到 → 更新用例的追踪状态
```

### 场景 3: 创建基线版本
```
1. 用户选中多个需求 → 需求管理模块返回选中 ID 列表
2. 用户输入版本信息 → 基线模块创建基线
3. 基线保存 → 触发 BASELINE_CREATED 事件
4. 历史模块监听到 → 记录基线创建历史
5. 所有模块刷新 → 显示最新基线列表
```

---

## 🛡️ 数据一致性保障

### 1. 事务处理
```javascript
// 删除需求时的级联操作
async function deleteRequirement(reqId) {
  const transaction = await db.beginTransaction();
  try {
    // 1. 删除需求
    await requirements.delete(reqId);
    
    // 2. 删除相关追踪关系
    await traces.deleteByRequirement(reqId);
    
    // 3. 删除相关文件
    await attachments.deleteByRequirement(reqId);
    
    // 4. 记录历史
    await history.record('delete', 'requirement', reqId);
    
    await transaction.commit();
    
    // 5. 触发事件
    emitEvent('requirement:deleted', { requirementId: reqId });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### 2. 数据验证
```javascript
// 所有模块共用的验证函数
function validateData(type, data) {
  const validators = {
    requirement: () => {
      if (!data.projectId) throw new Error('项目 ID 不能为空');
      if (!data.richContent) throw new Error('需求内容不能为空');
    },
    testcase: () => {
      if (!data.projectId) throw new Error('项目 ID 不能为空');
      if (!data.richContent) throw new Error('用例内容不能为空');
    }
  };
  
  validators[type]();
}
```

### 3. 并发控制
```javascript
// 使用乐观锁防止并发修改
async function updateRequirement(reqId, newData) {
  const req = await requirements.get(reqId);
  
  // 检查版本号
  if (newData.version !== req.version) {
    throw new Error('数据已被其他用户修改，请刷新后重试');
  }
  
  // 更新并递增版本号
  req.version++;
  await requirements.update(reqId, newData);
}
```

---

## 📊 模块依赖图

```
                    ┌─────────────┐
                    │  用户认证   │
                    │  (Auth)     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  项目管理   │
                    │  (Project)  │
                    └──┬─────┬────┘
                       │     │
              ┌────────▼─┐   ├────────┐
              │  需求    │   │  用例  │
              │(Requirement)│ │(Testcase)│
              └────┬─────┘   └────┬───┘
                   │              │
                   └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │  追踪矩阵    │
                   │   (Trace)    │
                   └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │  基线版本    │
                   │  (Baseline)  │
                   └──────────────┘
                   
辅助模块:
┌──────────────┐
│  基础设施    │ ← 所有模块都可调用
│  (Infra)     │   (文件上传、API 规范)
└──────────────┘
```

---

## ✅ 接口兼容性检查清单

### 新增接口时
- [ ] 是否影响现有功能
- [ ] 是否需要更新 API 文档
- [ ] 是否需要通知其他模块负责人
- [ ] 是否保持向后兼容

### 修改接口时
- [ ] 是否提供迁移方案
- [ ] 是否设置过渡期
- [ ] 是否更新版本号
- [ ] 是否测试所有调用方

### 删除接口时
- [ ] 是否确认无调用方
- [ ] 是否提前通知
- [ ] 是否提供替代方案
- [ ] 是否更新文档

---

_所有模块负责人必须遵守此接口规范，确保系统整体协作顺畅_
