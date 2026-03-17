# 修订视图模块 - 使用指南

## 📋 模块概述

修订视图模块用于跟踪和管理需求管理系统中所有对象的变更历史，支持变更标记、修订模式切换、变更历史追溯和修订报告导出。

## 🎯 核心功能

### 1. 变更标记显示

- **新增内容**：绿色边框/背景标记
- **修改内容**：黄色边框/背景标记，显示原值和新值
- **删除内容**：红色删除线标记
- 每个变更都显示时间戳和变更人信息

### 2. 修订模式切换

- **修订视图**：显示所有变更标记（默认）
- **纯净视图**：隐藏变更标记，只显示当前内容
- **仅看变更**：只显示有变更的内容项

### 3. 变更历史追溯

- **时间线视图**：按时间顺序展示所有变更
- **变更链追溯**：追踪字段的完整变更历史
- **快速定位**：点击时间线项快速定位到具体变更
- **详情弹窗**：查看变更的完整信息

### 4. 修订报告

- **修订汇总**：统计变更总数和分布
- **按人统计**：查看每个用户的变更数量
- **按时间统计**：查看每天的变更数量
- **导出报告**：支持 JSON 格式导出

## 🔌 API 接口

### GET /api/revision/:type/:id

获取指定对象的修订历史

**参数：**
- `type` - 对象类型 (requirement/testcase/project)
- `id` - 对象 ID

**响应示例：**
```json
{
  "success": true,
  "message": "获取修订历史成功",
  "data": {
    "objectType": "requirement",
    "objectId": "REQ001",
    "changes": [
      {
        "id": "change_1",
        "type": "modified",
        "field": "description",
        "previousValue": "旧描述",
        "currentValue": "新描述",
        "userId": "user123",
        "userName": "张三",
        "timestamp": 1710720000000,
        "description": "更新需求描述"
      }
    ],
    "total": 1
  }
}
```

### GET /api/revision/:type/:id/changes

获取指定对象的变更列表（简化版）

**参数：**
- `type` - 对象类型
- `id` - 对象 ID

**响应示例：**
```json
{
  "success": true,
  "message": "获取变更列表成功",
  "data": {
    "changes": [...],
    "total": 10
  }
}
```

### POST /api/revision/mark

标记变更

**请求体：**
```json
{
  "objectType": "requirement",
  "objectId": "REQ001",
  "userId": "user123",
  "userName": "张三",
  "description": "批量更新需求字段",
  "changes": [
    {
      "type": "modified",
      "field": "description",
      "previousValue": "旧描述",
      "currentValue": "新描述",
      "description": "根据评审意见修改"
    },
    {
      "type": "added",
      "field": "acceptanceCriteria",
      "currentValue": "新增验收标准",
      "description": "补充验收标准"
    }
  ]
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "标记变更成功",
  "data": {
    "id": "rev_1710720000000_abc123",
    "objectType": "requirement",
    "objectId": "REQ001",
    "userId": "user123",
    "userName": "张三",
    "description": "批量更新需求字段",
    "timestamp": 1710720000000,
    "createdAt": "2024-03-18T00:00:00.000Z",
    "changes": [...]
  }
}
```

### GET /api/revision/report

生成修订报告

**参数：**
- `type` - (可选) 对象类型
- `id` - (可选) 对象 ID

**响应示例：**
```json
{
  "success": true,
  "message": "生成修订报告成功",
  "data": {
    "generatedAt": "2024-03-18T00:00:00.000Z",
    "objectType": "requirement",
    "objectId": "REQ001",
    "summary": {
      "totalRevisions": 5,
      "totalChanges": 15,
      "byType": {
        "added": 5,
        "modified": 8,
        "deleted": 2
      },
      "byUser": {
        "张三": { "added": 3, "modified": 5, "deleted": 1, "total": 9 },
        "李四": { "added": 2, "modified": 3, "deleted": 1, "total": 6 }
      },
      "byDate": {
        "2024-03-17": 8,
        "2024-03-18": 7
      }
    },
    "changes": [...],
    "revisions": [...]
  }
}
```

