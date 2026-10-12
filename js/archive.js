import "./components/site-header.js";
import "./components/site-footer.js";
import "./components/archive-page.js";

const root = document.getElementById("app");
if (root) {
  root.innerHTML = "";
  const header = document.createElement("site-header");
  header.current = "archive";
  root.append(header, document.createElement("archive-page"), document.createElement("site-footer"));
}
