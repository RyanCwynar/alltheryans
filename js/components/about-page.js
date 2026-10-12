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
            All The Ryans is a small, curated directory of notable people named Ryan —
            builders, athletes, artists, and a few internet legends. Each day highlights
            one Ryan (America/São Paulo calendar), with the full catalog always available
            in the <a href="/archive/">archive</a>.
          </p>
          <p>
            Profiles live as Markdown files in the repository. Publishing is just adding
            a <code>.md</code> file with frontmatter; a GitHub Action refreshes the index.
          </p>
          <p>
            Photos should carry clear credit and license (prefer Wikimedia Commons:
            CC0, public domain, CC BY, or CC BY-SA). Bios stay factual and sourced.
            For corrections or takedown requests, contact the site maintainer via the
            <a href="https://github.com/RyanCwynar/alltheryans" rel="noopener">GitHub repository</a>.
          </p>
        </div>
      </main>
    `;
  }
}

customElements.define("about-page", AboutPage);