## 📄 文件结构

```
web/
├── revision-view.html        # 修订视图页面
├── revision-view.js          # 前端渲染逻辑
├── api-server.js             # 后端 API（已集成修订接口）
├── revisions.json            # 修订数据存储
└── REVISION-MODULE-README.md # 本文档
```

## 🚀 使用示例

### 1. 访问修订视图

在浏览器中打开：
```
http://localhost:8001/revision-view.html
```

### 2. 加载修订历史

1. 选择对象类型（需求/测试用例/项目）
2. 输入对象 ID
3. 点击"加载修订"按钮

### 3. 切换视图模式

- 点击"修订视图"：显示所有变更标记
- 点击"纯净视图"：隐藏变更标记
- 点击"仅看变更"：只显示有变更的内容

### 4. 过滤变更

- 勾选/取消勾选变更类型（新增/修改/删除）
- 设置时间范围进行过滤

### 5. 查看变更详情

点击任意变更项或"详情"按钮，查看完整的变更信息。

### 6. 导出修订报告

点击"导出修订报告"按钮，下载 JSON 格式的报告文件。

## 💡 集成示例

### 在需求变更时自动标记

```javascript
// 在更新需求时，同时记录变更
async function updateRequirement(reqId, updates, userId, userName) {
    const oldReq = requirements.find(r => r.id === reqId);
    
    // 执行更新...
    
    // 标记变更
    const changes = [];
    
    if (updates.description && updates.description !== oldReq.description) {
        changes.push({
            type: 'modified',
            field: 'description',
            previousValue: oldReq.description,
            currentValue: updates.description,
            description: '更新需求描述'
        });
    }
    
    if (changes.length > 0) {
        await fetch('/api/revision/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                objectType: 'requirement',
                objectId: reqId,
                userId,
                userName,
                changes
            })
        });
    }
}
```

### 查询对象的修订历史

```javascript
async function getRevisionHistory(objectType, objectId) {
    const response = await fetch(`/api/revision/${objectType}/${objectId}`);
    const result = await response.json();
    
    if (result.success) {
        console.log('修订历史:', result.data);
        return result.data.changes;
    }
    
    return [];
}
```

### 生成修订报告

```javascript
async function generateRevisionReport(objectType, objectId) {
    const url = `/api/revision/report?type=${objectType}&id=${objectId}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success) {
        const report = result.data;
        console.log('修订报告:', report);
        
        // 导出为 JSON 文件
        const blob = new Blob([JSON.stringify(report, null, 2)], 
                             { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        // 触发下载...
    }
}
```

## 🔒 安全注意事项

1. 所有修订操作都会记录审计日志
2. 建议在生产环境中添加权限验证
3. 敏感操作的变更说明应该详细记录
4. 定期备份 revisions.json 文件

## 📊 数据统计

修订模块会自动统计以下数据：

- 总修订数
- 总变更数
- 按类型分布（新增/修改/删除）
- 按用户分布
- 按日期分布

这些数据在修订报告页面可视化展示。

## 🛠️ 故障排除

### 问题：修订历史加载失败

**解决方案：**
1. 检查对象 ID 是否正确
2. 确认 revisions.json 文件存在且可读写
3. 查看服务器日志获取详细错误信息

### 问题：变更标记不显示

**解决方案：**
1. 确认视图模式不是"纯净视图"
2. 检查过滤条件是否排除了该变更类型
3. 刷新页面重新加载数据

### 问题：导出报告失败

**解决方案：**
1. 确保已加载修订数据
2. 检查浏览器是否允许弹窗下载
3. 尝试更换浏览器

## 📝 更新日志

### v1.0.0 (2024-03-18)
- ✅ 实现变更标记显示
- ✅ 实现修订模式切换
- ✅ 实现变更历史追溯
- ✅ 实现修订报告导出
- ✅ 集成到 API 服务器

## 📞 技术支持

如有问题或建议，请联系系统管理员。
