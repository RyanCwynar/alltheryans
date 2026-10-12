import { LitElement, html } from "lit";
import { loadIndex, sortByName, rollNumber } from "../lib/data.js";
import { searchIcon, ADD_RYAN_URL } from "./icons.js";
import "./ryan-card.js";

export class ArchivePage extends LitElement {
  static properties = {
    status: { state: true },
    ryans: { state: true },
    query: { state: true },
  };

  constructor() {
    super();
    this.status = "loading";
    this.ryans = [];
    this.query = "";
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
      this.ryans = sortByName(await loadIndex());
      this.status = "ready";
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  #matches() {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.ryans;
    return this.ryans.filter((r) =>
      [r.name, r.short, r.title].join(" ").toLowerCase().includes(q),
    );
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading archive…</div>`;
    }
    if (this.status === "error") {
      return html`<div class="error wrap">Could not load the archive.</div>`;
    }

    const total = this.ryans.length;
    const shown = this.#matches();
    const q = this.query.trim();

    return html`
      <main class="section">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="eyebrow">The roll call · A–Z</p>
              <h1 class="display big">All ${total} Ryans</h1>
            </div>
            <div class="search">
              <label for="ryan-search">Find a Ryan</label>
              <div class="search-field">
                ${searchIcon}
                <input
                  id="ryan-search"
                  type="search"
                  placeholder="Name or what they do"
                  autocomplete="off"
                  .value=${this.query}
                  @input=${(e) => (this.query = e.target.value)}
                />
              </div>
            </div>
          </div>

          <p class="result-count" aria-live="polite">
            ${q ? `${shown.length} of ${total} match “${q}”` : `${total} profiles, alphabetical`}
          </p>

          ${shown.length
            ? html`<div class="ryan-grid">
                ${shown.map(
                  (ryan) =>
                    html`<ryan-card .ryan=${ryan} no=${rollNumber(this.ryans, ryan.slug)}></ryan-card>`,
                )}
              </div>`
            : html`<div class="empty">
                <p class="title">No Ryan by that name — yet.</p>
                <p>Know one we’re missing? <a href=${ADD_RYAN_URL} rel="noopener">Add a Ryan</a>.</p>
              </div>`}
        </div>
      </main>
    `;
  }
}

customElements.define("archive-page", ArchivePage);
