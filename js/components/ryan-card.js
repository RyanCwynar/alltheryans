import { LitElement, html } from "lit";
import { cardShort, initials } from "../lib/parse.js";

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
    const title = (ryan.title || "").trim();
    const desc = title && title !== short ? title : "";
    return html`
      <a class="ryan-card" href="/ryan/${ryan.slug}">
        <div class="thumb">
          ${ryan.photo
            ? html`<img src=${ryan.photo} alt="" loading="lazy" width="400" height="500" />`
            : html`<div class="initials" aria-hidden="true">${initials(ryan.name)}</div>`}
        </div>
        <h3 class="name">${ryan.name}</h3>
        ${short ? html`<p class="short">${short}</p>` : null}
        ${desc ? html`<p class="desc">${desc}</p>` : null}
      </a>
    `;
  }
}

customElements.define("ryan-card", RyanCard);
