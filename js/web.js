import "./components/site-header.js";
import "./components/site-footer.js";
import "./components/web-page.js";

const root = document.getElementById("app");
if (root) {
  root.innerHTML = "";
  const header = document.createElement("site-header");
  header.current = "web";
  root.append(header, document.createElement("web-page"), document.createElement("site-footer"));
}
