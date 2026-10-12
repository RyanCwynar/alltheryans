import { LitElement, html } from "lit";
import "./ryan-card.js";

export class TagPage extends LitElement {
  static properties = {
    slug: { type: String },
    status: { state: true },
    tag: { state: true },
    ryans: { state: true },
  };

  constructor() {
    super();
    this.slug = "";
    this.status = "loading";
    this.tag = null;
    this.ryans = [];
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#load();
  }

  async #load() {
    if (!this.slug) return;
    this.status = "loading";
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(this.slug)}?sort=number`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      this.tag = data.tag;
      this.ryans = data.ryans || [];
      this.status = "ready";
      document.title = `${this.tag.label} · All The Ryans`;
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading cluster…</div>`;
    }
    if (this.status === "error" || !this.tag) {
      return html`<div class="error wrap">Could not load this cluster.</div>`;
    }
    return html`
      <section class="section">
        <div class="wrap">
          <p class="eyebrow"><a href="/archive/">Archive</a> / cluster</p>
          <h2>${this.tag.label}</h2>
          <p class="lede">${this.ryans.length} published Ryan${this.ryans.length === 1 ? "" : "s"}.</p>
          <div class="ryan-grid">
            ${this.ryans.map((ryan) => html`<ryan-card .ryan=${ryan}></ryan-card>`)}
          </div>
        </div>
      </section>
    `;
  }
}

customElements.define("tag-page", TagPage);
