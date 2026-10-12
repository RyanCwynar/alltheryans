import { LitElement, html } from "lit";
import { loadGraph } from "../lib/data.js";

/**
 * Client-side Ryan web using d3-force from CDN.
 */
export class WebPage extends LitElement {
  static properties = {
    status: { state: true },
    graph: { state: true },
  };

  constructor() {
    super();
    this.status = "loading";
    this.graph = { nodes: [], links: [] };
    this._sim = null;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._sim) this._sim.stop();
  }

  async #load() {
    try {
      this.graph = await loadGraph();
      this.status = "ready";
      await this.updateComplete;
      await this.#draw();
    } catch (err) {
      console.error(err);
      this.status = "error";
    }
  }

  async #draw() {
    const host = this.querySelector("#ryan-web-canvas");
    if (!host) return;
    host.innerHTML = "";

    const d3 = await import("d3");
    const width = host.clientWidth || 800;
    const height = Math.max(480, Math.min(720, window.innerHeight * 0.65));

    const nodes = this.graph.nodes.map((n) => ({ ...n }));
    const links = this.graph.links.map((l) => ({ ...l }));

    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Ryan web relationship graph");

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#3a5159");

    const color = (clusters) => {
      if ((clusters || []).includes("actor")) return "#c45c26";
      if ((clusters || []).includes("founder")) return "#0f6e6a";
      if ((clusters || []).includes("athlete")) return "#1d4e89";
      if ((clusters || []).includes("musician")) return "#7a3e6c";
      if ((clusters || []).includes("tech")) return "#2a6f4e";
      return "#3a5159";
    };

    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(90)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(28));
    this._sim = sim;

    const link = svg
      .append("g")
      .attr("stroke", "#9aafb4")
      .attr("stroke-opacity", 0.85)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.4)
      .attr("marker-end", (d) => (d.directed ? "url(#arrow)" : null));

    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        location.href = `/ryan/${d.slug}`;
      })
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d) => color(d.clusters))
      .attr("stroke", "#eef4f2")
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d) => d.name.replace(/^Ryan\s+/, ""))
      .attr("x", 14)
      .attr("y", 4)
      .attr("fill", "#102027")
      .attr("font-size", 12)
      .attr("font-family", "Manrope, sans-serif");

    node.append("title").text((d) => `${d.name}\n${(d.clusters || []).join(", ")}`);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
  }

  render() {
    if (this.status === "loading") {
      return html`<div class="loading wrap">Loading Ryan web…</div>`;
    }
    if (this.status === "error") {
      return html`<div class="error wrap">Could not load the graph.</div>`;
    }

    const { nodes, links } = this.graph;
    return html`
      <section class="section">
        <div class="wrap">
          <h2>The Ryan web</h2>
          <p class="lede">
            ${nodes.length} published Ryans, ${links.length} relationship
            edge${links.length === 1 ? "" : "s"} from frontmatter. Drag nodes; click to open a bio.
          </p>
          <div class="legend">
            <span><i style="background:#c45c26"></i> Actor</span>
            <span><i style="background:#0f6e6a"></i> Founder</span>
            <span><i style="background:#1d4e89"></i> Athlete</span>
            <span><i style="background:#7a3e6c"></i> Musician</span>
            <span><i style="background:#2a6f4e"></i> Tech</span>
          </div>
          <div id="ryan-web-canvas" class="web-canvas"></div>
        </div>
      </section>
    `;
  }
}

customElements.define("web-page", WebPage);
