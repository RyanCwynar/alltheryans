import { LitElement, html } from "lit";
import { initials, formatBirth, photoCreditLine } from "../lib/parse.js";

export class RyanInfobox extends LitElement {
  static properties = {
    ryan: { type: Object },
  };

  createRenderRoot() {
    return this;
  }

  render() {
    const ryan = this.ryan || {};
    const birth = formatBirth(ryan.birth);
    const credit = photoCreditLine(ryan);
    const orgs = ryan.organizations || [];
    const education = ryan.education || [];
    const social = ryan.social || [];
    const clusters = ryan.clusters || [];
    const knownFor = ryan.known_for || [];
    const occupations = ryan.occupations || [];

    return html`
      <aside class="infobox" aria-label="Infobox">
        <div class="infobox-title">${ryan.name}</div>
        <div class="infobox-photo">
          ${ryan.photo
            ? html`<img src=${ryan.photo} alt=${`Photo of ${ryan.name}`} width="360" height="450" />`
            : html`<div class="initials" aria-hidden="true">${initials(ryan.name)}</div>`}
        </div>
        ${credit ? html`<p class="photo-credit">${credit}</p>` : null}
        <table>
          ${ryan.number != null
            ? html`<tr><th>Series</th><td>Ryan #${ryan.number}</td></tr>`
            : null}
          ${birth
            ? html`<tr><th>Born</th><td>${birth}</td></tr>`
            : null}
          ${occupations.length
            ? html`<tr><th>Occupation</th><td>${occupations.join(", ")}</td></tr>`
            : null}
          ${knownFor.length
            ? html`<tr><th>Known for</th><td>${knownFor.join("; ")}</td></tr>`
            : null}
          ${education.length
            ? html`<tr><th>Education</th><td>
                <ul class="infobox-list">
                  ${education.map(
                    (e) => html`<li>${[e.degree, e.field].filter(Boolean).join(", ")}${e.degree || e.field ? ", " : ""}${e.institution}${e.year ? ` (${e.year})` : ""}</li>`,
                  )}
                </ul>
              </td></tr>`
            : null}
          ${orgs.length
            ? html`<tr><th>Organizations</th><td>
                <ul class="infobox-list">
                  ${orgs.map((o) => {
                    const years = [o.start, o.end || "present"].filter((x) => x != null).join("–");
                    return html`<li><strong>${o.name}</strong>${o.role ? ` — ${o.role}` : ""}${years ? ` (${years})` : ""}</li>`;
                  })}
                </ul>
              </td></tr>`
            : null}
          ${ryan.website
            ? html`<tr><th>Website</th><td><a href=${ryan.website} rel="noopener noreferrer">${hostname(ryan.website)}</a></td></tr>`
            : null}
          ${social.length
            ? html`<tr><th>Social</th><td>
                ${social.map(
                  (s, i) => html`${i ? html`<br />` : null}<a href=${s.url} rel="noopener noreferrer">@${s.handle || s.platform}</a>`,
                )}
              </td></tr>`
            : null}
          ${clusters.length
            ? html`<tr><th>Clusters</th><td class="infobox-tags">
                ${clusters.map(
                  (c) => html`<a class="tag-chip" href="/tag/${c}">${c}</a>`,
                )}
              </td></tr>`
            : null}
        </table>
      </aside>
    `;
  }
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

customElements.define("ryan-infobox", RyanInfobox);
