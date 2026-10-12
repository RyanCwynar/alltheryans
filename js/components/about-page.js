import { LitElement, html } from "lit";

export class AboutPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <section class="wrap about-panel">
        <h1>About All The Ryans</h1>
        <p>
          All The Ryans is a small, curated directory of notable people named Ryan —
          builders, athletes, artists, and a few internet legends. Each day highlights
          one Ryan (America/São Paulo calendar), with the full catalog always available
          in the archive.
        </p>
        <p>
          Profiles live as Markdown files in the repository. Publishing is just adding
          a <code>.md</code> file with frontmatter; a GitHub Action refreshes the index.
        </p>
        <p>
          Photos should carry clear credit and license (prefer Wikimedia Commons:
          CC0, public domain, CC BY, or CC BY-SA). Bios stay factual and sourced.
          For corrections or takedown requests, contact the site maintainer via the
          GitHub repository.
        </p>
      </section>
    `;
  }
}

customElements.define("about-page", AboutPage);
