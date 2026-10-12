import { LitElement, html } from "lit";
import { cardShort } from "../lib/parse.js";
import { seriesLabel } from "../lib/data.js";
import "./ryan-photo.js";

export class RyanCard extends LitElement {
  static properties = {
    ryan: { type: Object },
  };

  createRenderRoot() {
    return this;
  }

  render() {
    const ryan = this.ryan || {};
    const short = cardShort(ryan);
    const no = seriesLabel(ryan);
    return html`
      <a class="ryan-card" href="/ryan/${ryan.slug}">
        <div class="thumb">
          <ryan-photo .ryan=${ryan}></ryan-photo>
          ${no ? html`<span class="no">${no}</span>` : null}
        </div>
        <div class="meta">
          <h3 class="name">${ryan.name}</h3>
          ${short ? html`<p class="short">${short}</p>` : null}
        </div>
      </a>
    `;
  }
}

customElements.define("ryan-card", RyanCard);
