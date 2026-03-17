/**
 * 主题切换系统 - Theme Switching System
 * 支持深色/浅色主题及自定义配置
 */

class ThemeManager {
  constructor() {
    this.THEME_KEY = 'user_theme_settings';
    this.CUSTOM_CSS_KEY = 'user_custom_css';
    
    // 默认设置
    this.defaultSettings = {
      theme: 'light', // light, dark, auto
      primaryColor: '#1890ff',
      fontSize: 14,
      lineHeight: 1.5715,
      customCSS: ''
    };
    
    // 当前设置
    this.settings = { ...this.defaultSettings };
    
    // 初始化
    this.init();
  }
  
  /**
   * 初始化主题管理器
   */
  init() {
    this.loadSettings();
    this.applyTheme();
    this.setupSystemThemeListener();
    this.setupEventListeners();
  }
  
  /**
   * 加载用户设置
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved) {
        this.settings = { ...this.defaultSettings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('加载主题设置失败:', error);
      this.settings = { ...this.defaultSettings };
    }
  }
  
  /**
   * 保存用户设置
   */
  saveSettings() {
    try {
      localStorage.setItem(this.THEME_KEY, JSON.stringify(this.settings));
      this.syncToServer();
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  }
  
  /**
   * 同步设置到服务器
   */
  async syncToServer() {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          theme: this.settings.theme,
          primaryColor: this.settings.primaryColor,
          fontSize: this.settings.fontSize,
          lineHeight: this.settings.lineHeight
        })
      });
      
      if (!response.ok) {
        console.warn('同步设置到服务器失败');
      }
    } catch (error) {
      console.warn('网络错误，设置仅保存在本地:', error);
    }
  }
  
  /**
   * 从服务器加载设置
   */
  async loadFromServer() {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const serverSettings = await response.json();
        this.settings = { ...this.defaultSettings, ...serverSettings };
        this.applyTheme();
      }
    } catch (error) {
      console.warn('从服务器加载设置失败，使用本地设置');
    }
  }
  
  /**
   * 应用主题
   */
  applyTheme() {
    const root = document.documentElement;
    
    // 设置主题属性
    root.setAttribute('data-theme', this.settings.theme);
    
    // 应用主色调
    root.style.setProperty('--primary-color', this.settings.primaryColor);
    
    // 计算主色调的悬停和激活状态
    root.style.setProperty('--primary-hover', this.lightenColor(this.settings.primaryColor, 10));
    root.style.setProperty('--primary-active', this.darkenColor(this.settings.primaryColor, 10));
    
    // 应用字体大小
    root.style.setProperty('--font-size-base', `${this.settings.fontSize}px`);
    root.style.setProperty('--font-size-sm', `${Math.max(11, this.settings.fontSize - 2)}px`);
    root.style.setProperty('--font-size-lg', `${this.settings.fontSize + 2}px`);
    root.style.setProperty('--font-size-xl', `${this.settings.fontSize + 6}px`);
    
    // 应用行间距
    root.style.setProperty('--line-height-base', this.settings.lineHeight);
    
    // 应用自定义 CSS
    this.applyCustomCSS();
    
    // 触发事件
    this.dispatchEvent('themeChanged', this.settings);
  }
  
  /**
   * 应用自定义 CSS
   */
  applyCustomCSS() {
    let styleEl = document.getElementById('custom-css-container');
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-css-container';
      document.head.appendChild(styleEl);
    }
    
    styleEl.textContent = this.settings.customCSS || '';
  }
  
  /**
   * 设置主题
   * @param {string} theme - 'light', 'dark', 或 'auto'
   */
  setTheme(theme) {
    if (!['light', 'dark', 'auto'].includes(theme)) {
      console.error('无效的主题类型:', theme);
      return;
    }
    
    this.settings.theme = theme;
    this.saveSettings();
    this.applyTheme();
  }
  
  /**
   * 设置主色调
   * @param {string} color - 十六进制颜色值
   */
  setPrimaryColor(color) {
    this.settings.primaryColor = color;
    this.saveSettings();
    this.applyTheme();
  }
  
  /**
   * 设置字体大小
   * @param {number} size - 字体大小（像素）
   */
  setFontSize(size) {
    this.settings.fontSize = Math.max(11, Math.min(20, size));
    this.saveSettings();
    this.applyTheme();
  }
  
  /**
   * 设置行间距
   * @param {number} height - 行高倍数
   */
  setLineHeight(height) {
    this.settings.lineHeight = Math.max(1.2, Math.min(2.0, height));
    this.saveSettings();
    this.applyTheme();
  }
  
  /**
   * 设置自定义 CSS
   * @param {string} css - CSS 代码
   */
  setCustomCSS(css) {
    this.settings.customCSS = css;
    this.saveSettings();
    this.applyTheme();
  }
  
  /**
   * 获取当前设置
   * @returns {object} 当前设置对象
   */
  getSettings() {
    return { ...this.settings };
  }
  
  /**
   * 重置为默认设置
   */
  resetToDefaults() {
    this.settings = { ...this.defaultSettings };
    this.saveSettings();
    this.applyTheme();
  }
  
  /**
   * 设置系统主题监听器
   */
  setupSystemThemeListener() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e) => {
        if (this.settings.theme === 'auto') {
          this.applyTheme();
        }
      };
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange); // 兼容旧浏览器
      }
    }
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + T: 切换主题
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        this.toggleTheme();
      }
    });
  }
  
  /**
   * 切换主题（浅色 <-> 深色）
   */
  toggleTheme() {
    const currentTheme = this.settings.theme;
    
    if (currentTheme === 'light') {
      this.setTheme('dark');
    } else if (currentTheme === 'dark') {
      this.setTheme('light');
    } else {
      // auto 模式下，根据系统主题切换
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(isDark ? 'light' : 'dark');
    }
  }
  
  /**
   * 颜色变亮
   * @param {string} color - 十六进制颜色
   * @param {number} percent - 百分比
   * @returns {string} 变亮后的颜色
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }
  
  /**
   * 颜色变暗
   * @param {string} color - 十六进制颜色
   * @param {number} percent - 百分比
   * @returns {string} 变暗后的颜色
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }
  
  /**
   * 触发自定义事件
   * @param {string} name - 事件名称
   * @param {any} detail - 事件数据
   */
  dispatchEvent(name, detail) {
    const event = new CustomEvent(name, { detail });
    window.dispatchEvent(event);
  }
  
  /**
   * 获取主题预览数据
   * @returns {array} 主题预览列表
   */
  getThemePreviews() {
    return [
      {
        id: 'light',
        name: '浅色主题',
        description: '明亮清爽，适合白天使用',
        icon: '☀️',
        active: this.settings.theme === 'light'
      },
      {
        id: 'dark',
        name: '深色主题',
        description: '柔和护目，适合夜间使用',
        icon: '🌙',
        active: this.settings.theme === 'dark'
      },
      {
        id: 'auto',
        name: '自动主题',
        description: '跟随系统设置自动切换',
        icon: '🤖',
        active: this.settings.theme === 'auto'
      }
    ];
  }
}

// 创建全局实例
const themeManager = new ThemeManager();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, themeManager };
}
