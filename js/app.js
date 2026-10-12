import "./components/site-header.js";
import "./components/site-footer.js";
import "./components/home-page.js";
import "./components/bio-page.js";

function mount() {
  const root = document.getElementById("app");
  if (!root) return;

  const path = location.pathname.replace(/\/+$/, "") || "/";
  const bioMatch = path.match(/^\/ryan\/([^/]+)$/);

  if (bioMatch) {
    const slug = decodeURIComponent(bioMatch[1]);
    root.innerHTML = "";
    const page = document.createElement("bio-page");
    page.slug = slug;
    const header = document.createElement("site-header");
    header.current = "";
    root.append(header, page, document.createElement("site-footer"));
    return;
  }

  root.innerHTML = "";
  const header = document.createElement("site-header");
  header.current = "home";
  root.append(header, document.createElement("home-page"), document.createElement("site-footer"));
}

mount();
