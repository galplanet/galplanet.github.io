// app.js
document.addEventListener("DOMContentLoaded", () => {
  // 找到所有 skeleton
  const skeletons = document.querySelectorAll(".skel");

  // 给每个 skeleton 设置渐变背景（覆盖掉静态 CSS）
  skeletons.forEach(el => {
    el.style.background = "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)";
    el.style.backgroundSize = "200% 100%";
    el.style.transition = "background-position 0.2s linear";
  });

  // 用 JS 循环模拟 shimmer
  let offset = 0;
  setInterval(() => {
    offset = (offset + 5) % 200;
    skeletons.forEach(el => {
      el.style.backgroundPosition = `${offset}% 0`;
    });
  }, 60); // 每60ms刷新一次，大约16fps
  

  // ========== 左边栏 SVG 图标 ==========
  const icons = {
    home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z"></path>
           </svg>`,
    explore: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M14.31 8.3l-5.66 2.36a1 1 0 0 0-.55.55L5.74 16.9a.25.25 0 0 0 .35.35l5.69-2.37a1 1 0 0 0 .55-.55l2.36-5.66a.25.25 0 0 0-.38-.38z"></path>
              </svg>`,
    bell: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M18 8a6 6 0 0 1 3 5v4"></path>
             <path d="M3 17v-4a6 6 0 0 1 3-5"></path>
             <circle cx="12" cy="19" r="2"></circle>
           </svg>`,
    user: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
             <circle cx="12" cy="7" r="4"></circle>
           </svg>`,
    post: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M12 20h9"></path>
             <path d="M12 4v16"></path>
             <path d="M5 12h7"></path>
           </svg>`
  };

  const navItems = document.querySelectorAll(".nav-item");
  if (navItems.length >= 5) {
    navItems[0].insertAdjacentHTML("afterbegin", icons.home);
    navItems[1].insertAdjacentHTML("afterbegin", icons.explore);
    navItems[2].insertAdjacentHTML("afterbegin", icons.bell);
    navItems[3].insertAdjacentHTML("afterbegin", icons.user);
    navItems[4].insertAdjacentHTML("afterbegin", icons.post);
  }
});
