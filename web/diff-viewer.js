// ===== 版本差异对比模块 - 前端逻辑 =====

class DiffViewer {
    constructor() {
        this.currentDiff = null;
        this.currentMode = 'requirement';
        this.filterMode = 'all';
        this.version1 = null;
        this.version2 = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadVersions();
    }

    bindEvents() {
        // 对比模式切换
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
        });

        // 版本选择
        document.getElementById('version1-select')?.addEventListener('change', (e) => {
            this.version1 = e.target.value;
            this.checkReadyToCompare();
        });

        document.getElementById('version2-select')?.addEventListener('change', (e) => {
            this.version2 = e.target.value;
            this.checkReadyToCompare();
        });

        // 对比按钮
        document.getElementById('compare-btn')?.addEventListener('click', () => {
            this.performCompare();
        });

        // 过滤器
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterMode = e.target.dataset.filter;
                this.applyFilter();
            });
        });

        // 导出按钮
        document.getElementById('export-word')?.addEventListener('click', () => this.exportReport('word'));
        document.getElementById('export-pdf')?.addEventListener('click', () => this.exportReport('pdf'));
        document.getElementById('export-json')?.addEventListener('click', () => this.exportReport('json'));
    }

    async loadVersions() {
        const mode = this.currentMode;
        const select1 = document.getElementById('version1-select');
        const select2 = document.getElementById('version2-select');

        if (!select1 || !select2) return;

        select1.innerHTML = '<option value="">选择旧版本</option>';
        select2.innerHTML = '<option value="">选择新版本</option>';

        try {
            const response = await fetch(`/api/baselines?type=${mode}`);
            const data = await response.json();

            if (data.success && data.baselines) {
                data.baselines.forEach(baseline => {
                    const option1 = document.createElement('option');
                    option1.value = baseline.id;
                    option1.textContent = `${baseline.name} (${baseline.version})`;
                    select1.appendChild(option1);

                    const option2 = document.createElement('option');
                    option2.value = baseline.id;
                    option2.textContent = `${baseline.name} (${baseline.version})`;
                    select2.appendChild(option2);
                });
            }
        } catch (error) {
            console.error('加载版本失败:', error);
        }
    }

    switchMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        this.loadVersions();
        this.currentDiff = null;
        this.renderDiff();
    }

    checkReadyToCompare() {
        const btn = document.getElementById('compare-btn');
        if (btn) {
            btn.disabled = !(this.version1 && this.version2 && this.version1 !== this.version2);
        }
    }

    async performCompare() {
        if (!this.version1 || !this.version2) {
            alert('请选择两个版本');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`/api/diff/${this.currentMode}/${this.version1}/${this.version2}`);
            const data = await response.json();

            if (data.success) {
                this.currentDiff = data.diff;
                this.renderDiff();
                this.renderStats();
            } else {
                this.showError(data.message || '对比失败');
            }
        } catch (error) {
            console.error('对比失败:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    showLoading() {
        const content = document.getElementById('diff-content');
        if (content) {
            content.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <div>正在对比版本差异...</div>
                </div>
            `;
        }
    }

    showError(message) {
        const content = document.getElementById('diff-content');
        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div>${message}</div>
                </div>
            `;
        }
    }

    renderDiff() {
        const content = document.getElementById('diff-content');
        if (!content || !this.currentDiff) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div>选择两个版本进行对比</div>
                </div>
            `;
            return;
        }

        const diff = this.currentDiff;
        let html = '<div class="diff-split-view">';

        // 旧版本面板
        html += this.renderPanel('旧版本', diff.oldItems, 'old');
        // 新版本面板
        html += this.renderPanel('新版本', diff.newItems, 'new');

        html += '</div>';
        content.innerHTML = html;
    }

    renderPanel(title, items, side) {
        let html = `
            <div class="diff-panel">
                <div class="diff-panel-header">
                    <span>${title}</span>
                    <span class="version-label">${items.length} 项</span>
                </div>
                <div class="diff-content">
        `;

        items.forEach(item => {
            const changeType = this.getChangeType(item, side);
            if (this.shouldFilter(changeType)) return;

            html += `
                <div class="diff-item ${changeType}">
                    <div class="diff-item-header">
                        <span>${item.reqId || item.tcId || item.name || item.id}</span>
                        <div class="diff-actions">
                            ${this.renderActions(item, changeType)}
                        </div>
                    </div>
                    <div class="diff-item-body">
                        ${this.renderItemFields(item, changeType)}
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    }

    getChangeType(item, side) {
        if (!this.currentDiff) return 'unchanged';

        if (side === 'old') {
            if (this.currentDiff.removed.find(r => r.id === item.id)) return 'removed';
            if (this.currentDiff.modified.find(m => m.id === item.id)) return 'modified';
            return 'unchanged';
        } else {
            if (this.currentDiff.added.find(a => a.id === item.id)) return 'added';
            if (this.currentDiff.modified.find(m => m.id === item.id)) return 'modified';
            return 'unchanged';
        }
    }

    shouldFilter(changeType) {
        if (this.filterMode === 'all') return false;
        if (this.filterMode === 'added' && changeType !== 'added') return true;
        if (this.filterMode === 'removed' && changeType !== 'removed') return true;
        if (this.filterMode === 'modified' && changeType !== 'modified') return true;
        if (this.filterMode === 'unchanged' && changeType !== 'unchanged') return true;
        return false;
    }

    renderActions(item, changeType) {
        let html = '';

        if (changeType === 'added' || changeType === 'modified') {
            html += `<button class="action-btn accept" onclick="diffViewer.acceptChange('${item.id}')">✓ 接受</button>`;
        }

        if (changeType === 'removed' || changeType === 'modified') {
            html += `<button class="action-btn reject" onclick="diffViewer.rejectChange('${item.id}')">✗ 拒绝</button>`;
        }

        html += `<button class="action-btn comment" onclick="diffViewer.showComment('${item.id}')">💬 评论</button>`;

        return html;
    }

    renderItemFields(item, changeType) {
        let html = '';

        // 显示描述/名称字段
        if (item.description) {
            html += this.renderField('描述', item.description, changeType);
        }

        if (item.name) {
            html += this.renderField('名称', item.name, changeType);
        }

        if (item.steps) {
            html += this.renderField('步骤', item.steps, changeType);
        }

        if (item.expectedResult) {
            html += this.renderField('预期结果', item.expectedResult, changeType);
        }

        // 显示自定义字段
        if (item.columns && item.columns.length > 0) {
            item.columns.forEach(col => {
                if (col.name && col.value) {
                    html += this.renderField(col.name, col.value, changeType);
                }
            });
        }

        // 显示版本信息
        if (item.createdAt) {
            html += this.renderField('创建时间', new Date(item.createdAt).toLocaleString('zh-CN'));
        }

        if (item.updatedAt) {
            html += this.renderField('更新时间', new Date(item.updatedAt).toLocaleString('zh-CN'));
        }

        return html || '<div style="color:#999;padding:10px;">无内容</div>';
    }

    renderField(label, value, changeType) {
        if (changeType === 'modified' && this.currentDiff.fieldChanges) {
            const fieldChange = this.currentDiff.fieldChanges.find(fc => fc.id === value);
            if (fieldChange) {
                return `
                    <div class="diff-field">
                        <div class="diff-field-label">${label}</div>
                        <div class="field-diff">
                            <div class="old-value">${fieldChange.oldValue || '空'}</div>
                            <div class="new-value">${fieldChange.newValue || '空'}</div>
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="diff-field">
                <div class="diff-field-label">${label}</div>
                <div class="diff-field-value">${this.escapeHtml(value)}</div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderStats() {
        const stats = document.getElementById('diff-stats');
        if (!stats || !this.currentDiff) return;

        const diff = this.currentDiff;
        stats.innerHTML = `
            <div class="stat-item stat-added">
                <span>➕ 新增</span>
                <strong>${diff.added.length}</strong>
            </div>
            <div class="stat-item stat-removed">
                <span>➖ 删除</span>
                <strong>${diff.removed.length}</strong>
            </div>
            <div class="stat-item stat-modified">
                <span>✏️ 修改</span>
                <strong>${diff.modified.length}</strong>
            </div>
            <div class="stat-item stat-unchanged">
                <span>✓ 未变更</span>
                <strong>${diff.unchanged.length}</strong>
            </div>
        `;
    }

    applyFilter() {
        this.renderDiff();
    }

    acceptChange(itemId) {
        console.log('接受变更:', itemId);
        // TODO: 实现接受变更逻辑
        alert(`已接受项目 ${itemId} 的变更`);
    }

    rejectChange(itemId) {
        console.log('拒绝变更:', itemId);
        // TODO: 实现拒绝变更逻辑
        alert(`已拒绝项目 ${itemId} 的变更`);
    }

    showComment(itemId) {
        const commentText = prompt('请输入评论内容:');
        if (commentText) {
            console.log('添加评论:', itemId, commentText);
            // TODO: 实现评论保存逻辑
            alert('评论已添加');
        }
    }

    async exportReport(format) {
        if (!this.currentDiff) {
            alert('请先生成差异对比报告');
            return;
        }

        try {
            const response = await fetch('/api/diff/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mode: this.currentMode,
                    version1: this.version1,
                    version2: this.version2,
                    diff: this.currentDiff,
                    format: format
                })
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `差异报告-${this.currentMode}-${new Date().getTime()}.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败，请稍后重试');
        }
    }
}

// 初始化
const diffViewer = new DiffViewer();
