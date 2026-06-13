/* =========================================================================
 * tools.js — Interacción con el ratón según la herramienta activa
 * Herramientas: baya (círculo), racimo (polígono), escala (línea), select
 * Expone MV.tools
 * ======================================================================= */
window.MV = window.MV || {};

(function () {
  'use strict';

  const state = MV.state;
  let cv;

  // Estado de interacción en curso
  let drag = null;        // {mode, ...}
  let panning = null;     // {startX,startY,ox,oy}
  let spaceDown = false;
  let preview = null;     // datos para dibujar la vista previa

  function init() {
    cv = MV.canvas.el;
    cv.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('dblclick', onDblClick);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function refresh() {
    MV.canvas.draw();
    MV.metrics.render();
  }

  // ---- Helpers de hit-testing ----------------------------------------
  function hitBaya(ip) {
    const img = MV.current(); if (!img) return -1;
    // recorrer en orden inverso (las últimas dibujadas arriba)
    for (let i = img.bayas.length - 1; i >= 0; i--) {
      const b = img.bayas[i];
      const d = Math.hypot(ip.x - b.cx, ip.y - b.cy);
      if (d <= b.r + 3 / state.view.scale) return i;
    }
    return -1;
  }
  function hitHandleScreen(sx, sy, ix, iy) {
    const p = MV.canvas.imgToScreen(ix, iy);
    return Math.hypot(sx - p.x, sy - p.y) <= 7;
  }

  // ---- Eventos --------------------------------------------------------
  function onDown(e) {
    const img = MV.current();
    if (!img) return;
    const ip = MV.canvas.eventToImg(e);
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    // Pan: botón central/derecho, o espacio + clic
    if (e.button === 1 || e.button === 2 || spaceDown) {
      panning = { startX: sx, startY: sy, ox: state.view.offsetX, oy: state.view.offsetY };
      return;
    }
    if (e.button !== 0) return;

    const tool = state.tool;

    if (tool === 'baya') {
      MV.pushHistory();
      const b = { cx: ip.x, cy: ip.y, r: state.defaultRadius };
      img.bayas.push(b);
      drag = { mode: 'baya-radius', baya: b, ix: ip.x, iy: ip.y, moved: false };
      state.selection = { type: 'baya', index: img.bayas.length - 1 };
      refresh();
      return;
    }

    if (tool === 'racimo') {
      if (!img.racimo || img.racimo.closed) {
        MV.pushHistory();
        img.racimo = { puntos: [[ip.x, ip.y]], closed: false };
      } else {
        // si clicamos cerca del primer punto, cerrar
        const first = img.racimo.puntos[0];
        if (img.racimo.puntos.length >= 3 && hitHandleScreen(sx, sy, first[0], first[1])) {
          img.racimo.closed = true;
          MV.autosave();
        } else {
          MV.pushHistory();
          img.racimo.puntos.push([ip.x, ip.y]);
        }
      }
      refresh();
      return;
    }

    if (tool === 'escala') {
      if (!preview || preview.mode !== 'escala') {
        preview = { mode: 'escala', x1: ip.x, y1: ip.y, x2: ip.x, y2: ip.y };
        drag = { mode: 'escala' };
      }
      return;
    }

    if (tool === 'select') {
      // ¿endpoint de escala?
      if (img.escalaLinea) {
        if (hitHandleScreen(sx, sy, img.escalaLinea.x1, img.escalaLinea.y1)) {
          MV.pushHistory(); drag = { mode: 'escala-pt', which: 1 }; return;
        }
        if (hitHandleScreen(sx, sy, img.escalaLinea.x2, img.escalaLinea.y2)) {
          MV.pushHistory(); drag = { mode: 'escala-pt', which: 2 }; return;
        }
      }
      // ¿vértice del racimo?
      if (img.racimo) {
        for (let i = 0; i < img.racimo.puntos.length; i++) {
          const pt = img.racimo.puntos[i];
          if (hitHandleScreen(sx, sy, pt[0], pt[1])) {
            MV.pushHistory();
            state.selection = { type: 'racimoPt', index: i };
            drag = { mode: 'racimoPt', index: i };
            refresh(); return;
          }
        }
      }
      // ¿baya?
      const bi = hitBaya(ip);
      if (bi >= 0) {
        MV.pushHistory();
        state.selection = { type: 'baya', index: bi };
        const b = img.bayas[bi];
        const d = Math.hypot(ip.x - b.cx, ip.y - b.cy);
        // cerca del borde → redimensionar; dentro → mover
        if (Math.abs(d - b.r) < 6 / state.view.scale) {
          drag = { mode: 'baya-resize', index: bi };
        } else {
          drag = { mode: 'baya-move', index: bi, dx: ip.x - b.cx, dy: ip.y - b.cy };
        }
        refresh(); return;
      }
      // nada → pan
      state.selection = null;
      panning = { startX: sx, startY: sy, ox: state.view.offsetX, oy: state.view.offsetY };
      refresh();
      return;
    }
  }

  function onMove(e) {
    const img = MV.current(); if (!img) return;
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const ip = MV.canvas.screenToImg(sx, sy);

    if (panning) {
      state.view.offsetX = panning.ox + (sx - panning.startX);
      state.view.offsetY = panning.oy + (sy - panning.startY);
      MV.canvas.draw();
      return;
    }
    if (!drag) {
      if (preview && preview.mode === 'escala') { MV.canvas.draw(); }
      return;
    }

    if (drag.mode === 'baya-radius') {
      const d = Math.hypot(ip.x - drag.ix, ip.y - drag.iy);
      if (d > 2 / state.view.scale) { drag.baya.r = Math.max(2, d); drag.moved = true; }
      refresh();
    } else if (drag.mode === 'baya-move') {
      const b = img.bayas[drag.index];
      b.cx = ip.x - drag.dx; b.cy = ip.y - drag.dy;
      refresh();
    } else if (drag.mode === 'baya-resize') {
      const b = img.bayas[drag.index];
      b.r = Math.max(2, Math.hypot(ip.x - b.cx, ip.y - b.cy));
      refresh();
    } else if (drag.mode === 'racimoPt') {
      img.racimo.puntos[drag.index] = [ip.x, ip.y];
      refresh();
    } else if (drag.mode === 'escala') {
      preview.x2 = ip.x; preview.y2 = ip.y;
      MV.canvas.draw();
    } else if (drag.mode === 'escala-pt') {
      if (drag.which === 1) { img.escalaLinea.x1 = ip.x; img.escalaLinea.y1 = ip.y; }
      else { img.escalaLinea.x2 = ip.x; img.escalaLinea.y2 = ip.y; }
      recalcEscala(img);
      refresh();
    }
  }

  function onUp(e) {
    if (panning) { panning = null; return; }
    if (!drag) return;

    const img = MV.current();

    if (drag.mode === 'escala') {
      // fin de la línea de escala → pedir longitud real
      const dpx = Math.hypot(preview.x2 - preview.x1, preview.y2 - preview.y1);
      if (dpx < 4) { preview = null; drag = null; MV.canvas.draw(); return; }
      const val = prompt('Longitud REAL de la línea de referencia (en mm):', '10');
      if (val !== null && !isNaN(parseFloat(val)) && parseFloat(val) > 0) {
        const mm = parseFloat(val);
        MV.pushHistory();
        img.escalaLinea = { x1: preview.x1, y1: preview.y1, x2: preview.x2, y2: preview.y2, mm: mm };
        recalcEscala(img);
        MV.ui && MV.ui.updateScaleBadge && MV.ui.updateScaleBadge();
        MV.toast && MV.toast('Escala fijada: ' + img.escala_mm_px.toFixed(4) + ' mm/px');
      }
      preview = null; drag = null;
      refresh();
      return;
    }

    drag = null;
    MV.autosave();
    refresh();
  }

  function onDblClick(e) {
    const img = MV.current(); if (!img) return;
    if (state.tool === 'racimo' && img.racimo && !img.racimo.closed && img.racimo.puntos.length >= 3) {
      img.racimo.closed = true;
      MV.autosave();
      refresh();
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    MV.canvas.zoomAt(sx, sy, factor);
    MV.canvas.draw();
  }

  function recalcEscala(img) {
    if (!img.escalaLinea) { img.escala_mm_px = null; return; }
    const L = img.escalaLinea;
    const dpx = Math.hypot(L.x2 - L.x1, L.y2 - L.y1);
    img.escala_mm_px = dpx > 0 ? (L.mm / dpx) : null;
  }

  // ---- Teclado --------------------------------------------------------
  function onKeyDown(e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { spaceDown = true; cv.style.cursor = 'grab'; return; }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault(); if (MV.undo()) refresh(); return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y')) {
      e.preventDefault(); if (MV.redo()) refresh(); return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const img = MV.current(); const sel = state.selection;
      if (img && sel) {
        MV.pushHistory();
        if (sel.type === 'baya') img.bayas.splice(sel.index, 1);
        else if (sel.type === 'racimoPt' && img.racimo) {
          img.racimo.puntos.splice(sel.index, 1);
          if (img.racimo.puntos.length < 3) img.racimo.closed = false;
          if (img.racimo.puntos.length === 0) img.racimo = null;
        }
        state.selection = null;
        MV.autosave(); refresh();
      }
      return;
    }
    // atajos de herramienta
    const map = { b: 'baya', r: 'racimo', e: 'escala', s: 'select' };
    const t = map[e.key.toLowerCase()];
    if (t) { MV.ui && MV.ui.setTool && MV.ui.setTool(t); }
    if (e.key.toLowerCase() === 'f') { MV.canvas.fit(); MV.canvas.draw(); }
  }
  function onKeyUp(e) {
    if (e.code === 'Space') { spaceDown = false; cv.style.cursor = ''; }
  }

  // ---- Vista previa (llamado desde canvas.draw) -----------------------
  function drawPreview(ctx, helpers) {
    if (preview && preview.mode === 'escala') {
      const a = helpers.imgToScreen(preview.x1, preview.y1);
      const b = helpers.imgToScreen(preview.x2, preview.y2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 3; ctx.strokeStyle = '#5a9bd4'; ctx.setLineDash([6, 4]);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }

  MV.tools = { init: init, drawPreview: drawPreview, recalcEscala: recalcEscala };
})();
