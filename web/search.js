/**
 * 全局搜索系统 - Global Search System
 * 支持快速搜索框、搜索结果高亮、搜索历史
 */

class SearchManager {
  constructor() {
    this.SEARCH_HISTORY_KEY = 'search_history';
    this.MAX_HISTORY = 20;
    
    // 搜索历史
    this.history = [];
    
    // 当前搜索结果
    this.currentResults = [];
    
    // 搜索框元素
    this.searchBox = null;
    this.searchInput = null;
    this.searchResults = null;
    
    // 初始化
    this.init();
  }
  
  /**
   * 初始化搜索管理器
   */
  init() {
    this.loadHistory();
    this.createSearchBox();
    this.setupEventListeners();
  }
  
  /**
   * 加载搜索历史
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem(this.SEARCH_HISTORY_KEY);
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.history = [];
    }
  }
  
  /**
   * 保存搜索历史
   */
  saveHistory() {
    try {
      localStorage.setItem(this.SEARCH_HISTORY_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }
  
  /**
   * 创建搜索框 UI
   */
  createSearchBox() {
    // 检查是否已存在
    if (document.getElementById('global-search-box')) {
      return;
    }
    
    const searchBox = document.createElement('div');
    searchBox.id = 'global-search-box';
    searchBox.className = 'modal-overlay';
    searchBox.style.display = 'none';
    searchBox.innerHTML = `
      <div class="modal" style="max-width: 600px; margin-top: 10vh;">
        <div class="modal-body" style="padding: 0;">
          <div style="position: relative; padding: 16px;">
            <svg class="search-icon" style="position: absolute; left: 28px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input 
              type="text" 
              id="global-search-input"
              class="input"
              placeholder="搜索需求、用例、任务、缺陷..."
              style="padding-left: 48px; font-size: 16px;"
              autocomplete="off"
            />
            <kbd style="position: absolute; right: 28px; top: 50%; transform: translateY(-50%); padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; color: var(--text-tertiary);">
              ESC
            </kbd>
          </div>
          
          <!-- 搜索历史 -->
          <div id="search-history" style="padding: 0 16px 16px; max-height: 200px; overflow-y: auto; display: none;">
            <div style="font-size: 12px; color: var(--text-tertiary); padding: 8px 0;">最近搜索</div>
          </div>
          
          <!-- 搜索结果 -->
          <div id="search-results-container" style="border-top: 1px solid var(--border-color); max-height: 400px; overflow-y: auto; display: none;">
            <div id="search-results"></div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(searchBox);
    
    this.searchBox = searchBox;
    this.searchInput = document.getElementById('global-search-input');
    this.searchResults = document.getElementById('search-results');
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听全局搜索事件
    window.addEventListener('globalSearch', () => {
      this.show();
    });
    
    // 监听键盘事件
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.show();
      }
      
      // ESC 关闭搜索
      if (e.key === 'Escape' && this.searchBox && this.searchBox.style.display !== 'none') {
        this.hide();
      }
    });
    
    // 搜索输入事件
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length === 0) {
          this.showHistory();
        } else {
          this.search(query);
        }
      });
      
      // 回车键处理
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = this.searchInput.value.trim();
          if (query) {
            this.addToHistory(query);
            // 触发自定义搜索事件
            const event = new CustomEvent('searchExecute', { detail: { query } });
            window.dispatchEvent(event);
          }
        }
      });
    }
    
    // 点击遮罩层关闭
    if (this.searchBox) {
      this.searchBox.addEventListener('click', (e) => {
        if (e.target === this.searchBox) {
          this.hide();
        }
      });
    }
  }
  
  /**
   * 显示搜索框
   */
  show() {
    if (!this.searchBox) {
      this.createSearchBox();
    }
    
    this.searchBox.style.display = 'flex';
    this.searchInput.value = '';
    this.searchInput.focus();
    
    // 显示搜索历史
    this.showHistory();
  }
  
  /**
   * 隐藏搜索框
   */
  hide() {
    if (this.searchBox) {
      this.searchBox.style.display = 'none';
    }
  }
  
  /**
   * 显示搜索历史
   */
  showHistory() {
    const historyContainer = document.getElementById('search-history');
    const resultsContainer = document.getElementById('search-results-container');
    
    if (!historyContainer || this.history.length === 0) {
      if (historyContainer) historyContainer.style.display = 'none';
      return;
    }
    
    historyContainer.style.display = 'block';
    resultsContainer.style.display = 'none';
    
    let html = '<div style="font-size: 12px; color: var(--text-tertiary); padding: 8px 0;">最近搜索</div>';
    
    this.history.slice(0, 10).forEach((query, index) => {
      html += `
        <div class="search-history-item" 
             style="padding: 8px 12px; cursor: pointer; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;"
             onmouseover="this.style.background='var(--hover-bg)'" 
             onmouseout="this.style.background='transparent'"
             onclick="searchManager.selectHistory('${query.replace(/'/g, "\\'")}')">
          <span style="color: var(--text-secondary);">${query}</span>
          <button onclick="event.stopPropagation(); searchManager.removeHistory(${index})" 
                  style="background: none; border: none; color: var(--text-tertiary); cursor: pointer; font-size: 16px;">
            ×
          </button>
        </div>
      `;
    });
    
    historyContainer.innerHTML = html;
  }
  
  /**
   * 选择历史记录
   * @param {string} query - 搜索词
   */
  selectHistory(query) {
    this.searchInput.value = query;
    this.searchInput.focus();
    this.search(query);
  }
  
  /**
   * 移除历史记录
   * @param {number} index - 历史索引
   */
  removeHistory(index) {
    this.history.splice(index, 1);
    this.saveHistory();
    this.showHistory();
  }
  
  /**
   * 添加到搜索历史
   * @param {string} query - 搜索词
   */
  addToHistory(query) {
    // 移除重复项
    const index = this.history.indexOf(query);
    if (index > -1) {
      this.history.splice(index, 1);
    }
    
    // 添加到开头
    this.history.unshift(query);
    
    // 限制历史记录数量
    if (this.history.length > this.MAX_HISTORY) {
      this.history.pop();
    }
    
    this.saveHistory();
  }
  
  /**
   * 执行搜索
   * @param {string} query - 搜索词
   */
  async search(query) {
    if (!query) {
      this.showHistory();
      return;
    }
    
    const historyContainer = document.getElementById('search-history');
    const resultsContainer = document.getElementById('search-results-container');
    
    historyContainer.style.display = 'none';
    resultsContainer.style.display = 'block';
    
    // 显示加载状态
    this.searchResults.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-tertiary);">
        <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <div style="margin-top: 8px;">搜索中...</div>
      </div>
    `;
    
    try {
      // 触发搜索事件，由具体页面处理
      const event = new CustomEvent('searchRequest', { 
        detail: { 
          query,
          callback: (results) => this.displayResults(results)
        } 
      });
      window.dispatchEvent(event);
      
      // 如果没有监听器，显示默认结果
      setTimeout(() => {
        if (this.searchResults.children.length === 0) {
          this.displayResults([]);
        }
      }, 500);
      
    } catch (error) {
      console.error('搜索失败:', error);
      this.displayResults([]);
    }
  }
  
  /**
   * 显示搜索结果
   * @param {array} results - 搜索结果数组
   */
  displayResults(results) {
    if (!results || results.length === 0) {
      this.searchResults.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-tertiary);">
          <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
          <div>未找到相关结果</div>
          <div style="font-size: 12px; margin-top: 8px;">尝试其他关键词</div>
        </div>
      `;
      return;
    }
    
    this.currentResults = results;
    
    let html = '<div style="padding: 16px;">';
    html += `<div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 12px;">找到 ${results.length} 个结果</div>`;
    
    results.forEach((result, index) => {
      html += `
        <div class="search-result-item" 
             style="padding: 12px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 4px; cursor: pointer;"
             onmouseover="this.style.background='var(--hover-bg)'" 
             onmouseout="this.style.background='var(--bg-secondary)'"
             onclick="searchManager.selectResult(${index})">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 500; color: var(--primary-color);">${result.type || '项目'}</span>
            <span style="font-size: 11px; color: var(--text-tertiary);">${result.date || ''}</span>
          </div>
          <div style="color: var(--text-primary); margin-bottom: 4px;">${this.highlightText(result.title, result.query)}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${result.description || ''}</div>
        </div>
      `;
    });
    
    html += '</div>';
    this.searchResults.innerHTML = html;
  }
  
  /**
   * 高亮搜索文本
   * @param {string} text - 原始文本
   * @param {string} query - 搜索词
   * @returns {string} 高亮后的 HTML
   */
  highlightText(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }
  
  /**
   * 选择搜索结果
   * @param {number} index - 结果索引
   */
  selectResult(index) {
    const result = this.currentResults[index];
    if (result) {
      // 触发自定义事件
      const event = new CustomEvent('searchResultSelect', { detail: result });
      window.dispatchEvent(event);
      
      // 关闭搜索框
      this.hide();
    }
  }
  
  /**
   * 清除搜索历史
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
    this.showHistory();
  }
  
  /**
   * 获取搜索历史
   * @returns {array} 搜索历史数组
   */
  getHistory() {
    return [...this.history];
  }
}

// 添加旋转动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// 创建全局实例
const searchManager = new SearchManager();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SearchManager, searchManager };
}
