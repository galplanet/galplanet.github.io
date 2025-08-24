async function fetchLatestPosts() {
  const query = `
    query GetLatest10Posts {
      posts(first: 10, orderBy: TIMESTAMP_DESC) {
        nodes {
          postHash
          body
          poster { username }
        }
      }
    }
  `;

  const res = await fetch("https://graphql-prod.deso.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });

  const json = await res.json();
  return json.data?.posts?.nodes || [];
}

function createPostCard(post) {
  const card = document.createElement("article");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "row between";

  const user = document.createElement("strong");
  user.textContent = post.poster?.username || "匿名";

  header.appendChild(user);
  card.appendChild(header);

  const body = document.createElement("div");
  body.style.marginTop = "12px";
  body.style.whiteSpace = "pre-wrap";

  const fullText = post.body || "";
  const maxLen = 180; // 过长自动折叠
  if (fullText.length > maxLen) {
    const shortText = fullText.slice(0, maxLen) + "…";
    const span = document.createElement("span");
    span.textContent = shortText;

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "展开";
    toggleBtn.style.marginLeft = "8px";
    toggleBtn.style.color = "var(--primary)";
    toggleBtn.style.border = "none";
    toggleBtn.style.background = "transparent";
    toggleBtn.style.cursor = "pointer";

    let expanded = false;
    toggleBtn.addEventListener("click", () => {
      expanded = !expanded;
      span.textContent = expanded ? fullText : shortText;
      toggleBtn.textContent = expanded ? "收起" : "展开";
    });

    body.appendChild(span);
    body.appendChild(toggleBtn);
  } else {
    body.textContent = fullText;
  }

  card.appendChild(body);

  return card;
}

async function init() {
  const feed = document.querySelector(".feed");
  feed.innerHTML = ""; // 清空骨架屏

  const posts = await fetchLatestPosts();
  posts.forEach(post => {
    feed.appendChild(createPostCard(post));
  });
}

document.addEventListener("DOMContentLoaded", init);
