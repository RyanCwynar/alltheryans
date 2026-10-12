import "./components/site-header.js";
import "./components/site-footer.js";
import "./components/tag-page.js";

function mount() {
  const root = document.getElementById("app");
  if (!root) return;

  const path = location.pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/tag\/([^/]+)$/);
  const slug = match ? decodeURIComponent(match[1]) : "";

  root.innerHTML = "";
  const header = document.createElement("site-header");
  header.current = "archive";
  const page = document.createElement("tag-page");
  page.slug = slug;
  root.append(header, page, document.createElement("site-footer"));
}

mount();
