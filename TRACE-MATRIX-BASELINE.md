# 追踪矩阵基线设计方案

> 医疗器械行业追踪矩阵基线管理最佳实践调研
> 创建时间：2026-03-16
> 适用标准：IEC 62304, ISO 13485, FDA 21 CFR Part 820

---

## 一、调研概述

### 1.1 背景

在医疗器械软件开发中，追踪矩阵（Traceability Matrix）是确保需求、设计、实现、测试之间完整可追溯性的核心工具。基线（Baseline）管理则是确保在特定时间点追踪关系不可变、可审计的关键机制。

### 1.2 参考系统调研

| 系统 | 厂商 | 基线实现方式 | 适用场景 |
|------|------|-------------|----------|
| **IBM DOORS** | IBM | 正式基线（Formal Baseline）+ 版本快照 | 需求管理，高合规要求 |
| **Polarion ALM** | Siemens | 基线快照 + 可追溯性锁定 | 医疗器械全生命周期 |
| **Jira + Xray** | Atlassian | 测试计划基线 + 发布版本快照 | 测试管理为主 |
| **ONES.cn** | ONES | 需求基线 + 关联关系冻结 | 国产替代方案 |

---

## 二、追踪矩阵基线的实现方式

### 2.1 基线的核心概念

**基线（Baseline）** = 在特定时间点对追踪矩阵状态的**不可变快照**，包含：
- 所有需求项及其版本
- 所有追踪关系（上游→下游）
- 元数据（创建者、时间、审批状态）

### 2.2 三种基线实现模式

#### 模式 A：快照式基线（Snapshot Baseline）
```
┌─────────────────────────────────────────┐
│  基线 v1.0 (2026-03-16 10:00:00)        │
│  ├─ 需求 R001@v3 → 设计 D001@v2         │
│  ├─ 需求 R002@v1 → 设计 D002@v1         │
│  └─ 设计 D001@v2 → 测试 T001@v1         │
│  [状态：已锁定，不可修改]               │
└─────────────────────────────────────────┘
```

**特点**：
- 完整复制当前所有追踪关系
- 独立存储，与活跃数据分离
- 支持审计和回溯

**适用**：法规提交、设计评审里程碑

#### 模式 B：版本引用式基线（Version-Referenced Baseline）
```
基线 v1.0
  ├─ 指向 需求表@version_hash_abc123
  ├─ 指向 关系表@version_hash_def456
  └─ 元数据：{created_by, timestamp, approval_id}
```

**特点**：
- 不复制数据，仅引用版本标识
- 存储开销小
- 依赖版本控制系统

**适用**：频繁迭代的敏捷开发

#### 模式 C：混合式基线（Hybrid Baseline）⭐推荐
```
基线 = 核心关系快照 + 动态引用
  ├─ 关键追踪关系（需求→测试）→ 完整快照
  ├─ 辅助关系（需求→任务）→ 版本引用
  └─ 变更日志 → 完整记录
```

**特点**：
- 平衡完整性与性能
- 关键路径可审计，非关键路径灵活
- 符合医疗器械风险分级原则

### 2.3 基线触发条件

| 触发事件 | 基线类型 | 自动化程度 |
|---------|---------|-----------|
| 设计评审通过 | 正式基线 | 手动审批后创建 |
| 版本发布 | 发布基线 | 自动创建 |
| 法规提交前 | 提交基线 | 手动审批后创建 |
| 需求变更影响分析 | 临时基线 | 自动创建（分析后丢弃） |

---

## 三、基线版本与追踪矩阵的关系

### 3.1 关系模型

```
┌──────────────────────────────────────────────────────┐
│                  追踪矩阵（活跃）                      │
│  [可增删改] 需求 ←→ 设计 ←→ 实现 ←→ 测试              │
└──────────────────────────────────────────────────────┘
                          │
                          ▼ 基线化（冻结）
┌──────────────────────────────────────────────────────┐
│               基线 v1.0（不可变）                      │
│  [只读] 需求@vX ←→ 设计@vY ←→ 实现@vZ ←→ 测试@vW      │
│  哈希：sha256:abc123...  时间：2026-03-16T10:00:00   │
└──────────────────────────────────────────────────────┘
                          │
                          ▼ 变更后新建
┌──────────────────────────────────────────────────────┐
│               基线 v1.1（不可变）                      │
│  [只读] 需求@vX+1 ←→ 设计@vY+1 ←→ ...                │
│  差异：+2 关系，-1 关系，修改 3 关系                   │
└──────────────────────────────────────────────────────┘
```

### 3.2 版本命名规范

