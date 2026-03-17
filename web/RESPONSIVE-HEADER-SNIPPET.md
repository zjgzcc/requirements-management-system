<!-- ============================================
     移动端响应式适配 - HTML 头部引用
     将此代码添加到所有 HTML 页面的 <head> 标签中
     ============================================ -->

<!-- 视口设置 (必须) -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes">

<!-- PWA 支持 -->
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#667eea">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="需求管理">

<!-- Apple 图标 -->
<link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png">

<!-- 移动端样式 -->
<link rel="stylesheet" href="/mobile.css">

<!-- 移动端交互脚本 -->
<script src="/mobile.js" defer></script>

<!-- PWA Service Worker 注册 -->
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker 注册成功:', reg.scope))
      .catch(err => console.log('Service Worker 注册失败:', err));
  });
}
</script>

<!-- ============================================
     移动端响应式适配 - HTML 身体结构
     将此代码添加到 <body> 标签开始处
     ============================================ -->

<!-- 汉堡菜单按钮 (添加到 .header 内) -->
<button class="hamburger-menu mobile-only" aria-label="菜单">
  <span></span>
  <span></span>
  <span></span>
</button>

<!-- 移动端侧边导航 (添加到 body 内) -->
<nav class="mobile-sidebar mobile-only">
  <div style="padding: 20px; border-bottom: 1px solid #eee;">
    <div class="logo" style="display: flex; align-items: center; gap: 12px;">
      <span class="logo-icon">🦞</span>
      <h1 style="font-size: 18px; color: #333;">需求管理系统</h1>
    </div>
  </div>
  <div style="padding: 10px 0;">
    <a href="/home.html" style="display: block; padding: 14px 20px; color: #333; text-decoration: none;">🏠 首页</a>
    <a href="/requirements.html" style="display: block; padding: 14px 20px; color: #333; text-decoration: none;">📋 需求</a>
    <a href="/tasks.html" style="display: block; padding: 14px 20px; color: #333; text-decoration: none;">✅ 任务</a>
    <a href="/testcases.html" style="display: block; padding: 14px 20px; color: #333; text-decoration: none;">🧪 测试用例</a>
    <a href="/defects.html" style="display: block; padding: 14px 20px; color: #333; text-decoration: none;">🐛 缺陷</a>
    <a href="/templates.html" style="display: block; padding: 14px 20px; color: #333; text-decoration: none;">📄 模板</a>
    <a href="/audit.html" style="display: block; padding: 14px 20px; color: #333; text-decoration: none;">🔍 审计</a>
  </div>
</nav>

<!-- 侧边栏遮罩层 -->
<div class="sidebar-overlay mobile-only"></div>

<!-- 下拉刷新指示器 (自动由 mobile.js 创建) -->

<!-- 离线指示器 (自动由 mobile.js 创建) -->

<!-- ============================================
     响应式类使用说明
     ============================================ -->
<!--
在现有 HTML 元素上添加以下响应式类:

1. 网格布局:
   - 添加 class="stats-grid" 到统计卡片容器
   - 添加 class="content-grid" 到内容卡片容器
   - 添加 class="grid-2", "grid-3", "grid-4" 到自定义网格

2. 触摸友好按钮:
   - 所有按钮自动应用最小 44px 触摸区域
   - 无需额外修改

3. 表格优化:
   - 将表格包裹在 <div class="table-container"></div> 中
   - 自动支持横向滚动

4. 显示/隐藏:
   - 添加 class="mobile-only" 仅在移动端显示
   - 添加 class="desktop-only" 仅在桌面端显示

5. 下拉刷新:
   - 添加 class="pull-refresh-enabled" 到可刷新区域

6. 触摸反馈:
   - 添加 class="touch-feedback" 到可点击元素
-->
