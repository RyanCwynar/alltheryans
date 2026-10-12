import { LitElement, html } from "lit";
import { loadPublishedRyans, loadTags } from "../lib/data.js";
import "./ryan-card.js";

export class ArchivePage extends LitElement {
  static properties = {
    status: { state: true },
    ryans: { state: true },
    tags: { state: true },
    sortKey: { state: true },
    cluster: { state: true },
  };

  constructor() {
    super();
    this.status = "loading";
    this.ryans = [];
    this.tags = [];
    this.sortKey = "name";
    this.cluster = "";
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    const params = new URLSearchParams(location.search);
    this.sortKey = params.get("sort") || "name";
    this.cluster = params.get("tag") || "";
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

  #updateQuery() {
    const url = new URL(location.href);
    if (this.cluster) url.searchParams.set("tag", this.cluster);
    else url.searchParams.delete("tag");
    if (this.sortKey && this.sortKey !== "name") url.searchParams.set("sort", this.sortKey);
    else url.searchParams.delete("sort");
    history.replaceState({}, "", url);
    this.#load();
  }

  #onSort(e) {
    this.sortKey = e.target.value;
    this.#updateQuery();
  }

  #onCluster(e) {
    this.cluster = e.target.value;
    this.#updateQuery();
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading archive…</div>`;
    }
    if (this.status === "error") {
      return html`<div class="error wrap">Could not load the archive. Is the API up?</div>`;
    }

    return html`
      <section class="section">
        <div class="wrap">
          <h2>All the Ryans</h2>
          <p class="lede">
            ${this.ryans.length} published profile${this.ryans.length === 1 ? "" : "s"} from libSQL.
          </p>
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
            <a class="text-link" href="/web/">Ryan web</a>
          </div>
          <div class="ryan-grid">
            ${this.ryans.map((ryan) => html`<ryan-card .ryan=${ryan}></ryan-card>`)}
          </div>
        </div>
      </section>
    `;
  }
}

customElements.define("archive-page", ArchivePage);