```
基线版本 = <主版本>.<次版本>.<修订版本>-<类型标识>

示例：
  BL-1.0.0-RELEASE    # 正式发布基线
  BL-1.1.0-REVIEW     # 评审基线
  BL-1.0.1-ECR-001    # 工程变更请求相关基线
  BL-2.0.0-DELTA      # 重大变更基线
```

### 3.3 基线生命周期

```
创建 → 审批中 → 已批准 → (归档/废弃)
  │         │         │
  │         │         └─ 可被引用、对比、导出
  │         └─ 审批通过前可撤回
  └─ 自动记录创建者、时间、变更摘要
```

---

## 四、不可变追踪矩阵的设计模式

### 4.1 核心设计原则

1. **写入一次，读取多次（WORM）**
2. **内容寻址（Content-Addressable）**
3. **完整审计追踪（Audit Trail）**
4. **密码学完整性验证**

### 4.2 数据结构设计

#### 4.2.1 基线记录表（baseline_records）

```sql
CREATE TABLE baseline_records (
    baseline_id       VARCHAR(64) PRIMARY KEY,      -- BL-20260316-001
    baseline_version  VARCHAR(32) NOT NULL,         -- 1.0.0
    baseline_type     VARCHAR(32) NOT NULL,         -- RELEASE|REVIEW|SUBMISSION
    project_id        VARCHAR(64) NOT NULL,
    
    -- 状态管理
    status            VARCHAR(16) NOT NULL,         -- DRAFT|PENDING|APPROVED|ARCHIVED
    created_by        VARCHAR(64) NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    approved_by       VARCHAR(64),
    approved_at       TIMESTAMP,
    
    -- 完整性验证
    content_hash      VARCHAR(128) NOT NULL,        -- SHA-256
    previous_baseline_id VARCHAR(64),               -- 链式引用
    
    -- 元数据
    description       TEXT,
    metadata          JSONB,                        -- {regulation: "IEC62304", submission: "510k"}
    
    -- 不可变标记
    is_locked         BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at        TIMESTAMP
);

CREATE INDEX idx_baseline_project ON baseline_records(project_id);
CREATE INDEX idx_baseline_status ON baseline_records(status);
```

#### 4.2.2 基线追踪关系表（baseline_trace_links）

```sql
CREATE TABLE baseline_trace_links (
    id                BIGSERIAL PRIMARY KEY,
    baseline_id       VARCHAR(64) NOT NULL REFERENCES baseline_records(baseline_id),
    
    -- 关系定义
    source_type       VARCHAR(32) NOT NULL,         -- REQUIREMENT|DESIGN|CODE|TEST
    source_id         VARCHAR(64) NOT NULL,
    source_version    VARCHAR(32) NOT NULL,         -- 快照时的版本号
    
    target_type       VARCHAR(32) NOT NULL,
    target_id         VARCHAR(64) NOT NULL,
    target_version    VARCHAR(32) NOT NULL,
    
    -- 关系属性
    link_type         VARCHAR(32) NOT NULL,         -- SATISFIES|VERIFIES|DERIVES|IMPACTS
    link_strength     VARCHAR(16),                  -- STRONG|WEAK|OPTIONAL
    
    -- 审计信息
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(baseline_id, source_type, source_id, source_version, 
           target_type, target_id, target_version, link_type)
);

CREATE INDEX idx_baseline_links_baseline ON baseline_trace_links(baseline_id);
CREATE INDEX idx_baseline_links_source ON baseline_trace_links(source_type, source_id);
CREATE INDEX idx_baseline_links_target ON baseline_trace_links(target_type, target_id);
```

#### 4.2.3 基线项目快照表（baseline_item_snapshots）

```sql
CREATE TABLE baseline_item_snapshots (
    id                BIGSERIAL PRIMARY KEY,
    baseline_id       VARCHAR(64) NOT NULL REFERENCES baseline_records(baseline_id),
    
    item_type         VARCHAR(32) NOT NULL,         -- REQUIREMENT|DESIGN|TEST_CASE
    item_id           VARCHAR(64) NOT NULL,
    item_version      VARCHAR(32) NOT NULL,
    
    -- 快照内容
    item_data         JSONB NOT NULL,               -- 完整的项目数据快照
    item_hash         VARCHAR(128) NOT NULL,        -- 单项哈希
    
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(baseline_id, item_type, item_id, item_version)
);

CREATE INDEX idx_baseline_snapshots_baseline ON baseline_item_snapshots(baseline_id);
```

### 4.3 不可变性实现策略

