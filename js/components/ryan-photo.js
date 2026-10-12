import { LitElement, html } from "lit";
import { initials } from "../lib/parse.js";

/** Photo with an initials tile as fallback (no photo, or the image fails to load). */
export class RyanPhoto extends LitElement {
  static properties = {
    ryan: { type: Object },
    alt: { type: String },
    eager: { type: Boolean },
    broken: { state: true },
  };

  constructor() {
    super();
    this.alt = "";
    this.eager = false;
    this.broken = false;
  }

  createRenderRoot() {
    return this;
  }

  willUpdate(changed) {
    if (changed.has("ryan")) this.broken = false;
  }

  render() {
    const ryan = this.ryan || {};
    if (ryan.photo && !this.broken) {
      return html`<img
        src=${ryan.photo}
        alt=${this.alt}
        loading=${this.eager ? "eager" : "lazy"}
        width="400"
        height="500"
        @error=${() => (this.broken = true)}
      />`;
    }
    return html`
      <div class="initials" aria-hidden="true">
        <span class="letters">${initials(ryan.name)}</span>
        <span class="scrawl">my name is Ryan</span>
      </div>
    `;
  }
}

customElements.define("ryan-photo", RyanPhoto);
