import { LitElement, html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadRyanMarkdown } from "../lib/data.js";
import {
  renderMarkdown,
  initials,
  normalizeSources,
  photoCreditLine,
} from "../lib/parse.js";

export class BioPage extends LitElement {
  static properties = {
    slug: { type: String },
    status: { state: true },
    ryan: { state: true },
  };

  constructor() {
    super();
    this.slug = "";
    this.status = "loading";
    this.ryan = null;
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
      const ryan = await loadRyanMarkdown(this.slug);
      this.ryan = ryan;
      this.status = "ready";
      document.title = `${ryan.name} · All The Ryans`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) {
        desc.setAttribute(
          "content",
          (ryan.title || ryan.short || ryan.lead_summary || `Bio of ${ryan.name}`).toString(),
        );
      }
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading Ryan…</div>`;
    }
    if (this.status === "error" || !this.ryan) {
      return html`
        <div class="error wrap">
          <p>That Ryan isn’t published.</p>
          <p><a href="/archive/">Back to the archive</a></p>
        </div>
      `;
    }

    const ryan = this.ryan;
    const credit = photoCreditLine(ryan);
    const sources = normalizeSources(ryan.sources);
    const body = renderMarkdown(ryan.bioMarkdown || "");
    const clusters = ryan.clusters || [];

    return html`
      <article class="wrap bio-layout">
        <aside class="bio-photo">
          ${ryan.photo
            ? html`<img src=${ryan.photo} alt=${`Photo of ${ryan.name}`} width="720" height="900" />`
            : html`<div class="initials" aria-hidden="true">${initials(ryan.name)}</div>`}
          ${credit ? html`<p class="photo-credit">${credit}</p>` : null}
          ${clusters.length
            ? html`<p class="photo-credit">
                ${clusters.map(
                  (c, i) => html`${i ? " · " : ""}<a href="/tag/${c}">${c}</a>`,
                )}
              </p>`
            : null}
        </aside>
        <div class="bio-copy">
          <p class="eyebrow">${ryan.number != null ? `Ryan #${ryan.number}` : "Ryan profile"}</p>
          <h1>${ryan.name}</h1>
          ${ryan.title ? html`<p class="title">${ryan.title}</p>` : null}
          <div class="bio-body">${unsafeHTML(body)}</div>
          ${sources.length
            ? html`
                <section class="sources" aria-label="Sources">
                  <h2>Sources</h2>
                  <ol>
                    ${sources.map(
                      (s) => html`<li id=${s.n != null ? `cite-${s.n}` : undefined}>
                        <a href=${s.url} rel="noopener noreferrer">${s.title}</a>
                        ${s.publisher ? html` — ${s.publisher}` : null}
                      </li>`,
                    )}
                  </ol>
                </section>
              `
            : null}
        </div>
      </article>
    `;
  }
}

customElements.define("bio-page", BioPage);
