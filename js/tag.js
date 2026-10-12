import "./components/site-header.js";
import "./components/site-footer.js";
import "./components/tag-page.js";

const root = document.getElementById("app");
if (root) {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/tag\/([^/]+)$/);
  root.innerHTML = "";
  const header = document.createElement("site-header");
  header.current = "archive";
  const page = document.createElement("tag-page");
  page.slug = match ? decodeURIComponent(match[1]) : "";
  root.append(header, page, document.createElement("site-footer"));
}
