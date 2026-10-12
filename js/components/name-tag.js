import { LitElement, html } from "lit";

export class NameTag extends LitElement {
  static properties = {
    size: { type: String },
  };

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="name-tag ${this.size === "small" ? "small" : ""}" aria-hidden="true">
        <div class="hello">HELLO</div>
        <div class="sub">my name is</div>
        <div class="write-in">Ryan</div>
      </div>
    `;
  }
}

customElements.define("name-tag", NameTag);
