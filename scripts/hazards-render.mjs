// Pure selected-root renderer. Inventories are fictional authored inputs, not candidate metadata.
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const e = escapeHTML;
function claimHTML(claim, spec, state, tag = 'p') {
  const text = claim.segments.map(part => {
    if (typeof part === 'string') return e(part);
    let attrs = `data-atlas-fact="${e(part.id)}" data-atlas-kind="${e(part.kind)}"`;
    if (part.kind === 'number') attrs += state === 'before' && spec.citationRepair?.[part.id] ? ' data-atlas-source-status="missing"' : ` data-atlas-source-id="${e(part.sourceId)}"`;
    return `<span ${attrs}>${e(part.text)}</span>`;
  }).join('');
  return `<${tag} data-atlas-claim="${e(claim.id)}">${text}</${tag}>`;
}
const copyHTML = (copy, tag = 'p') => `<${tag} data-atlas-copy="${e(copy.id)}">${e(copy.text)}</${tag}>`;
const sourcesHTML = slide => slide.sources.map(source => `<p data-atlas-source="${e(source.id)}">${e(source.text)}</p>`).join('');
function fragmentChain(claims, spec, state) {
  if (!claims.length) return '';
  return `<details><summary>${claimHTML(claims[0], spec, state, 'span')}</summary>${fragmentChain(claims.slice(1), spec, state)}</details>`;
}
function chartRows(claims, spec, state) {
  return claims.map((claim, i) => `<div class="series">${claimHTML(claim, spec, state)}<div class="bar" style="width:${Math.min(100, (spec.seriesValues[i] || 0) / Math.max(...spec.seriesValues) * 100)}%"></div></div>`).join('');
}
export function renderHazardDeck(spec, state) {
  if (!['before', 'after'].includes(state)) throw new Error('Unknown hazard state');
  const after = state === 'after';
  const slides = spec.slides.map(slide => {
    const promoted = after && spec.promoteClaim ? slide.claims.find(c => c.id === spec.promoteClaim) : null;
    const title = promoted ? claimHTML(promoted, spec, state, 'span') : copyHTML(slide.title, 'span');
    const kicker = promoted ? `<div class="kicker">${copyHTML(slide.title, 'span')}</div>` : '';
    const remaining = slide.claims.filter(c => c !== promoted);
    let content = remaining.map(c => claimHTML(c, spec, state)).join('');
    if (after && ['wall-of-text', 'small-body-text'].includes(spec.id)) content = `<details><summary>${claimHTML(remaining[0], spec, state, 'span')}</summary>${remaining.slice(1).map(c => claimHTML(c, spec, state)).join('')}</details>`;
    if (spec.id === 'bullet-overload') content = after ? fragmentChain(remaining, spec, state) : `<ol>${remaining.map(c => `<li>${claimHTML(c, spec, state, 'span')}</li>`).join('')}</ol>`;
    if (['three-dimensional-pie', 'rainbow-palette', 'unlabeled-axis', 'chart-without-takeaway'].includes(spec.id)) {
      const plotted = remaining.filter(c => c.id !== spec.calloutClaim);
      content = spec.id === 'three-dimensional-pie' && !after ? `<div class="pie"></div>${plotted.map(c => claimHTML(c, spec, state)).join('')}` : chartRows(plotted, spec, state);
      const callout = remaining.find(c => c.id === spec.calloutClaim);
      if (callout) content = after ? `<div class="takeaway">${claimHTML(callout, spec, state)}</div>${content}` : `${content}${claimHTML(callout, spec, state)}`;
    }
    if (spec.id === 'filler-agenda') content = `<div class="agenda">${remaining.filter(c => c.id.startsWith('agenda-')).map(c => claimHTML(c, spec, state)).join('')}</div><div class="substance">${remaining.filter(c => !c.id.startsWith('agenda-')).map(c => claimHTML(c, spec, state)).join('')}</div>`;
    let copies = slide.copies.map(c => copyHTML(c)).join('');
    let sources = sourcesHTML(slide);
    if (!after && spec.id === 'unsourced-number') {
      copies = ''; sources = `<details class="source-details"><summary>${copyHTML(slide.copies[0], 'span')}</summary>${sources}</details>`;
    }
    if (!after && spec.id === 'unlabeled-axis') {
      content = spec.seriesValues.map(value => `<div class="bar" style="width:${value / Math.max(...spec.seriesValues) * 100}%"></div>`).join('');
      copies = `<details class="axis-details"><summary>${copyHTML(slide.copies.find(c => c.id === 'axis-details'), 'span')}</summary>${remaining.map(c => claimHTML(c, spec, state)).join('')}${slide.copies.filter(c => c.id !== 'axis-details').map(c => copyHTML(c)).join('')}</details>`;
    }
    const optional = after && spec.appendixEligibleSlideIds?.includes(slide.id) ? ' data-atlas-optional="true"' : '';
    return `<section id="${e(slide.id)}" data-atlas-slide${optional}>${kicker}<h2 data-atlas-title>${title}</h2><div data-atlas-body>${content}${copies}<div class="sources">${sources}</div></div></section>`;
  }).join('\n');
  return `<main data-atlas-deck="1" class="evidence-deck ${e(spec.id)} ${state}">${slides}</main>`;
}
export function stageText(spec) {
  return spec.slides.map(slide => [slide.title.text, ...slide.claims.map(c => c.segments.map(p => typeof p === 'string' ? p : p.text).join('')), ...slide.copies.map(c => c.text), ...slide.sources.map(s => s.text)].join('\n')).join('\n\n');
}
