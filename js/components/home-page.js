import { LitElement, html } from "lit";
import { loadPublishedRyans, pickRyanOfDay } from "../lib/data.js";
import { cardShort, initials } from "../lib/parse.js";
import "./ryan-card.js";

export class HomePage extends LitElement {
  static properties = {
    status: { state: true },
    featured: { state: true },
    ryans: { state: true },
  };

  constructor() {
    super();
    this.status = "loading";
    this.featured = null;
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
    try {
      const ryans = await loadPublishedRyans();
      this.ryans = [...ryans].sort((a, b) => a.name.localeCompare(b.name));
      this.featured = pickRyanOfDay(ryans);
      this.status = "ready";
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading Ryans…</div>`;
    }
    if (this.status === "error" || !this.featured) {
      return html`<div class="error wrap">Could not load the Ryan directory. Is the API up?</div>`;
    }

    const ryan = this.featured;
    const short = cardShort(ryan);
    const preview = this.ryans.slice(0, 6);

    return html`
      <section class="hero" aria-label="Ryan of the day">
        <div class="hero-media">
          ${ryan.photo
            ? html`<img src=${ryan.photo} alt="" width="1600" height="1000" />`
            : html`<div class="initials" aria-hidden="true">${initials(ryan.name)}</div>`}
        </div>
        <div class="hero-inner">
          <p class="hero-brand">All The Ryans</p>
          <h1>${ryan.name}</h1>
          <p>${short || ryan.title || "Today’s Ryan, picked for the São Paulo calendar."}</p>
          <div class="cta-row">
            <a class="btn btn-primary" href="/ryan/${ryan.slug}">Read the bio</a>
            <a class="btn btn-ghost" href="/archive/">Browse the archive</a>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <h2>More Ryans</h2>
          <p class="lede">Published profiles from libSQL. Drafts stay off the public API.</p>
          <div class="ryan-grid">
            ${preview.map((item) => html`<ryan-card .ryan=${item}></ryan-card>`)}
          </div>
          <p style="margin-top:1.75rem;display:flex;flex-wrap:wrap;gap:0.75rem">
            <a class="btn btn-primary" href="/archive/" style="background:var(--sea);color:#fff">See all ${this.ryans.length}</a>
            <a class="btn btn-ghost" href="/web/" style="color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)">Ryan web</a>
          </p>
        </div>
      </section>
    `;
  }
}

customElements.define("home-page", HomePage);
