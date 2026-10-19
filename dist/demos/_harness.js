/* Presentation Element Atlas: shared demo harness.
   Load after the demo markup:  <script src="_harness.js"></script>
   Then call AtlasDemo.init({...}). See CONTRIBUTING.md, "Demo authoring", for the full contract.

   Model: a demo is a timeline of frames 0..frames. Frame 0 is the idle start, the last frame is done.
   The harness owns the buttons, state, autoplay, reduced motion, keyboard shortcuts and the status line;
   the demo only draws a frame in render(frame, ctx) and, if it has its own stage controls, restores them in reset(ctx). */
(function () {
  'use strict';
  var reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var embedded = window.parent && window.parent !== window;
  if (embedded) document.documentElement.classList.add('embedded');

  function post(event, extra) {
    if (!embedded) return;
    var msg = { type: 'atlas-demo', event: event };
    if (extra) for (var k in extra) msg[k] = extra[k];
    try { window.parent.postMessage(msg, '*'); } catch (e) { /* ignore */ }
  }
  window.addEventListener('error', function (e) {
    var s = document.querySelector('.demo .status');
    if (s) s.textContent = 'Demo error';
    post('error', { message: String(e.message || 'error') });
  });

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function init(opts) {
    opts = opts || {};
    var root = document.querySelector('.demo');
    var stage = root.querySelector('.stage');
    var controls = root.querySelector('.controls') || root.insertBefore(el('div', { 'class': 'controls' }), stage.nextSibling);
    var frames = Math.max(0, opts.frames | 0);
    var stepMs = opts.stepMs || 900;
    var interactive = !!opts.interactive;
    var showStep = frames > 1 && opts.step !== false;
    var loop = !!opts.loop && frames > 0;
    var render = opts.render || function () {};
    var reduced = reducedQuery.matches;
    var frame = 0, timer = null, paused = false;

    controls.textContent = '';
    var bPlay = frames > 0 ? el('button', { type: 'button', 'data-role': 'play' }, 'Play') : null;
    var bStep = showStep ? el('button', { type: 'button', 'data-role': 'step', 'aria-label': 'Step forward' }, 'Step ▸') : null;
    var bPause = loop ? el('button', { type: 'button', 'data-role': 'pause', 'aria-pressed': 'false' }, 'Pause') : null;
    var bReset = el('button', { type: 'button', 'data-role': 'reset' }, 'Reset');
    var status = el('span', { 'class': 'status', 'aria-live': 'polite' });
    [bPlay, bStep, bPause, bReset, status].forEach(function (b) { if (b) controls.appendChild(b); });

    var ctx = {
      stage: stage, root: root,
      get reduced() { return reduced; },
      animate: false,
      status: function (t) { status.textContent = t == null ? '' : String(t); },
      setState: setState
    };

    function setState(s) {
      root.setAttribute('data-state', s);
      var playing = s === 'playing';
      if (bPlay) {
        bPlay.textContent = s === 'done' || (frame > 0 && !playing) ? 'Replay' : 'Play';
        bPlay.disabled = playing && !loop;
      }
      if (bStep) bStep.disabled = playing || frame >= frames;
      if (bPause) bPause.disabled = !playing && !paused;
      if (s === 'done' && !interactive) ctx.status(opts.doneText || 'Done');
    }
    function draw(n, animate) {
      frame = n;
      ctx.animate = !!animate && !reduced;
      render(n, ctx);
    }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }
    function tick() {
      if (frame >= frames) {
        if (loop && !paused) { timer = setTimeout(function () { draw(0, false); tick(); }, stepMs); return; }
        timer = null; setState('done'); post('done'); return;
      }
      timer = setTimeout(function () { draw(frame + 1, true); setState('playing'); tick(); }, frame === 0 ? Math.min(300, stepMs) : stepMs);
    }
    function play() {
      stop(); paused = false;
      if (bPause) { bPause.textContent = 'Pause'; bPause.setAttribute('aria-pressed', 'false'); }
      ctx.status(opts.playText || '');
      draw(0, false); setState('playing'); tick();
    }
    function step() {
      stop();
      if (frame >= frames) return;
      draw(frame + 1, true);
      setState(frame >= frames ? 'done' : 'idle');
      if (frame < frames) ctx.status('Step ' + frame + ' of ' + frames);
    }
    function reset() {
      stop(); paused = false;
      if (opts.reset) opts.reset(ctx);
      draw(0, false);
      ctx.status(opts.idleText || '');
      setState('idle');
    }
    function togglePause() {
      if (!loop) return;
      if (timer) { stop(); paused = true; bPause.textContent = 'Resume'; bPause.setAttribute('aria-pressed', 'true'); setState('idle'); ctx.status('Paused'); }
      else { paused = false; bPause.textContent = 'Pause'; bPause.setAttribute('aria-pressed', 'false'); ctx.status(''); setState('playing'); tick(); }
    }

    if (bPlay) bPlay.addEventListener('click', play);
    if (bStep) bStep.addEventListener('click', step);
    if (bPause) bPause.addEventListener('click', togglePause);
    bReset.addEventListener('click', reset);

    // Shortcuts when focus is not inside a form field or the stage's own controls: P play, N step, R reset.
    document.addEventListener('keydown', function (e) {
      // Escape that no stage control consumed (via preventDefault) asks the catalog to close its panel.
      if (e.key === 'Escape' && !e.defaultPrevented) { post('escape'); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.closest && t.closest('.stage, input, textarea, select, [contenteditable]'))) return;
      var k = e.key.toLowerCase();
      if (k === 'p' && bPlay) { e.preventDefault(); play(); }
      else if (k === 'n' && bStep) { e.preventDefault(); step(); }
      else if (k === 'r') { e.preventDefault(); reset(); }
    });

    // "How it works" is open on wide screens and collapsed on phones.
    var how = root.querySelector('details.how');
    // Inside the catalog panel the iframe is narrower than 600px even on desktop, so use the device screen there.
    var narrow = embedded ? (window.screen && window.screen.width < 600)
      : (window.matchMedia && window.matchMedia('(max-width: 599px)').matches);
    if (how && narrow) how.removeAttribute('open');

    // Start: reduced motion shows the final frame with no autoplay.
    if (opts.reset) opts.reset(ctx);
    if (reduced && frames > 0) { draw(frames, false); setState('done'); }
    else { draw(0, false); setState('idle'); if (frames > 0 && opts.autoplay !== false) setTimeout(play, 400); }
    if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', function (e) { reduced = e.matches; });
    post('ready');

    return { play: play, step: step, reset: reset, goto: function (n) { stop(); draw(Math.max(0, Math.min(frames, n)), true); setState(frame >= frames ? 'done' : 'idle'); },
      get frame() { return frame; }, status: ctx.status, setState: setState, ctx: ctx };
  }

  /* Helpers available to demos. */
  function countUp(node, to, o) {
    o = o || {};
    var dec = o.decimals || 0, pre = o.prefix || '', suf = o.suffix || '', dur = o.duration || 900;
    var fmt = function (v) { return pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
    if (node._raf) cancelAnimationFrame(node._raf);
    if (!o.animate || reducedQuery.matches) { node.textContent = fmt(to); return; }
    var from = o.from || 0, t0 = performance.now();
    (function f(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (p < 1) node._raf = requestAnimationFrame(f);
    })(t0);
  }

  window.AtlasDemo = { init: init, countUp: countUp, get reducedMotion() { return reducedQuery.matches; } };
})();
