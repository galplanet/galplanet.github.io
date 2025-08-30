// posts.js
// posts API + 骨架替换逻辑（基于 DeSo GraphQL），挂载到 window.postsAPI 。
// - graphqlRequest: 通用 GraphQL 请求
// - fetchPosts: 使用 GraphQL 拉取帖子并标准化
// - loadPosts: 负责调用 fetchPosts 并将骨架替换为真实内容
(function () {
  const DESO_GRAPHQL = 'https://graphql-prod.deso.com/graphql';

  // 将十六进制（hex）形式的图片数据转换为 base64，并生成 data URL。
  function hexToBase64(hex) {
    if (!hex) return '';
    // 如果已经是 data URL 或包含 base64，则直接返回
    if (/^data:/.test(hex) || /base64,/.test(hex)) return hex;
    // 去掉可选的 0x 前缀
    if (hex.startsWith('0x') || hex.startsWith('0X')) hex = hex.slice(2);
    // 去掉可能的 "\\x" 前缀序列（来自 JSON 编码的 \x.. 表示）
    hex = hex.replace(/\\x/gi, '');
    // 非十六进制字符串直接返回空
    if (!/^[0-9a-fA-F]+$/.test(hex)) return '';
    // 确保长度为偶数
    if (hex.length % 2 === 1) hex = '0' + hex;

    // 将 hex 转为字节数组
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }

    // 把字节数组转为二进制字符串（分块以避免参数长度限制）
    let chunkSize = 0x8000; // 32768
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(slice));
    }
    // 转 base64
    try {
      return btoa(binary);
    } catch (e) {
      return '';
    }
  }

  // 将 hex 解码为 UTF-8 文本（用于识别 hex 编码的 data URL）
  function hexToUtf8String(hex) {
    if (!hex) return '';
    // 移除 0x 和 \x 前缀
    if (hex.startsWith('0x') || hex.startsWith('0X')) hex = hex.slice(2);
    hex = hex.replace(/\\x/gi, '');
    if (!/^[0-9a-fA-F]+$/.test(hex)) return '';
    if (hex.length % 2 === 1) hex = '0' + hex;
    try {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      // TextDecoder 在多数现代浏览器可用
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(bytes);
      }
      // 回退：用 String.fromCharCode
      let str = '';
      for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
      return str;
    } catch (e) { return ''; }
  }

  function profilePicHexToDataUrl(hex) {
    if (!hex) return '';
    if (/^data:/.test(hex) || /base64,/.test(hex)) return hex;
    // 先尝试把 hex 解为 UTF-8 字符串（处理 \x64617461... 这种情况 -> "data:..."）
    const maybeText = hexToUtf8String(hex);
    if (maybeText && (maybeText.startsWith('data:') || maybeText.startsWith('http'))) {
      return maybeText;
    }

    const cleaned = (hex.startsWith('0x') || hex.startsWith('0X')) ? hex.slice(2) : hex;
    const cleaned2 = cleaned.replace(/\\x/gi, '');
    if (!/^[0-9a-fA-F]+$/.test(cleaned2)) return '';
    const header = cleaned2.slice(0, 8).toUpperCase();
    let mime = 'image/png';
    if (header.startsWith('FFD8FF')) mime = 'image/jpeg';
    else if (header.startsWith('89504E47')) mime = 'image/png';
    else if (header.startsWith('47494638')) mime = 'image/gif';

    const b64 = hexToBase64(cleaned2);
    if (!b64) return '';
    return `data:${mime};base64,${b64}`;
  }

  // 将 GraphQL 的 node 映射为渲染所需的标准对象
  function normalizeNode(node) {
    const extra = node.extraData && typeof node.extraData === 'string' ? (function() {
      try { return JSON.parse(node.extraData); } catch (e) { return null; }
    })() : (node.extraData || {});

    const poster = node.poster || node.author || {};
    const posterProfile = (poster && poster.profile) || {};

    // 处理头像：poster.profilePic / poster.profile.profilePic 可能是 hex，需要转换为 data URL
    const rawPic = poster.profilePic || posterProfile.profilePic || (extra && (extra.authorAvatar || extra.avatar)) || '';
    const avatarDataUrl = profilePicHexToDataUrl(rawPic) || (extra && (extra.authorAvatar || extra.avatar)) || '';

    const authorName = poster.username || posterProfile.username || (extra && (extra.author || extra.authorName)) || '匿名';

    return {
      id: node.postHash || node.id || '',
      title: (extra && extra.title) || (node.title || '') || '',
      body: node.body || '',
      excerpt: (node.body || '').slice(0, 160),
      image: (extra && (extra.image || extra.img)) || node.image || null,
      authorName: authorName,
      // 优先使用 poster.profilePic / poster.profile.profilePic（已转换为 data URL），再回退到 extraData
      authorAvatar: avatarDataUrl,
      publishedAt: node.timestamp || node.createdAt || Date.now(),
      // 不再依赖可能不存在的 commentCount 字段，默认 0
      comments: 0
    };
  }

  async function graphqlRequest({ query, variables = {}, signal } = {}) {
    const res = await fetch(DESO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error('GraphQL HTTP error: ' + res.status);
      err.response = payload;
      throw err;
    }
    if (!payload) {
      throw new Error('Empty GraphQL response');
    }
    if (payload.errors && payload.errors.length) {
      const err = new Error('GraphQL errors: ' + JSON.stringify(payload.errors));
      err.response = payload;
      throw err;
    }
    return payload.data;
  }

  // 在 GraphQL 请求之前记录日志，方便排查是否发送了请求
  const _origGraphqlRequest = graphqlRequest;
  graphqlRequest = async function (opts) {
    try {
      console.debug('[posts] graphqlRequest ->', { queryPreview: (opts && opts.query && opts.query.slice(0, 200)) });
    } catch (e) { /* ignore */ }
    return _origGraphqlRequest.call(this, opts);
  };

  // 搜索正文内容的帖子
  async function searchPostsByBody(searchTerm, { limit = 20, signal } = {}) {
    const query = `
      query SearchBody($searchTerm: String!, $first: Int!) {
        posts(first: $first, filter: { body: { includesInsensitive: $searchTerm } }) {
          nodes {
            postHash
            body
            extraData
            timestamp
            poster { username profilePic extraData profile { profilePic username } }
          }
        }
      }
    `;
    const variables = { searchTerm, first: limit };
    const data = await graphqlRequest({ query, variables, signal });
    const nodes = (data && data.posts && Array.isArray(data.posts.nodes)) ? data.posts.nodes : [];
    return nodes.map(normalizeNode);
  }

  async function postsByExtra(extraObj, { limit = 20, signal } = {}) {
    const query = `
      query PostsByExtra($extra: JSON!, $first: Int!) {
        posts(first: $first, filter: { extraData: { contains: $extra } }) {
          nodes { postHash body extraData timestamp poster { username profilePic profile { profilePic username } } }
        }
      }
    `;
    const variables = { extra: extraObj, first: limit };
    const data = await graphqlRequest({ query, variables, signal });
    const nodes = (data && data.posts && Array.isArray(data.posts.nodes)) ? data.posts.nodes : [];
    return nodes.map(normalizeNode);
  }

  async function fetchPostsPage({ first = 20, after = null, signal } = {}) {
    const query = `
      query FetchPostsPage($first: Int!, $after: Cursor) {
        posts(first: $first, after: $after, orderBy: TIMESTAMP_DESC) {
          nodes {
            postHash
            body
            extraData
            timestamp
            poster { username profilePic extraData profile { profilePic username } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const variables = { first, after };
    const data = await graphqlRequest({ query, variables, signal });
    const postsNodes = (data && data.posts && Array.isArray(data.posts.nodes)) ? data.posts.nodes : [];
    const pageInfo = (data && data.posts && data.posts.pageInfo) ? data.posts.pageInfo : { hasNextPage: false, endCursor: null };
    const posts = postsNodes.map(normalizeNode);
    return { posts, pageInfo };
  }

  // 保持向后兼容：fetchPosts 返回数组（只获取第一页或无 after 支持）
  async function fetchPosts({ page = 1, limit = 20, signal } = {}) {
    const res = await fetchPostsPage({ first: limit, after: null, signal });
    return res.posts;
  }

  function createPostElement(post) {
    const article = document.createElement('article');
    article.className = 'card';

    const header = document.createElement('div');
    header.className = 'row between';

    const left = document.createElement('div');
    left.className = 'row';

    const avatar = document.createElement('img');
    avatar.alt = '';
    avatar.width = 44; avatar.height = 44;
    avatar.style.width = '44px'; avatar.style.height = '44px';
    avatar.style.borderRadius = '50%'; avatar.style.objectFit = 'cover';
    avatar.src = post.authorAvatar || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

    const meta = document.createElement('div');
    meta.style.marginLeft = '12px';

    const name = document.createElement('div');
    name.style.fontWeight = '700';
    name.textContent = post.authorName || '匿名';

    const time = document.createElement('div');
    time.style.color = 'var(--muted)'; time.style.fontSize = '13px';
    time.textContent = new Date(post.publishedAt || Date.now()).toLocaleString();

    meta.appendChild(name); meta.appendChild(time);
    left.appendChild(avatar); left.appendChild(meta);

    const right = document.createElement('div');
    right.style.color = 'var(--muted)'; right.style.fontSize = '13px';
    right.textContent = (post.comments || 0) + ' 评论';

    header.appendChild(left); header.appendChild(right);

    const h3 = document.createElement('h3');
    h3.style.marginTop = '12px'; h3.style.marginBottom = '8px';
    h3.textContent = post.title || '';

    const p = document.createElement('p');
    p.style.color = 'var(--muted)'; p.style.margin = '0';
    p.textContent = post.excerpt || '';

    article.appendChild(header);
    article.appendChild(h3);
    article.appendChild(p);

    if (post.image) {
      const img = document.createElement('img');
      img.src = post.image;
      img.style.width = '100%';
      img.style.marginTop = '12px';
      img.style.borderRadius = '12px';
      img.style.objectFit = 'cover';
      article.appendChild(img);
    }

    return article;
  }

  // loadPosts: 请求并替换骨架屏；支持 reset（首次加载）与追加
  function loadPosts({ page = 1, limit = 20, reset = true } = {}) {
    console.debug('[posts] loadPosts called', { page, limit, reset });
    const feed = document.querySelector('.feed');
    if (!feed) return Promise.resolve();

    // 取消之前的请求（如存在）
    // 如果存在最近（1000ms 内）发起且仍在进行的请求，不要中断它以避免首次请求被取消
    if (window.postsAPI && window.postsAPI._currentController) {
      try {
        const prev = window.postsAPI._currentController;
        const started = window.postsAPI._currentControllerStartedAt || 0;
        const age = Date.now() - started;
        if (!prev.signal.aborted && age < 1000) {
          console.debug('[posts] previous request in-flight and recent (' + age + 'ms), skipping new load to avoid cancelling it');
          return Promise.resolve();
        }
        // 否则中断旧请求
        prev.abort();
      } catch (e) { /* ignore */ }
    }

    // 初始化分页状态
    window.postsAPI = window.postsAPI || {};
    window.postsAPI._pagination = window.postsAPI._pagination || { endCursor: null, hasNextPage: true, loading: false };

    if (reset) {
      window.postsAPI._pagination.endCursor = null;
      window.postsAPI._pagination.hasNextPage = true;
    }

    if (!window.postsAPI._pagination.hasNextPage) {
      console.debug('[posts] no more pages');
      return Promise.resolve();
    }

    if (window.postsAPI._pagination.loading) {
      console.debug('[posts] already loading');
      return Promise.resolve();
    }

    const controller = new AbortController();
    const signal = controller.signal;
    window.postsAPI._currentController = controller;
    window.postsAPI._currentControllerStartedAt = Date.now();

    // 第一次加载（reset=true）必须传 null 作为 after，避免把 undefined 或空字符串发送给 GraphQL
    const after = (reset ? null : (window.postsAPI._pagination.endCursor || null));

    return fetchPostsPage({ first: limit, after, signal })
      .then(({ posts, pageInfo }) => {
        if (!posts || posts.length === 0) {
          // 无内容：如果是第一次加载可以保留骨架
          window.postsAPI._pagination.hasNextPage = pageInfo.hasNextPage || false;
          window.postsAPI._pagination.endCursor = pageInfo.endCursor || null;
          return;
        }

        if (reset) feed.innerHTML = '';

        posts.forEach(post => {
          const el = createPostElement(post);
          feed.appendChild(el);
        });

        window.postsAPI._pagination.hasNextPage = !!pageInfo.hasNextPage;
        window.postsAPI._pagination.endCursor = pageInfo.endCursor || null;

        // 如果内容不足一屏且还有下一页，自动加载下一页以填充视口
        try {
          const viewport = window.innerHeight || document.documentElement.clientHeight;
          const fullHeight = document.documentElement.scrollHeight;
          if (window.postsAPI._pagination.hasNextPage && fullHeight <= viewport + 50) {
            // 异步触发下一页加载（不阻塞当前流程）
            setTimeout(() => { try { loadMore({ limit }); } catch (e) { /* ignore */ } }, 50);
          }
        } catch (e) { /* ignore */ }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('posts.loadPosts error', err);
      })
      .finally(() => {
        window.postsAPI._pagination.loading = false;
      });
  }

  // loadMore：向后加载下一页（追加）
  function loadMore({ limit = 20 } = {}) {
    return loadPosts({ page: 1, limit, reset: false });
  }

  function resetPagination() {
    if (window.postsAPI && window.postsAPI._pagination) {
      window.postsAPI._pagination.endCursor = null;
      window.postsAPI._pagination.hasNextPage = true;
    }
  }

  // 在页面滚动到底部附近时自动加载下一页（节流）
  (function attachInfiniteScroll() {
    if (typeof window === 'undefined') return;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          const p = window.postsAPI && window.postsAPI._pagination;
          if (!p || !p.hasNextPage || p.loading) { ticking = false; return; }
          const scrollY = window.scrollY || window.pageYOffset;
          const viewport = window.innerHeight || document.documentElement.clientHeight;
          const fullHeight = document.documentElement.scrollHeight;
          if (fullHeight - (scrollY + viewport) < 300) {
            // 距底部 400px 内触发加载
            loadMore();
          }
        } catch (e) { /* ignore */ }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  // 暴露到全局，方便非模块加载场景使用
  window.postsAPI = Object.assign(window.postsAPI || {}, {
    fetchPosts,
    fetchPostsPage,
    loadPosts,
    loadMore,
    resetPagination,
    searchPostsByBody,
    postsByExtra
  });

  // 自动在页面加载后触发一次 loadPosts（等待 .feed 出现再调用，带超时）
  (function autoLoadWhenReady() {
    if (window.__posts_auto_loaded) return;
    window.__posts_auto_loaded = true;

    function waitForFeedAndLoad({ interval = 200, timeout = 8000 } = {}) {
      const start = Date.now();
      return new Promise(resolve => {
        const tick = () => {
          const feed = document.querySelector('.feed');
          const apiReady = window.postsAPI && typeof window.postsAPI.loadPosts === 'function';
          if (feed && apiReady) {
            try { window.postsAPI.loadPosts(); } catch (e) { console.error(e); }
            return resolve(true);
          }
          if (Date.now() - start >= timeout) return resolve(false);
          setTimeout(tick, interval);
        };
        tick();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        waitForFeedAndLoad();
      });
    } else {
      // already loaded
      setTimeout(() => { waitForFeedAndLoad(); }, 0);
    }
  })();

})();
