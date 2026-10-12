import { LitElement, html } from "lit";
import { loadIndex } from "../lib/data.js";
import "./ryan-card.js";

export class ArchivePage extends LitElement {
  static properties = {
    status: { state: true },
    ryans: { state: true },
  };

  constructor() {
    super();
    this.status = "loading";
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
      const ryans = await loadIndex();
      this.ryans = [...ryans].sort((a, b) => a.name.localeCompare(b.name));
      this.status = "ready";
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading archive…</div>`;
    }
    if (this.status === "error") {
      return html`<div class="error wrap">Could not load the archive.</div>`;
    }

    return html`
      <section class="section">
        <div class="wrap">
          <h2>All the Ryans</h2>
          <p class="lede">${this.ryans.length} profiles, alphabetically. Short labels on the cards; full titles underneath.</p>
          <div class="ryan-grid">
            ${this.ryans.map((ryan) => html`<ryan-card .ryan=${ryan}></ryan-card>`)}
          </div>
        </div>
      </section>
    `;
  }
}

customElements.define("archive-page", ArchivePage);
