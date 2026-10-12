import { LitElement, html } from "lit";

export class SiteHeader extends LitElement {
  static properties = {
    current: { type: String },
  };

  createRenderRoot() {
    return this;
  }

  render() {
    const current = this.current || "";
    return html`
      <header>
        <div class="wrap site-nav">
          <a class="brand" href="/">All The <span>Ryans</span></a>
          <nav class="nav-links" aria-label="Primary">
            <a href="/" aria-current=${current === "home" ? "page" : undefined}>Today</a>
            <a href="/archive/" aria-current=${current === "archive" ? "page" : undefined}>Archive</a>
            <a href="/web/" aria-current=${current === "web" ? "page" : undefined}>Web</a>
            <a href="/about/" aria-current=${current === "about" ? "page" : undefined}>About</a>
          </nav>
        </div>
      </header>
    `;
  }
}

customElements.define("site-header", SiteHeader);
