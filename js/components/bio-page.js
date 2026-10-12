import { LitElement, html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadRyanMarkdown } from "../lib/data.js";
import {
  renderMarkdown,
  normalizeSources,
  relationshipLabel,
} from "../lib/parse.js";
import "./ryan-infobox.js";

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
      const num = ryan.number != null ? `Ryan #${ryan.number} · ` : "";
      document.title = `${ryan.name} · ${num}All The Ryans`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) {
        desc.setAttribute(
          "content",
          (ryan.title || ryan.short || `Encyclopedia entry for ${ryan.name}`).toString(),
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
          <p>That Ryan isn’t published in the directory.</p>
          <p><a href="/archive/">Back to the archive</a></p>
        </div>
      `;
    }

    const ryan = this.ryan;
    const sources = normalizeSources(ryan.sources);
    // Strip trailing ## References section from body if present; we render from frontmatter
    let bodyMd = ryan.bioMarkdown || "";
    bodyMd = bodyMd.replace(/\n## References[\s\S]*$/i, "\n");
    const body = renderMarkdown(bodyMd);
    const rels = ryan.relationships || [];

    return html`
      <article class="wrap wiki-layout">
        <ryan-infobox .ryan=${ryan}></ryan-infobox>
        <div class="wiki-copy">
          ${ryan.number != null
            ? html`<p class="eyebrow">Ryan #${ryan.number}</p>`
            : html`<p class="eyebrow">Ryan profile</p>`}
          <h1>${ryan.name}</h1>
          ${ryan.title ? html`<p class="title">${ryan.title}</p>` : null}
          <div class="bio-body wiki-body">${unsafeHTML(body)}</div>

          ${rels.length
            ? html`
                <section class="sources" aria-label="Relationships">
                  <h2>Ryan web</h2>
                  <ul>
                    ${rels.map(
                      (r) => html`<li>
                        <span class="rel-type">${relationshipLabel(r.type)}</span>
                        <a href="/ryan/${r.target}">${r.target}</a>
                        ${r.note ? html` — ${r.note}` : null}
                      </li>`,
                    )}
                  </ul>
                </section>
              `
            : null}

          ${sources.length
            ? html`
                <section class="sources" aria-label="References">
                  <h2>References</h2>
                  <ol class="cite-list">
                    ${sources.map(
                      (s) => html`<li id=${`cite-${s.n}`}>
                        ${s.publisher ? html`<em>${s.publisher}</em>. ` : null}
                        <a href=${s.url} rel="noopener noreferrer">${s.title || s.url}</a>
                        ${s.date ? html` (${s.date})` : null}
                        ${s.access ? html` <span class="access">[${s.access}]</span>` : null}
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