#### 策略 A：数据库层锁定
```sql
-- 基线创建后设置只读
UPDATE baseline_records SET is_locked = TRUE WHERE baseline_id = 'BL-xxx';

-- 触发器防止修改
CREATE FUNCTION prevent_baseline_modification() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_locked = TRUE THEN
        RAISE EXCEPTION 'Cannot modify locked baseline %', OLD.baseline_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 策略 B：内容寻址存储
```python
def create_baseline_snapshot(trace_links):
    """创建内容寻址的基线快照"""
    import hashlib, json
    
    # 规范化数据（确保一致性）
    normalized = sorted(trace_links, key=lambda x: (x.source_id, x.target_id))
    content = json.dumps(normalized, sort_keys=True, separators=(',', ':'))
    
    # 生成内容哈希
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    
    # 哈希即标识
    baseline_id = f"BL-{content_hash[:16]}"
    
    return {
        'baseline_id': baseline_id,
        'content_hash': content_hash,
        'data': content
    }
```

#### 策略 C：区块链式链式结构
```
基线 v1.0 (hash: abc123)
    ↓ previous_hash: abc123
基线 v1.1 (hash: def456)
    ↓ previous_hash: def456
基线 v2.0 (hash: ghi789)
```

---

## 五、版本对比和差异分析

### 5.1 对比维度

| 对比类型 | 描述 | 输出 |
|---------|------|------|
| **关系新增** | 基线 B 有但基线 A 没有的追踪关系 | +R001→T001 |
| **关系删除** | 基线 A 有但基线 B 没有的追踪关系 | -R002→D001 |
| **关系变更** | 源/目标版本变化的追踪关系 | ~R003@v1→T001@v2 |
| **覆盖度变化** | 需求覆盖率、测试覆盖率变化 | 覆盖率 95%→98% |
| **孤立项检测** | 无上游或下游的孤立项目 | ⚠️ R010 无测试覆盖 |

### 5.2 差异分析算法

```python
def compare_baselines(baseline_a, baseline_b):
    """
    对比两个基线，生成差异报告
    """
    links_a = set((l.source_id, l.target_id, l.link_type) 
                  for l in baseline_a.trace_links)
    links_b = set((l.source_id, l.target_id, l.link_type) 
                  for l in baseline_b.trace_links)
    
    diff = {
        'added': links_b - links_a,
        'removed': links_a - links_b,
        'modified': []
    }
    
    # 检测版本变更（相同关系但版本不同）
    common = links_a & links_b
    for source_id, target_id, link_type in common:
        link_a = get_link(baseline_a, source_id, target_id)
        link_b = get_link(baseline_b, source_id, target_id)
        if link_a.source_version != link_b.source_version or \
           link_a.target_version != link_b.target_version:
            diff['modified'].append({
                'source_id': source_id,
                'target_id': target_id,
                'link_type': link_type,
                'old_versions': (link_a.source_version, link_a.target_version),
                'new_versions': (link_b.source_version, link_b.target_version)
            })
    
    return diff
```

### 5.3 差异报告格式

```markdown
## 基线差异报告

**对比**: BL-1.0.0 → BL-1.1.0
**生成时间**: 2026-03-20 14:30:00

### 变更摘要
| 类型 | 数量 | 详情 |
|------|------|------|
| 新增关系 | +5 | R005→D003, R006→D004, ... |
| 删除关系 | -2 | R002→D001, R003→D002 |
| 版本变更 | ~3 | R001@v2→T001@v3, ... |

### 覆盖率变化
- 需求覆盖率: 92% → 96% (+4%)
- 测试覆盖率: 88% → 94% (+6%)

### 风险提示
⚠️ R010 仍无测试覆盖（连续 2 个基线）
⚠️ D005 变更影响 3 个测试用例，需回归测试

### 审批建议
[ ] 变更合理，批准基线
[ ] 需要进一步审查（原因：_______）
```

### 5.4 可视化对比

```
基线 v1.0                    基线 v1.1
┌─────────────┐            ┌─────────────┐
│   R001@v1   │            │   R001@v2   │  ← 版本升级
│   R002@v1   │───────     │   R002@v1   │
│   R003@v1   │      │     │   R003@v1   │
└─────────────┘      │     └─────────────┘
       │             │            │
       ▼             │            ▼
┌─────────────┐      │     ┌─────────────┐
│   D001@v1   │←─────┘     │   D001@v2   │  ← 设计变更
│   D002@v1   │            │   D002@v1   │
└─────────────┘            └─────────────┘
       │                          │
       ▼                          ▼
