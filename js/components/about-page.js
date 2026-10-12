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
          All The Ryans is a curated encyclopedia of notable people named Ryan.
          Each day highlights one published Ryan (America/São Paulo calendar).
          Profiles are Wikipedia-style reference pages: neutral voice, infoboxes,
          footnote citations, and cluster tags.
        </p>
        <p>
          Content lives as Markdown with YAML frontmatter in the repository.
          Publishing is the <code>status: published</code> gate — drafts stay in
          git but out of <code>ryans/index.json</code> and off the public site.
          A GitHub Action rebuilds the index (including Ryan-web nodes and edges)
          when Markdown changes.
        </p>
        <p>
          Photos should carry clear credit and license (prefer Wikimedia Commons:
          CC0, public domain, CC BY, or CC BY-SA). For corrections or takedown
          requests, contact the maintainer via the GitHub repository.
        </p>
      </section>
    `;
  }
}

customElements.define("about-page", AboutPage);
