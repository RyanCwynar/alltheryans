import { LitElement, html } from "lit";

export class SiteFooter extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <footer class="site-footer">
        <div class="wrap">
          <p>All The Ryans — a curated directory of notable people named Ryan.</p>
          <p><a href="/about/">About & corrections</a></p>
        </div>
      </footer>
    `;
  }
}

customElements.define("site-footer", SiteFooter);
