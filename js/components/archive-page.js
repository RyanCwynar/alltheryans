import { LitElement, html } from "lit";
import { loadPublishedRyans, loadTags } from "../lib/data.js";
import { searchIcon, ADD_RYAN_URL } from "./icons.js";
import "./ryan-card.js";

export class ArchivePage extends LitElement {
  static properties = {
    status: { state: true },
    ryans: { state: true },
    tags: { state: true },
    sortKey: { state: true },
    cluster: { state: true },
    query: { state: true },
  };

  constructor() {
    super();
    this.status = "loading";
    this.ryans = [];
    this.tags = [];
    this.sortKey = "name";
    this.cluster = "";
    this.query = "";
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    const params = new URLSearchParams(location.search);
    this.sortKey = params.get("sort") || "name";
    this.cluster = params.get("tag") || "";
    this.query = params.get("q") || "";
    this.#load();
  }

  async #load() {
    try {
      const [ryans, tags] = await Promise.all([
        loadPublishedRyans({ tag: this.cluster || undefined, sort: this.sortKey }),
        loadTags(),
      ]);
      this.ryans = ryans;
      this.tags = tags;
      this.status = "ready";
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  #syncUrl() {
    const url = new URL(location.href);
    const set = (k, v) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set("tag", this.cluster);
    set("sort", this.sortKey !== "name" ? this.sortKey : "");
    set("q", this.query.trim());
    history.replaceState({}, "", url);
  }

  #onSort(e) {
    this.sortKey = e.target.value;
    this.#syncUrl();
    this.#load();
  }

  #onCluster(e) {
    this.cluster = e.target.value;
    this.#syncUrl();
    this.#load();
  }

  #onQuery(e) {
    this.query = e.target.value;
    this.#syncUrl();
  }

  #matches() {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.ryans;
    return this.ryans.filter((r) =>
      [r.name, r.short, r.title, r.lead_summary].join(" ").toLowerCase().includes(q),
    );
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading archive…</div>`;
    }
    if (this.status === "error") {
      return html`<div class="error wrap">Could not load the archive. Is the API up?</div>`;
    }

    const total = this.ryans.length;
    const shown = this.#matches();
    const q = this.query.trim();
    const tag = this.tags.find((t) => t.slug === this.cluster);

    return html`
      <main class="section">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="eyebrow">The roll call${tag ? ` · ${tag.label}` : ""}</p>
              <h1 class="display big">All ${total} Ryan${total === 1 ? "" : "s"}</h1>
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
                  @input=${this.#onQuery}
                />
              </div>
            </div>
          </div>

          <div class="toolbar">
            <label>
              <span>Cluster</span>
              <select @change=${this.#onCluster}>
                <option value="" ?selected=${!this.cluster}>All</option>
                ${this.tags.map(
                  (t) => html`<option value=${t.slug} ?selected=${this.cluster === t.slug}>
                    ${t.label} (${t.count})
                  </option>`,
                )}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select @change=${this.#onSort}>
                <option value="name" ?selected=${this.sortKey === "name"}>Name</option>
                <option value="number" ?selected=${this.sortKey === "number"}>Series #</option>
                <option value="birth" ?selected=${this.sortKey === "birth"}>Birth year</option>
                <option value="connections" ?selected=${this.sortKey === "connections"}>Connections</option>
              </select>
            </label>
            <p class="result-count" aria-live="polite">
              ${q ? `${shown.length} of ${total} match “${q}”` : `${total} published profiles`}
            </p>
            <a class="text-link" href="/web/">See the Ryan web →</a>
          </div>

          ${shown.length
            ? html`<div class="ryan-grid">
                ${shown.map((ryan) => html`<ryan-card .ryan=${ryan}></ryan-card>`)}
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
