import { LitElement, html } from "lit";
import {
  loadPublishedRyans,
  pickRyanOfDay,
  sortByName,
  seriesLabel,
  todayLabel,
} from "../lib/data.js";
import { cardShort } from "../lib/parse.js";
import { arrowIcon, ADD_RYAN_URL } from "./icons.js";
import "./ryan-card.js";
import "./ryan-photo.js";
import "./name-tag.js";

/** Matches `.ryan-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) }`. */
const GRID_MIN_COL_PX = 200;
const MOBILE_GRID_MQ = "(max-width: 480px)";

export class HomePage extends LitElement {
  static properties = {
    status: { state: true },
    featured: { state: true },
    ryans: { state: true },
    previewCols: { state: true },
  };

  #gridEl = null;
  #ro = null;
  #mq = null;
  #mqHandler = null;

  constructor() {
    super();
    this.status = "loading";
    this.featured = null;
    this.ryans = [];
    this.previewCols = 4;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#load();
  }

  disconnectedCallback() {
    this.#teardownObserver();
    super.disconnectedCallback();
  }

  updated() {
    if (this.status === "ready") this.#ensureObserver();
  }

  async #load() {
    try {
      // List payload already has spotlight fields — skip a second bio fetch.
      const ryans = await loadPublishedRyans();
      this.ryans = sortByName(ryans);
      this.featured = pickRyanOfDay(ryans);
      this.status = "ready";
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  #teardownObserver() {
    this.#ro?.disconnect();
    this.#ro = null;
    this.#gridEl = null;
    if (this.#mq && this.#mqHandler) {
      this.#mq.removeEventListener("change", this.#mqHandler);
    }
    this.#mq = null;
    this.#mqHandler = null;
  }

  #ensureObserver() {
    const grid = this.querySelector(".ryan-grid--preview");
    if (!grid) return;
    if (this.#gridEl === grid && this.#ro) return;

    this.#teardownObserver();
    this.#gridEl = grid;
    this.#ro = new ResizeObserver(() => this.#syncPreviewCols());
    this.#ro.observe(grid);
    this.#mq = window.matchMedia(MOBILE_GRID_MQ);
    this.#mqHandler = () => this.#syncPreviewCols();
    this.#mq.addEventListener("change", this.#mqHandler);
    this.#syncPreviewCols();
  }

  #colsForWidth(width) {
    // Mirror the CSS breakpoint: mobile is a fixed 2-column grid.
    if (window.matchMedia(MOBILE_GRID_MQ).matches) return 2;
    const gap = this.#gridEl
      ? parseFloat(getComputedStyle(this.#gridEl).columnGap) || 0
      : 0;
    return Math.max(1, Math.floor((width + gap) / (GRID_MIN_COL_PX + gap)));
  }

  #syncPreviewCols() {
    if (!this.#gridEl) return;
    const cols = this.#colsForWidth(this.#gridEl.clientWidth);
    if (cols !== this.previewCols) this.previewCols = cols;
  }

  #preview() {
    // Prefer Ryans with photos for the preview grid, skipping today's pick.
    // Show exactly one full row: as many cards as the current column count.
    const others = this.ryans.filter((r) => r.slug !== this.featured?.slug);
    const withPhoto = others.filter((r) => r.photo);
    const rest = others.filter((r) => !r.photo);
    return [...withPhoto, ...rest].slice(0, this.previewCols);
  }

