import { LitElement, html } from "lit";
import {
  loadPublishedRyans,
  loadTags,
  sortRyans,
  filterByCluster,
} from "../lib/data.js";
import "./ryan-card.js";

export class TagPage extends LitElement {
  static properties = {
    slug: { type: String },
    status: { state: true },
    tag: { state: true },
    ryans: { state: true },
    sortKey: { state: true },
  };

  constructor() {
    super();
    this.slug = "";
    this.status = "loading";
    this.tag = null;
    this.ryans = [];
    this.sortKey = "number";
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#load();
  }

  updated(changed) {
    if (changed.has("slug") && changed.get("slug") !== undefined) {
      this.#load();
    }
  }

  async #load() {
    if (!this.slug) return;
    this.status = "loading";
    try {
      const [ryans, tags] = await Promise.all([loadPublishedRyans(), loadTags()]);
      this.tag = tags.find((t) => t.slug === this.slug) || {
        slug: this.slug,
        label: `${this.slug} Ryans`,
        count: 0,
      };
      this.ryans = sortRyans(filterByCluster(ryans, this.slug), this.sortKey);
      this.tag = { ...this.tag, count: this.ryans.length };
      this.status = "ready";
      document.title = `${this.tag.label} · All The Ryans`;
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  #onSort(e) {
    this.sortKey = e.target.value;
    this.ryans = sortRyans(this.ryans, this.sortKey);
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading cluster…</div>`;
    }
    if (this.status === "error") {
      return html`<div class="error wrap">Could not load this cluster.</div>`;
    }

    return html`
      <section class="section">
        <div class="wrap">
          <p class="eyebrow"><a href="/archive/">Archive</a> / cluster</p>
          <h2>${this.tag.label}</h2>
          <p class="lede">
            ${this.ryans.length} published Ryan${this.ryans.length === 1 ? "" : "s"} tagged
            <code>${this.slug}</code>.
          </p>
          <div class="toolbar">
            <label>
              <span>Sort</span>
              <select @change=${this.#onSort}>
                <option value="number" ?selected=${this.sortKey === "number"}>Series #</option>
                <option value="name" ?selected=${this.sortKey === "name"}>Name</option>
                <option value="birth" ?selected=${this.sortKey === "birth"}>Birth year</option>
                <option value="connections" ?selected=${this.sortKey === "connections"}>Connections</option>
              </select>
            </label>
            <a class="text-link" href="/web/">Ryan web</a>
          </div>
          ${this.ryans.length
            ? html`<div class="ryan-grid">
                ${this.ryans.map((ryan) => html`<ryan-card .ryan=${ryan}></ryan-card>`)}
              </div>`
            : html`<p>No published Ryans in this cluster yet.</p>`}
        </div>
      </section>
    `;
  }
}

customElements.define("tag-page", TagPage);
