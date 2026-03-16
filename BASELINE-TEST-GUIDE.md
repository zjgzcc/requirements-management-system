# 基线版本模块 - 功能测试指南

## ✅ 已完成功能

### 1. 版本差异对比功能
**API 端点**: `GET /api/baselines/compare?baselineId1=xxx&baselineId2=yyy`

**功能说明**:
- 比较两个基线版本之间的差异
- 高亮显示新增、删除、修改和未变的项
- 详细展示每个修改项的字段变化（旧值→新值）
- 统计信息：新增数、删除数、修改数、未变数

**前端入口**: 基线版本页面 → "🔍 对比基线" 按钮

**测试步骤**:
1. 创建至少两个基线版本
2. 点击"对比基线"按钮
3. 选择两个不同的基线版本
4. 点击"开始对比"
5. 查看对比结果（颜色编码：绿色=新增，红色=删除，橙色=修改，蓝色=未变）

---

### 2. 版本恢复功能
**API 端点**: `POST /api/baselines/:id/restore`

**功能说明**:
- 将当前数据恢复到某个基线版本的状态
- 支持恢复需求和用例
- 自动记录恢复历史
- 二次确认机制，防止误操作

**前端入口**: 基线卡片 → "↩️ 恢复" 按钮

**测试步骤**:
1. 创建一个基线版本
2. 修改或删除一些需求/用例
3. 找到基线卡片，点击"恢复"按钮
4. 勾选确认复选框
5. 点击"确认恢复"
6. 验证数据已恢复到基线状态

**⚠️ 注意事项**:
- 恢复操作会覆盖当前数据
- 系统会记录恢复历史以便追溯
- 建议恢复前先创建新的基线备份

---

### 3. 基线导出功能（HTML 格式）
**API 端点**: `GET /api/baselines/:id/export`

**功能说明**:
- 导出基线为 HTML 格式（可直接打印为 PDF）
- 包含完整的基线信息和项目详情
- 专业的报告格式，适合归档和分享
- 支持打印优化样式

**前端入口**: 基线卡片 → "📄 导出" 按钮

**测试步骤**:
1. 找到一个基线版本
2. 点击"导出"按钮
3. 浏览器会自动下载 HTML 文件
4. 用浏览器打开文件，可查看或打印为 PDF

**导出内容**:
- 基线基本信息（版本、名称、类型、创建时间等）
- 概要统计（项目数、创建人等）
- 所有包含项目的详细信息

---

## 🎨 UI 改进

### 基线卡片优化
- 添加了操作按钮（恢复、导出）
- 优化了布局，支持点击查看详情
- 响应式设计，适配不同屏幕

### 对比结果展示
- 统计徽章：直观显示变化数量
- 颜色编码：快速识别变更类型
- 折叠设计：未变项可折叠查看
- 详细对比：修改项显示字段级差异

---

## 📝 代码修改清单

### 后端修改 (`api-server.js`)
1. 新增 `findChanges()` 辅助函数 - 比较对象差异
2. 新增 `generateBaselinePDF()` 辅助函数 - 生成导出内容
3. 新增 `GET /api/baselines/compare` - 基线对比接口
4. 新增 `POST /api/baselines/:id/restore` - 基线恢复接口
5. 新增 `GET /api/baselines/:id/export` - 基线导出接口

### 前端修改 (`requirements.html`)
1. 更新基线视图工具栏 - 添加"对比基线"按钮
2. 更新基线卡片 - 添加操作按钮
3. 新增对比选择模态框 - `baselineCompareSelectModal`
4. 新增恢复确认模态框 - `baselineRestoreModal`
5. 新增 JavaScript 函数：
   - `showCompareSelectModal()` - 显示对比选择器
   - `compareBaselines()` - 执行对比
   - `showRestoreModal()` - 显示恢复确认
   - `confirmRestoreBaseline()` - 确认恢复
   - `exportBaseline()` - 导出基线
   - `closeBaselineCompare()` - 关闭对比视图
6. 更新 `showBaselineCompare()` - 增强详情展示
7. 新增 CSS 样式 - 支持小按钮和危险按钮

---

## 🧪 快速测试命令

```bash
# 1. 测试基线对比 API
curl "http://127.0.0.1:8001/api/baselines/compare?baselineId1=BASELINE_ID_1&baselineId2=BASELINE_ID_2"

# 2. 测试基线恢复 API
curl -X POST "http://127.0.0.1:8001/api/baselines/BASELINE_ID/restore"

# 3. 测试基线导出 API
curl "http://127.0.0.1:8001/api/baselines/BASELINE_ID/export" -o baseline.html
```

---

## 📋 测试检查清单

### 功能测试
- [ ] 基线对比功能正常
- [ ] 对比结果准确显示差异
- [ ] 颜色编码正确（新增=绿，删除=红，修改=橙，未变=蓝）
- [ ] 基线恢复功能正常
- [ ] 恢复确认机制有效
- [ ] 恢复后数据正确
- [ ] 基线导出功能正常
- [ ] 导出文件格式正确
- [ ] 导出内容完整

### UI 测试
- [ ] 基线列表显示正常
- [ ] 操作按钮响应正常
- [ ] 模态框弹出/关闭正常
- [ ] 对比结果样式正确
- [ ] 响应式布局正常

### 错误处理
- [ ] 选择相同基线对比时提示错误
- [ ] 未选择基线时提示错误
- [ ] 恢复未确认时按钮禁用
- [ ] 网络错误时显示友好提示

---

## 🚀 部署说明

1. 确保服务器已重启：
```bash
cd /home/admin/.openclaw/workspace/web
pkill -f "node api-server.js"
nohup node api-server.js </dev/null >/tmp/api.log 2>&1 &
```

2. 验证服务器运行：
```bash
curl http://127.0.0.1:8001/api/baselines
```

3. 访问前端页面：
```
http://8.215.93.217:8001/requirements.html
```

---

## 📞 问题反馈

如有问题，请联系：
- 首席架构师：云龙虾 1 号 🦞
- 模块负责人：Agent-Baseline

---

_最后更新：2026-03-16_
_版本：v1.0_
