// app.js
// 在页面加载完成后，将侧边栏从骨架占位替换为真实导航内容。
// 设计要点：
// - 如果找不到侧边栏或 nav，什么也不做（防御性编程）
// - 保留 data-i18n 属性，便于以后做国际化替换
// - 使用简单的淡入效果，避免强动画

(function () {
  function restoreSidebar() {
    try {
      const nav = document.querySelector('.sidebar .nav');
      if (!nav) return;

      // 如果已经被替换过，直接返回
      if (nav.dataset.restored === 'true') return;

      // 先淡出（如果当前可见），再替换内容并淡入
      nav.style.transition = 'opacity 180ms ease';
      nav.style.opacity = '0';

      // 等一次帧再修改内容，保证过渡生效
      requestAnimationFrame(() => {
        // 真实导航的 HTML（保留 data-i18n 以便后续 i18n 替换）
        nav.innerHTML = `
          <a class="nav-item active" href="#" data-i18n="nav.home">主页</a>
          <a class="nav-item" href="#" data-i18n="nav.explore">探索</a>
          <a class="nav-item" href="#" data-i18n="nav.notifications">通知</a>
          <a class="nav-item" href="#" data-i18n="nav.profile">个人资料</a>
          <a class="nav-item" href="#" data-i18n="nav.create">发布</a>
        `;

        // 标记为已恢复，避免重复操作
        nav.dataset.restored = 'true';

        // 触发重绘后淡入
        requestAnimationFrame(() => {
          nav.style.opacity = '1';
        });
      });
    } catch (e) {
      // 安静失败，不抛出异常影响主线程
      console.error('restoreSidebar error', e);
    }
  }

  // 页面主脚本：在 DOMContentLoaded 时执行（app.js 在 head 被 deferred 或者在 load 时被插入）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSidebar);
  } else {
    // 已经解析完成
    restoreSidebar();
  }
})();
