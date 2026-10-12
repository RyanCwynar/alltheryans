import { LitElement, html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import {
  loadPublishedRyans,
  loadRyanMarkdown,
  pickRyanOfDay,
  sortByName,
  seriesLabel,
  xHandle,
  birthLabel,
} from "../lib/data.js";
import { renderMarkdown, normalizeSources, photoCreditLine } from "../lib/parse.js";
import "./ryan-photo.js";
import "./name-tag.js";

export class BioPage extends LitElement {
  static properties = {
    slug: { type: String },
    status: { state: true },
    ryan: { state: true },
    ryans: { state: true },
  };

  constructor() {
    super();
    this.slug = "";
    this.status = "loading";
    this.ryan = null;
    this.ryans = [];
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
      const [ryan, list] = await Promise.all([
        loadRyanMarkdown(this.slug),
        loadPublishedRyans().catch(() => []),
      ]);
      this.ryan = ryan;
      this.ryans = sortByName(list);
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

  #neighbors() {
    const i = this.ryans.findIndex((r) => r.slug === this.ryan.slug);
    if (i === -1 || this.ryans.length < 2) return [null, null];
    const n = this.ryans.length;
    return [this.ryans[(i - 1 + n) % n], this.ryans[(i + 1) % n]];
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
    const knownFor = Array.isArray(ryan.known_for) ? ryan.known_for : [];
    const clusters = ryan.clusters || [];
    const isToday = this.ryans.length && pickRyanOfDay(this.ryans)?.slug === ryan.slug;
    const no = seriesLabel(ryan);
    const born = birthLabel(ryan);
    const place = ryan.birth?.place || ryan.birth_place || "";
    const x = xHandle(ryan);
    const [prev, next] = this.#neighbors();

    return html`
      <main class="wrap">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/archive/">Archive</a> <span aria-hidden="true">/</span> ${ryan.name}
        </nav>

        <article class="bio-layout">
          <aside class="bio-aside">
            <div class="bio-photo">
              <ryan-photo .ryan=${ryan} alt=${`Portrait of ${ryan.name}`} eager></ryan-photo>
              <name-tag size="small"></name-tag>
            </div>
            ${credit ? html`<p class="photo-credit">${credit}</p>` : null}
            ${born || place || x || no || ryan.website
              ? html`<dl class="facts">
                  ${born ? html`<div><dt>Born</dt><dd>${born}</dd></div>` : null}
                  ${place ? html`<div><dt>From</dt><dd>${place}</dd></div>` : null}
                  ${x
                    ? html`<div>
                        <dt>On X</dt>
                        <dd><a href=${x.url} rel="noopener noreferrer">@${x.handle}</a></dd>
                      </div>`
                    : null}
                  ${ryan.website
                    ? html`<div>
                        <dt>Website</dt>
                        <dd>
                          <a href=${ryan.website} rel="noopener noreferrer"
                            >${ryan.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a
                          >
                        </dd>
                      </div>`
                    : null}
                  ${no ? html`<div><dt>Series</dt><dd>${no}</dd></div>` : null}
                </dl>`
              : null}
          </aside>

          <div class="bio-main">
            <div class="bio-title">
              ${isToday ? html`<p class="badge">Ryan of the day</p>` : null}
              <h1 class="display">${ryan.name}</h1>
              ${ryan.title ? html`<p class="role">${ryan.title}</p>` : null}
            </div>

            <div class="bio-body">${unsafeHTML(body)}</div>

            ${knownFor.length
              ? html`<section class="bio-section" aria-label="Known for">
                  <h2>Known for</h2>
                  <ul class="chips">
                    ${knownFor.map((k) => html`<li class="chip">${k}</li>`)}
                  </ul>
                </section>`
              : null}

            ${clusters.length
              ? html`<section class="bio-section" aria-label="Clusters">
                  <h2>Clusters</h2>
                  <ul class="chips">
                    ${clusters.map(
                      (c) => html`<li><a class="chip chip-link" href="/tag/${c}">${c}</a></li>`,
                    )}
                  </ul>
                </section>`
              : null}

            ${sources.length
              ? html`<section class="bio-section sources" aria-label="Sources">
                  <h2>Sources</h2>
                  <ol>
                    ${sources.map(
                      (s) => html`<li id=${s.n != null ? `cite-${s.n}` : undefined}>
                        <a href=${s.url} rel="noopener noreferrer">${s.title}</a>${s.publisher
                          ? html` — ${s.publisher}`
                          : null}
                      </li>`,
                    )}
                  </ol>
                </section>`
              : null}

            ${prev && next
              ? html`<nav class="pager" aria-label="More Ryans">
                  <a href="/ryan/${prev.slug}">
                    <small>← Previous Ryan</small>
                    <strong>${prev.name}</strong>
                  </a>
                  <a class="next" href="/ryan/${next.slug}">
                    <small>Next Ryan →</small>
                    <strong>${next.name}</strong>
                  </a>
                </nav>`
              : null}
          </div>
        </article>
      </main>
    `;
  }
}

customElements.define("bio-page", BioPage);
