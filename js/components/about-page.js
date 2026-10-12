import { LitElement, html } from "lit";
import "./name-tag.js";

export class AboutPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <main class="wrap about-panel">
        <name-tag></name-tag>
        <div class="about-copy">
          <h1 class="display">About All The Ryans</h1>
          <p>
            All The Ryans is a curated directory of notable people named Ryan.
            The public site is a no-build Lit frontend over a read-only Hono API
            backed by libSQL. Profiles are authored as Markdown and imported by a
            single-writer CLI; only <code>status: published</code> rows appear here.
          </p>
          <p>
            For corrections or takedown requests, contact the maintainer via the
            <a href="https://github.com/RyanCwynar/alltheryans" rel="noopener">GitHub repository</a>.
          </p>
        </div>
      </main>
    `;
  }
}

customElements.define("about-page", AboutPage);
