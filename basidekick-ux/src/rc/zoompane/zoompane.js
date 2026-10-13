/**
 * Browser zoom / pan / minimap for basidekick:ZoomPane, shared by the Hx agent (plain script)
 * and the UxMedia widget (RequireJS). Matches the Java pane: one content element shown at its
 * own size, pane = (content - view) * zoom, scroll-pane style clamping, start fitted or at 100%.
 */
(function () {
  'use strict';
  var NAME = 'nmodule/basidekick/rc/zoompane/zoompane';
  function register() {
    if (typeof define === 'function' && define.amd) {
      // A named define is safe from a plain <script> tag (Hx) and loadable by RequireJS (UxMedia).
      define(NAME, [], function () { return window.baskZoomPane; });
    }
  }
  if (window.baskZoomPane) { register(); return; }

  var BUTTONS = [['−', 30, 'out'], ['100%', 52, 'reset'], ['+', 30, 'in'], ['Fit', 40, 'fit']];
  var MAP_MAX = 180, PAD = 12, DRAG_SLOP = 4;
  /** Marks the elements this script adds, so Hx adoption never moves them. */
  var LAYER = 'bask-zoompane-layer';
  var FORM_FIELDS = 'input,select,textarea,[contenteditable="true"]';

  function css(node, styles) { Object.keys(styles).forEach(function (k) { node.style[k] = styles[k]; }); return node; }
  function el(tag, styles, cls) { var n = css(document.createElement(tag), styles || {}); n.className = cls || LAYER; return n; }
  function num(value, fallback) { var n = Number(value); return isFinite(n) ? n : fallback; }

  function attach(root, world, options) {
    var o = {};
    var view = { x: 0, y: 0, z: 1 };
    var moved = false, press = null, panning = false, suppressClick = false, mapDrag = false;

    css(root, { position: root.style.position || 'relative', overflow: 'hidden', touchAction: 'none' });
    css(world, { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0' });

    var overlay = el('div', { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', pointerEvents: 'none', zIndex: '3',
      font: '12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: '#3b4652' });
    root.appendChild(overlay);

    var map = el('div', { position: 'absolute', right: PAD + 'px', bottom: PAD + 'px', overflow: 'hidden', background: '#ffffff',
      border: '1px solid #d5dbe2', borderRadius: '8px', boxShadow: '0 2px 8px rgba(15,23,42,.10)', pointerEvents: 'auto', cursor: 'pointer' });
    var thumb = el('div', { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0', pointerEvents: 'none' });
    var frame = el('div', { position: 'absolute', border: '1.5px solid #2463eb', borderRadius: '2px', pointerEvents: 'none', boxSizing: 'border-box' });
    map.appendChild(thumb);
    map.appendChild(frame);
    overlay.appendChild(map);

    var controls = el('div', { position: 'absolute', left: PAD + 'px', bottom: PAD + 'px', display: 'flex', height: '30px',
      background: 'rgba(255,255,255,0.94)', border: '1px solid #d5dbe2', borderRadius: '8px', overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(15,23,42,.10)', pointerEvents: 'auto' });
    var zoomLabel = null;
    BUTTONS.forEach(function (b, i) {
      var button = el('button', { width: b[1] + 'px', height: '100%', border: '0', borderLeft: i ? '1px solid #e2e7ec' : '0',
        background: 'transparent', font: 'inherit', fontSize: b[0].length > 1 ? '12px' : '16px', color: 'inherit', cursor: 'pointer', padding: '0' });
      button.type = 'button';
      button.textContent = b[0];
      button.title = { out: 'Zoom out', reset: 'Zoom to 100%', 'in': 'Zoom in', fit: 'Zoom to fit' }[b[2]];
      button.addEventListener('click', function (e) { e.stopPropagation(); command(b[2]); });
      if (b[2] === 'reset') { zoomLabel = button; }
      controls.appendChild(button);
    });
    overlay.appendChild(controls);

    function clampZoom(z) { var lo = Math.max(0.02, o.minZoom), hi = Math.max(lo, o.maxZoom); return Math.max(lo, Math.min(hi, z)); }
    function size() { return { w: root.clientWidth, h: root.clientHeight }; }

    /** The content's own size: the extent of the world layer's children. */
    function contentSize() {
      var w = 1, h = 1;
      Array.prototype.forEach.call(world.children, function (kid) {
        w = Math.max(w, kid.offsetLeft + kid.offsetWidth);
        h = Math.max(h, kid.offsetTop + kid.offsetHeight);
      });
      return { w: w, h: h };
    }

    function clamp() {
      var c = contentSize(), sz = size(), vw = sz.w / view.z, vh = sz.h / view.z;
      view.x = c.w <= vw ? (c.w - vw) / 2 : Math.max(0, Math.min(c.w - vw, view.x));
      view.y = c.h <= vh ? (c.h - vh) / 2 : Math.max(0, Math.min(c.h - vh, view.y));
    }

    function fitView() {
      var c = contentSize(), sz = size();
      if (!sz.w || !sz.h) { return; }
      view.z = clampZoom(Math.min(sz.w / c.w, sz.h / c.h));
      clamp();
    }

    function startView() {
      if (o.startFitted) { fitView(); } else { view = { x: 0, y: 0, z: clampZoom(1) }; clamp(); }
    }

    function mapGeometry() {
      var c = contentSize(), s = MAP_MAX / Math.max(c.w, c.h);
      return { c: c, s: s, w: Math.max(40, c.w * s), h: Math.max(30, c.h * s) };
    }

    function drawMap() {
      if (!o.showMinimap) { return; }
      var g = mapGeometry(), sz = size();
      css(map, { width: g.w + 'px', height: g.h + 'px' });
      css(thumb, { transform: 'scale(' + g.s + ')', width: g.c.w + 'px', height: g.c.h + 'px' });
      var x0 = Math.max(0, view.x), y0 = Math.max(0, view.y);
      var x1 = Math.min(g.c.w, view.x + sz.w / view.z), y1 = Math.min(g.c.h, view.y + sz.h / view.z);
      css(frame, { left: x0 * g.s + 'px', top: y0 * g.s + 'px',
        width: Math.max(2, (x1 - x0) * g.s) + 'px', height: Math.max(2, (y1 - y0) * g.s) + 'px' });
    }

    /** Minimap thumbnail: a static copy of the content (ids removed so Hx updates never hit it). */
    function refreshThumb() {
      if (!o.showMinimap) { return; }
      var copy = world.cloneNode(true);
      copy.removeAttribute('id');
      Array.prototype.forEach.call(copy.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
      css(copy, { transform: 'none', position: 'absolute', left: '0', top: '0' });
      thumb.innerHTML = '';
      thumb.appendChild(copy);
      drawMap();
    }

    function apply() {
      world.style.transform = 'translate(' + (-view.x * view.z) + 'px,' + (-view.y * view.z) + 'px) scale(' + view.z + ')';
      if (zoomLabel) { zoomLabel.textContent = Math.round(view.z * 100) + '%'; }
      drawMap();
    }

    function zoomAt(sx, sy, factor) {
      var wx = view.x + sx / view.z, wy = view.y + sy / view.z;
      view.z = clampZoom(view.z * factor);
      view.x = wx - sx / view.z;
      view.y = wy - sy / view.z;
      clamp();
      moved = true;
      apply();
    }

    function command(name) {
      var sz = size();
      if (name === 'in') { zoomAt(sz.w / 2, sz.h / 2, 1.25); }
      else if (name === 'out') { zoomAt(sz.w / 2, sz.h / 2, 1 / 1.25); }
      else if (name === 'reset') { zoomAt(sz.w / 2, sz.h / 2, 1 / view.z); }
      else { fitView(); moved = true; apply(); }
    }

    function point(e) { var r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    function onWheel(e) {
      if (!o.panZoom) { return; }
      e.preventDefault();
      var p = point(e), delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(p.x, p.y, Math.pow(1.0015, -delta));
    }

    function centerFromMap(e) {
      var g = mapGeometry(), r = map.getBoundingClientRect(), sz = size();
      view.x = (e.clientX - r.left) / g.s - sz.w / 2 / view.z;
      view.y = (e.clientY - r.top) / g.s - sz.h / 2 / view.z;
      clamp();
      moved = true;
      apply();
    }

    function onDown(e) {
      if (!o.panZoom) { return; }
      if (map.contains(e.target)) {
        mapDrag = true;
        centerFromMap(e);
        e.preventDefault();
        if (root.setPointerCapture) { root.setPointerCapture(e.pointerId); }
        return;
      }
      if (controls.contains(e.target) || (e.target.closest && e.target.closest(FORM_FIELDS))) { return; }
      if (e.button !== 0 && e.button !== 1) { return; }
      // Pan starts only once the pointer moves, so plain clicks still reach widgets.
      press = { x: e.clientX, y: e.clientY, id: e.pointerId };
      panning = false;
      if (e.button === 1) { e.preventDefault(); }
    }

    function onMove(e) {
      if (mapDrag) { centerFromMap(e); return; }
      if (!press) { return; }
      if (!panning) {
        if (Math.abs(e.clientX - press.x) < DRAG_SLOP && Math.abs(e.clientY - press.y) < DRAG_SLOP) { return; }
        panning = true;
        root.style.cursor = 'grabbing';
        if (root.setPointerCapture) { root.setPointerCapture(press.id); }
      }
      view.x -= (e.clientX - press.x) / view.z;
      view.y -= (e.clientY - press.y) / view.z;
      press.x = e.clientX;
      press.y = e.clientY;
      clamp();
      moved = true;
      apply();
    }

    function onUp() {
      if (panning) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 0); }
      press = null;
      panning = false;
      mapDrag = false;
      root.style.cursor = '';
    }

    /** A drag that panned must not also click the widget it started on. */
    function onClickCapture(e) { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }

    function onDouble(e) {
      if (!o.panZoom || controls.contains(e.target) || map.contains(e.target)) { return; }
      if (e.target.closest && e.target.closest(FORM_FIELDS)) { return; }
      fitView();
      moved = true;
      apply();
    }

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('click', onClickCapture, true);
    root.addEventListener('dblclick', onDouble);

    // Until the viewer moves the view, the start view follows the pane size (like a fitted canvas).
    var resizer = window.ResizeObserver ? new ResizeObserver(function () {
      if (moved) { clamp(); } else { startView(); }
      apply();
    }) : null;
    if (resizer) { resizer.observe(root); }
    var timer = setInterval(refreshThumb, 10000);

    var controller = {
      update: function (next) {
        o = {
          startFitted: next.startFitted !== false, minZoom: num(next.minZoom, 0.1), maxZoom: num(next.maxZoom, 8),
          panZoom: next.panZoom !== false, showMinimap: next.showMinimap !== false, showControls: next.showControls !== false
        };
        map.style.display = o.showMinimap ? '' : 'none';
        controls.style.display = o.showControls && o.panZoom ? 'flex' : 'none';
        if (moved) { view.z = clampZoom(view.z); clamp(); } else { startView(); }
        apply();
        refreshThumb();
      },
      fit: function () { command('fit'); },
      destroy: function () {
        clearInterval(timer);
        if (resizer) { resizer.disconnect(); }
        root.removeEventListener('wheel', onWheel);
        root.removeEventListener('pointerdown', onDown);
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerup', onUp);
        root.removeEventListener('pointercancel', onUp);
        root.removeEventListener('click', onClickCapture, true);
        root.removeEventListener('dblclick', onDouble);
        if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
      }
    };
    controller.update(options || {});
    return controller;
  }

  /**
   * Hx entry point, called on load and after every Hx update. The agent writes a hidden marker
   * inside the pane's element; the Hx-rendered content beside it is moved into the world layer.
   */
  function hx(markerId, options) {
    var marker = document.getElementById(markerId);
    if (!marker) { return; }
    var pane = marker.parentNode;
    var state = marker.baskZoomPane;
    if (!state) {
      var world = el('div', {});
      pane.appendChild(world);
      state = marker.baskZoomPane = { world: world };
    }
    Array.prototype.slice.call(pane.childNodes).forEach(function (node) {
      var ours = node === marker || (node.className && String(node.className).indexOf(LAYER) >= 0);
      if (!ours) { state.world.appendChild(node); }
    });
    if (state.controller) { state.controller.update(options); }
    else { state.controller = attach(pane, state.world, options); }
  }

  window.baskZoomPane = { attach: attach, hx: hx };
  register();
}());