┌─────────────┐            ┌─────────────┐
│   T001@v1   │            │   T001@v2   │  ← 测试更新
│   T002@v1   │            │   T002@v1   │
│             │            │   T003@v1   │  ← 新增测试
└─────────────┘            └─────────────┘
```

---

## 六、实现建议

### 6.1 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     应用层                               │
│  基线管理 API | 对比服务 | 审计日志 | 导出服务           │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                     服务层                               │
│  基线创建服务 | 版本控制服务 | 完整性验证服务            │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                     存储层                               │
│  PostgreSQL (关系数据) | S3/OSS (快照文件) | Redis (缓存)│
└─────────────────────────────────────────────────────────┘
```

### 6.2 关键 API 设计

```yaml
POST /api/v1/baselines
  # 创建基线
  body: { project_id, type, description, items: [...] }
  response: { baseline_id, status, content_hash }

GET /api/v1/baselines/{baseline_id}
  # 获取基线详情
  response: { baseline, trace_links, item_snapshots }

GET /api/v1/baselines/{baseline_id}/compare?with={other_baseline_id}
  # 对比两个基线
  response: { diff_summary, added, removed, modified, coverage_change }

POST /api/v1/baselines/{baseline_id}/approve
  # 审批基线
  body: { approver_id, comments }
  response: { status, approved_at }

GET /api/v1/baselines/{baseline_id}/export
  # 导出基线（PDF/Excel/XML）
  query: { format, include_snapshots }
```

### 6.3 医疗器械合规要点

| 法规要求 | 实现方式 |
|---------|---------|
| **21 CFR Part 820.30** - 设计控制 | 基线作为设计评审记录 |
| **IEC 62304** - 软件生命周期 | 基线对应软件版本发布点 |
| **ISO 13485** - 可追溯性 | 基线确保双向追溯完整 |
| **FDA 电子记录** | 基线哈希 + 时间戳 + 审批链 |

### 6.4 性能优化建议

1. **增量基线**：仅存储与上一基线的差异，重建时应用差异链
2. **懒加载快照**：基线列表不加载详细快照，按需获取
3. **异步创建**：基线创建是耗时操作，使用消息队列异步处理
4. **缓存热点**：频繁访问的基线数据缓存到 Redis

### 6.5 安全考虑

```python
# 基线访问控制示例
def check_baseline_access(user, baseline_id, action):
    """
    检查用户是否有权操作基线
    """
    baseline = get_baseline(baseline_id)
    
    # 角色检查
    if user.role == 'REGULATORY':
        return action in ['READ', 'EXPORT', 'APPROVE']
    elif user.role == 'DEVELOPER':
        return action in ['READ', 'CREATE_DRAFT']
    elif user.role == 'QA':
        return action in ['READ', 'CREATE', 'APPROVE', 'EXPORT']
    
    # 项目成员检查
    if not is_project_member(user, baseline.project_id):
        return False
    
    # 审批状态检查
    if baseline.status == 'APPROVED' and action == 'MODIFY':
        return False  # 已批准基线不可修改
    
    return True
```

---

## 七、推荐实施方案

### 7.1 阶段一：基础能力（4-6 周）
- [ ] 基线 CRUD API
- [ ] 追踪关系快照
- [ ] 基础对比功能
- [ ] 审计日志

### 7.2 阶段二：合规增强（4 周）
- [ ] 电子签名集成
- [ ] 导出为监管格式
- [ ] 审批工作流
- [ ] 变更影响分析

### 7.3 阶段三：高级功能（4-6 周）
- [ ] 自动基线触发
- [ ] 智能差异分析
- [ ] 覆盖率仪表盘
- [ ] 与 CI/CD 集成

---

## 八、参考资源

### 8.1 行业标准
- IEC 62304:2006 + AMD1:2015 - 医疗器械软件生命周期
- ISO 13485:2016 - 医疗器械质量管理体系
- FDA 21 CFR Part 820 - 质量体系法规
- FDA Guidance - General Principles of Software Validation

### 8.2 工具参考
- **IBM DOORS Next**: 基线管理最佳实践
- **Polarion ALM**: 医疗器械追溯性指南
- **Jira Xray**: 测试追溯性基线
- **Git LFS**: 大文件版本控制（可用于快照存储）

---

## 附录：术语表

| 术语 | 定义 |
|------|------|
| **基线 (Baseline)** | 在特定时间点冻结的追踪矩阵状态 |
| **追踪矩阵 (Traceability Matrix)** | 展示需求、设计、实现、测试之间关系的矩阵 |
| **快照 (Snapshot)** | 基线创建时的数据完整复制 |
| **不可变 (Immutable)** | 创建后不能被修改的特性 |
| **内容哈希 (Content Hash)** | 基于数据内容生成的唯一标识 |
| **审计追踪 (Audit Trail)** | 记录所有变更的完整历史 |

---

*文档版本：1.0*
*最后更新：2026-03-16*
*作者：云龙虾 1 号 🦞*