  #skeleton() {
    return html`
      <main aria-busy="true" aria-live="polite">
        <section class="wrap hero" aria-label="Loading">
          <div class="hero-copy">
            <name-tag></name-tag>
            <div class="skel skel-title"></div>
            <div class="skel skel-line"></div>
            <div class="skel skel-line short"></div>
            <div class="cta-row">
              <div class="skel skel-btn"></div>
              <div class="skel skel-btn"></div>
            </div>
          </div>
          <article class="rotd skel-rotd">
            <div class="skel skel-photo"></div>
            <div class="rotd-body">
              <div class="skel skel-line thin"></div>
              <div class="skel skel-title sm"></div>
              <div class="skel skel-line"></div>
              <div class="skel skel-line short"></div>
            </div>
          </article>
        </section>
        <section class="section">
          <div class="wrap">
            <div class="ryan-grid ryan-grid--preview">
              ${[0, 1, 2, 3].map(
                () => html`<div class="skel skel-card" aria-hidden="true"></div>`,
              )}
            </div>
          </div>
        </section>
      </main>
    `;
  }

  render() {
    if (this.status === "loading") {
      return this.#skeleton();
    }
    if (this.status === "error" || !this.featured) {
      return html`<div class="error wrap">Could not load the Ryan directory. Is the API up?</div>`;
    }

    const ryan = this.featured;
    const role = ryan.title || cardShort(ryan);
    const blurb = ryan.lead_summary || "";
    const knownFor = Array.isArray(ryan.known_for) ? ryan.known_for.slice(0, 3) : [];
    const surnames = this.ryans.map((r) => r.name.split(/\s+/).pop());
    const total = this.ryans.length;
    const no = seriesLabel(ryan);

    return html`
      <main>
        <section class="wrap hero" aria-label="Ryan of the day">
          <div class="hero-copy">
            <name-tag></name-tag>
            <h1 class="display">Every Ryan worth knowing.</h1>
            <p class="lede">
              A curated directory of notable people named Ryan — builders, athletes, artists,
              and a few internet legends. A new one in the spotlight every day.
            </p>
            <div class="cta-row">
              <a class="btn btn-dark" href="/archive/">Browse all ${total} Ryans ${arrowIcon}</a>
              <a class="btn btn-outline" href="/web/">Explore the Ryan web</a>
            </div>
          </div>

          <article class="rotd">
            <div class="rotd-media">
              <ryan-photo .ryan=${ryan} alt=${`Portrait of ${ryan.name}`} eager></ryan-photo>
              <span class="badge">Ryan of the day</span>
            </div>
            <div class="rotd-body">
              <p class="eyebrow">${todayLabel()}${no ? ` · ${no}` : ""}</p>
              <h2 class="display">${ryan.name}</h2>
              ${role ? html`<p class="role">${role}</p>` : null}
              ${blurb ? html`<p class="blurb">${blurb}</p>` : null}
              ${knownFor.length
                ? html`<ul class="chips" aria-label="Known for">
                    ${knownFor.map((k) => html`<li class="chip">${k}</li>`)}
                  </ul>`
                : null}
              <a class="btn btn-accent" href="/ryan/${ryan.slug}">Read the bio ${arrowIcon}</a>
            </div>
          </article>
        </section>

        ${surnames.length > 1
          ? html`<div class="marquee" aria-hidden="true">
              <div class="marquee-track">
                ${[...surnames, ...surnames].map((s) => html`<span>${s}</span>`)}
              </div>
            </div>`
          : null}

        <section class="section">
          <div class="wrap">
            <div class="section-head">
              <div>
                <p class="eyebrow">The roll call</p>
                <h2 class="display">More Ryans</h2>
              </div>
              <a class="more" href="/archive/">See all ${total} →</a>
            </div>
            <div class="ryan-grid ryan-grid--preview">
              ${this.#preview().map((item) => html`<ryan-card .ryan=${item}></ryan-card>`)}
            </div>
          </div>
        </section>

        <section class="wrap callout" aria-label="Add a Ryan">
          <div>
            <h2 class="display">Know a Ryan we’re missing?</h2>
            <p>
              Profiles are sourced Markdown files in the repo. Add one with citations and a
              properly licensed photo, and it joins the roll call once it’s published.
            </p>
          </div>
          <a class="btn btn-light" href=${ADD_RYAN_URL} rel="noopener">Add a Ryan on GitHub</a>
        </section>
      </main>
    `;
  }
}

customElements.define("home-page", HomePage);
