import "./components/site-header.js";
import "./components/site-footer.js";
import "./components/about-page.js";

const root = document.getElementById("app");
if (root) {
  root.innerHTML = "";
  const header = document.createElement("site-header");
  header.current = "about";
  root.append(header, document.createElement("about-page"), document.createElement("site-footer"));
}
