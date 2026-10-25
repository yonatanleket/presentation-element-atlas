// Atlas Rendered Contrast 1.0.2. Serialized into a real browser by check-contrast.mjs.
// Conservative DOM text checker, not a complete accessibility audit.
export function scanTextContrast() {
  const issues = [], measurements = [];
  const color = s => {
    const m = s.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    const n = m[1].split(/[, /]+/).filter(Boolean).map(Number);
    return n.length >= 3 && n.every(Number.isFinite) ? [n[0], n[1], n[2], n[3] ?? 1] : null;
  };
  const over = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const lum = c => c.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const locator = el => el.id ? `#${el.id}` : el.tagName.toLowerCase() + [...el.classList].map(c => `.${c}`).join('');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement, text = node.textContent.trim();
    if (!text || !el || el.closest('script,style,noscript,[hidden],.sr-only') || el.closest(':disabled')) continue;
    const style = getComputedStyle(el), range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    if (style.visibility !== 'visible' || !rects.length) continue;
    const ancestors = []; let hidden = false;
    for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); ancestors.push([p, s]); if (+s.opacity === 0 || s.display === 'none' || s.visibility !== 'visible') hidden = true; }
    if (hidden) continue;
    const entry = { target: locator(el), text: text.slice(0, 120) };
    const unsupported = reason => issues.push({ ...entry, kind: 'unmeasurable', reason });
    if (el.closest('svg,canvas')) { unsupported('SVG/canvas backing requires pixel or manual assessment'); continue; }
    if (ancestors.some(([, s]) => +s.opacity !== 1 || s.filter !== 'none' || s.mixBlendMode !== 'normal')) { unsupported('opacity/filter/blend compositing'); continue; }
    if (style.textShadow !== 'none') { unsupported('text shadow'); continue; }
    if (style.webkitTextFillColor !== style.color || parseFloat(style.webkitTextStrokeWidth || '0') > 0) { unsupported('text fill override or text stroke'); continue; }
    let bg = [255, 255, 255, 1], bad = '';
    for (const [, s] of ancestors.toReversed()) {
      if (s.backgroundImage !== 'none') { bad = 'background image or gradient'; break; }
      const c = color(s.backgroundColor); if (!c) { bad = 'unsupported background color'; break; } bg = over(c, bg);
    }
    if (bad) { unsupported(bad); continue; }
    const rect = rects.find(r => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
    if (!rect) { unsupported('outside viewport'); continue; }
    const x = Math.max(0, Math.min(innerWidth - 1, (rect.left + rect.right) / 2)), y = Math.max(0, Math.min(innerHeight - 1, (rect.top + rect.bottom) / 2));
    const top = document.elementFromPoint(x, y);
    if (top && top !== el && !el.contains(top)) { unsupported('overlap/occlusion at text center'); continue; }
    // Ancestor colors are insufficient when a separately painted layer sits behind
    // transparent text wrappers (for example an SVG landscape plus sibling scrim).
    const opaqueAncestor = ancestors.find(([, s]) => color(s.backgroundColor)?.[3] === 1)?.[0];
    let layered = false;
    for (const hit of document.elementsFromPoint(x, y)) {
      if (hit === opaqueAncestor) break;
      if (ancestors.some(([p]) => p === hit) || el.contains(hit)) continue;
      const paint = getComputedStyle(hit);
      if (+paint.opacity === 0 || paint.visibility !== 'visible') continue;
      if (hit instanceof SVGElement || ['IMG', 'CANVAS', 'VIDEO', 'IFRAME'].includes(hit.tagName) || paint.backgroundImage !== 'none' || (color(paint.backgroundColor)?.[3] || 0) > 0) { layered = true; break; }
    }
    if (layered) { unsupported('painted sibling backing layer before opaque ancestor'); continue; }
    const fg = color(style.color); if (!fg) { unsupported('unsupported text color'); continue; }
    const size = parseFloat(style.fontSize), bold = +style.fontWeight >= 700;
    const threshold = size >= 24 || (bold && size >= 18.6666667) ? 3 : 4.5;
    const measured = { ...entry, foreground: fg, background: bg, size, weight: style.fontWeight, threshold, ratio: ratio(over(fg, bg), bg) };
    measurements.push(measured);
    if (measured.ratio < threshold) issues.push({ ...measured, kind: 'failure' });
  }
  return { measurements, issues };
}
