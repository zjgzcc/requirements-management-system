// ===== 修订视图模块 - 前端逻辑 =====

// 全局状态
let currentRevisionData = null;
let currentViewMode = 'revision';
let currentChanges = [];

// API 基础 URL
const API_BASE = window.location.origin;

/**
 * 加载修订历史
 */
async function loadRevision() {
    const objectType = document.getElementById('objectType').value;
    const objectId = document.getElementById('objectId').value.trim();

    if (!objectId) {
        alert('请输入对象 ID');
        return;
    }

    showLoading(true);
    
    try {
        // 获取修订历史
        const response = await fetch(`${API_BASE}/api/revision/${objectType}/${objectId}`);
        const result = await response.json();

        if (result.success) {
            currentRevisionData = result.data;
            currentChanges = result.data.changes || [];
            renderContent();
            renderTimeline();
            renderStats();
            renderUserStats();
        } else {
            showEmptyState();
            alert(result.message || '加载失败');
        }
    } catch (error) {
        console.error('加载修订失败:', error);
        showEmptyState();
        alert('加载失败：' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * 渲染主内容区域
 */
function renderContent() {
    const contentArea = document.getElementById('contentArea');
    
    if (!currentChanges || currentChanges.length === 0) {
        showEmptyState();
        return;
    }

    let html = '<div class="changes-list">';
    
    const filteredChanges = getFilteredChanges();
    
    filteredChanges.forEach((change, index) => {
        const shouldShow = shouldShowChange(change);
        
        if (shouldShow) {
            const changeClass = getChangeClass(change.type);
            const badgeClass = getBadgeClass(change.type);
            const typeLabel = getChangeTypeLabel(change.type);
            
            html += `
                <div class="${changeClass}" data-change-id="${change.id}" onclick="showChangeDetail('${change.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="margin-bottom: 8px;">
                                <span class="change-type-badge ${badgeClass}">${typeLabel}</span>
                                <strong style="margin-left: 10px;">${escapeHtml(change.field || '内容')}</strong>
                            </div>
                            <div style="color: #333;">
                                ${renderChangeContent(change)}
                            </div>
                        </div>
                        <button style="background: #1a73e8; padding: 4px 12px; font-size: 12px;" onclick="event.stopPropagation(); showChangeDetail('${change.id}')">详情</button>
                    </div>
                    <div class="change-meta">
                        <span>👤 ${escapeHtml(change.userName || '未知用户')}</span>
                        <span>🕐 ${formatDateTime(change.timestamp)}</span>
                        <span>📝 ${escapeHtml(change.description || '')}</span>
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    contentArea.innerHTML = html;
}

/**
 * 渲染变更内容
 */
function renderChangeContent(change) {
    if (currentViewMode === 'clean') {
        // 纯净视图：只显示当前值
        return `<div>${escapeHtml(change.currentValue || '')}</div>`;
    }
    
    switch (change.type) {
        case 'added':
            return `
                <div><strong>新增内容：</strong></div>
                <div>${escapeHtml(change.currentValue || '')}</div>
            `;
        
        case 'modified':
            return `
                <div><strong>原值：</strong><span style="text-decoration: line-through; color: #999;">${escapeHtml(change.previousValue || '')}</span></div>
                <div style="margin-top: 5px;"><strong>新值：</strong>${escapeHtml(change.currentValue || '')}</div>
            `;
        
        case 'deleted':
            return `
                <div><strong>删除内容：</strong></div>
                <div style="text-decoration: line-through; color: #999;">${escapeHtml(change.previousValue || '')}</div>
            `;
        
        default:
            return `<div>${escapeHtml(change.currentValue || '')}</div>`;
    }
}

/**
 * 渲染时间线
 */
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    
    if (!currentChanges || currentChanges.length === 0) {
        timeline.innerHTML = '<p style="color: #999; text-align: center;">暂无变更记录</p>';
        return;
    }

    // 按时间倒序排序
    const sortedChanges = [...currentChanges].sort((a, b) => b.timestamp - a.timestamp);
    
    let html = '';
    sortedChanges.slice(0, 20).forEach(change => {
        const changeClass = change.type;
        const typeLabel = getChangeTypeLabel(change.type);
        
        html += `
            <div class="timeline-item ${changeClass}" onclick="showChangeDetail('${change.id}')" style="cursor: pointer;">
                <div class="timeline-time">${formatDateTime(change.timestamp)}</div>
                <div class="timeline-content">
                    <span class="change-type-badge ${getBadgeClass(change.type)}">${typeLabel}</span>
                    <span style="margin-left: 8px;">${escapeHtml(change.userName || '未知用户')}</span>
                    <div style="margin-top: 5px; color: #666;">${escapeHtml(change.field || '内容变更')}</div>
                </div>
            </div>
        `;
    });
    
    timeline.innerHTML = html;
}

/**
 * 渲染统计数据
 */
function renderStats() {
    const added = currentChanges.filter(c => c.type === 'added').length;
    const modified = currentChanges.filter(c => c.type === 'modified').length;
    const deleted = currentChanges.filter(c => c.type === 'deleted').length;
    const total = currentChanges.length;

    document.getElementById('statAdded').textContent = added;
    document.getElementById('statModified').textContent = modified;
    document.getElementById('statDeleted').textContent = deleted;
    document.getElementById('statTotal').textContent = total;
}

/**
 * 渲染用户统计
 */
function renderUserStats() {
    const userStats = {};
    
    currentChanges.forEach(change => {
        const userName = change.userName || '未知用户';
        if (!userStats[userName]) {
            userStats[userName] = { added: 0, modified: 0, deleted: 0 };
        }
        
        if (change.type === 'added') userStats[userName].added++;
        else if (change.type === 'modified') userStats[userName].modified++;
        else if (change.type === 'deleted') userStats[userName].deleted++;
    });

    const userStatsDiv = document.getElementById('userStats');
    
    if (Object.keys(userStats).length === 0) {
        userStatsDiv.innerHTML = '<p style="color: #999; text-align: center;">暂无用户统计</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    
    Object.entries(userStats).forEach(([userName, stats]) => {
        const total = stats.added + stats.modified + stats.deleted;
        html += `
            <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-weight: 600; margin-bottom: 5px;">${escapeHtml(userName)}</div>
                <div style="font-size: 12px; color: #666;">
                    <span style="color: #34a853;">+${stats.added}</span> | 
                    <span style="color: #f9ab00;">~${stats.modified}</span> | 
                    <span style="color: #ea4335;">-${stats.deleted}</span>
                    <span style="margin-left: 10px; color: #999;">(共 ${total})</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    userStatsDiv.innerHTML = html;
}

/**
 * 应用过滤条件
 */
function applyFilters() {
    renderContent();
}

/**
 * 获取过滤后的变更列表
 */
function getFilteredChanges() {
    let filtered = [...currentChanges];
    
    // 类型过滤
    const showAdded = document.getElementById('filterAdded').checked;
    const showModified = document.getElementById('filterModified').checked;
    const showDeleted = document.getElementById('filterDeleted').checked;
    
    filtered = filtered.filter(change => {
        if (change.type === 'added' && !showAdded) return false;
        if (change.type === 'modified' && !showModified) return false;
        if (change.type === 'deleted' && !showDeleted) return false;
        return true;
    });
    
    // 时间过滤
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filtered = filtered.filter(change => new Date(change.timestamp) >= fromDate);
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(change => new Date(change.timestamp) <= toDate);
    }
    
    return filtered;
}

/**
 * 判断是否显示变更（根据视图模式）
 */
function shouldShowChange(change) {
    if (currentViewMode === 'changes-only') {
        // 仅看变更模式：只显示有实际变更的
        return change.type !== 'view';
    }
    return true;
}

/**
 * 设置视图模式
 */
function setViewMode(mode) {
    currentViewMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.mode-buttons button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    renderContent();
}

/**
 * 显示变更详情
 */
function showChangeDetail(changeId) {
    const change = currentChanges.find(c => c.id === changeId);
    if (!change) return;

    const modal = document.getElementById('changeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    const typeLabel = getChangeTypeLabel(change.type);
    const badgeClass = getBadgeClass(change.type);

    modalTitle.innerHTML = `<span class="change-type-badge ${badgeClass}">${typeLabel}</span> 变更详情`;
    
    modalBody.innerHTML = `
        <div style="display: grid; gap: 15px;">
            <div>
                <strong>变更字段：</strong>
                <div style="margin-top: 5px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                    ${escapeHtml(change.field || '内容')}
                </div>
            </div>
            
            ${change.previousValue ? `
            <div>
                <strong>原值：</strong>
                <div style="margin-top: 5px; padding: 8px; background: #fce8e6; border-radius: 4px; text-decoration: line-through; color: #666;">
                    ${escapeHtml(change.previousValue)}
                </div>
            </div>
            ` : ''}
            
            ${change.currentValue ? `
            <div>
                <strong>新值：</strong>
                <div style="margin-top: 5px; padding: 8px; background: #e6f4ea; border-radius: 4px;">
                    ${escapeHtml(change.currentValue)}
                </div>
            </div>
            ` : ''}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <strong>变更人：</strong>
                    <div style="margin-top: 5px;">${escapeHtml(change.userName || '未知用户')}</div>
                </div>
                <div>
                    <strong>变更时间：</strong>
                    <div style="margin-top: 5px;">${formatDateTime(change.timestamp)}</div>
                </div>
            </div>
            
            ${change.description ? `
            <div>
                <strong>变更说明：</strong>
                <div style="margin-top: 5px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                    ${escapeHtml(change.description)}
                </div>
            </div>
            ` : ''}
            
            <div>
                <strong>对象信息：</strong>
                <div style="margin-top: 5px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 13px;">
                    类型：${change.objectType} | ID: ${change.objectId}
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

/**
 * 关闭弹窗
 */
function closeModal() {
    document.getElementById('changeModal').classList.remove('active');
}

/**
 * 导出修订报告
 */
async function exportReport() {
    const objectType = document.getElementById('objectType').value;
    const objectId = document.getElementById('objectId').value.trim();

    if (!objectId) {
        alert('请先加载修订数据');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/revision/report?type=${objectType}&id=${objectId}`, {
            method: 'GET'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 创建下载链接
            const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `修订报告_${objectType}_${objectId}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('报告已导出');
        } else {
            alert('导出失败：' + result.message);
        }
    } catch (error) {
        console.error('导出报告失败:', error);
        alert('导出失败：' + error.message);
    }
}

// ===== 工具函数 =====

function showLoading(show) {
    document.getElementById('loadingState').style.display = show ? 'block' : 'none';
    if (!show && currentChanges && currentChanges.length > 0) {
        document.getElementById('contentArea').style.display = 'block';
    }
}

function showEmptyState() {
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('contentArea').innerHTML = '';
}

function getChangeClass(type) {
    switch (type) {
        case 'added': return 'change-added';
        case 'modified': return 'change-modified';
        case 'deleted': return 'change-deleted';
        default: return '';
    }
}

function getBadgeClass(type) {
    switch (type) {
        case 'added': return 'badge-added';
        case 'modified': return 'badge-modified';
        case 'deleted': return 'badge-deleted';
        default: return '';
    }
}

function getChangeTypeLabel(type) {
    switch (type) {
        case 'added': return '新增';
        case 'modified': return '修改';
        case 'deleted': return '删除';
        default: return type;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 点击弹窗外部关闭
document.addEventListener('click', function(event) {
    const modal = document.getElementById('changeModal');
    if (event.target === modal) {
        closeModal();
    }
});

// 键盘事件关闭弹窗
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

console.log('修订视图模块已加载');
