import { LitElement, html } from "lit";
import {
  loadPublishedRyans,
  loadRyanMarkdown,
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

const PREVIEW_COUNT = 8;

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
      this.ryans = sortByName(ryans);
      this.featured = pickRyanOfDay(ryans);
      this.status = "ready";
      // Pull the full profile for the spotlight card.
      if (this.featured) {
        const full = await loadRyanMarkdown(this.featured.slug).catch(() => null);
        if (full) this.featured = full;
      }
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  #preview() {
    // Prefer Ryans with photos for the preview grid, skipping today's pick.
    const others = this.ryans.filter((r) => r.slug !== this.featured?.slug);
    const withPhoto = others.filter((r) => r.photo);
    const rest = others.filter((r) => !r.photo);
    return [...withPhoto, ...rest].slice(0, PREVIEW_COUNT);
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading Ryans…</div>`;
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
            <div class="ryan-grid">
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
