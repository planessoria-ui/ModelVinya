/* =========================================================================
 * canvas.js — Render del lienzo, zoom/pan y conversión de coordenadas
 * Expone MV.canvas
 * ======================================================================= */
window.MV = window.MV || {};

(function () {
  'use strict';

  let cv, ctx;
  const state = MV.state;

  function init() {
    cv = document.getElementById('canvas');
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', function () { resize(); draw(); });
  }

  // Ajusta el tamaño del buffer del canvas al de su contenedor (con DPR)
  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // trabajamos en px CSS
    cv._cssW = r.width; cv._cssH = r.height;
  }

  // --- Conversión de coordenadas --------------------------------------
  // imagen (px) -> pantalla (px CSS)
  function imgToScreen(x, y) {
    const v = state.view;
    return { x: x * v.scale + v.offsetX, y: y * v.scale + v.offsetY };
  }
  // pantalla (px CSS) -> imagen (px)
  function screenToImg(sx, sy) {
    const v = state.view;
    return { x: (sx - v.offsetX) / v.scale, y: (sy - v.offsetY) / v.scale };
  }

  // Coordenada de imagen a partir de un evento de ratón
  function eventToImg(e) {
    const r = cv.getBoundingClientRect();
    return screenToImg(e.clientX - r.left, e.clientY - r.top);
  }

  // --- Ajustar imagen a la vista --------------------------------------
  function fit() {
    const img = MV.current();
    if (!img) return;
    const W = cv._cssW, H = cv._cssH;
    const margin = 0.96;
    const s = Math.min(W / img.w, H / img.h) * margin;
    state.view.scale = s;
    state.view.offsetX = (W - img.w * s) / 2;
    state.view.offsetY = (H - img.h * s) / 2;
  }

  // --- Dibujo ----------------------------------------------------------
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cv._cssW, cv._cssH);
    const img = MV.current();
    if (!img || !img.imgEl) return;

    const v = state.view;
    // Imagen
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img.imgEl, v.offsetX, v.offsetY, img.w * v.scale, img.h * v.scale);
    ctx.restore();

    // Racimo (polígono)
    if (img.racimo && img.racimo.puntos && img.racimo.puntos.length) {
      drawPolygon(img.racimo.puntos, img.racimo.closed);
    }

    // Bayas (círculos)
    const sel = state.selection;
    for (let i = 0; i < img.bayas.length; i++) {
      const b = img.bayas[i];
      const c = imgToScreen(b.cx, b.cy);
      const rr = b.r * v.scale;
      const isSel = sel && sel.type === 'baya' && sel.index === i;
      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.lineWidth = isSel ? 3 : 2;
      ctx.strokeStyle = isSel ? '#ffd24a' : '#7bc043';
      ctx.fillStyle = isSel ? 'rgba(255,210,74,.18)' : 'rgba(123,192,67,.14)';
      ctx.fill();
      ctx.stroke();
      // centro
      ctx.beginPath();
      ctx.arc(c.x, c.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? '#ffd24a' : '#7bc043';
      ctx.fill();
      // etiqueta de diámetro de ESTA baya (mm si hay escala, si no px)
      if ((state.showDiam && rr >= 9) || isSel) {
        const dmm = img.escala_mm_px ? (2 * b.r * img.escala_mm_px) : null;
        const txt = (dmm != null) ? ('Ø ' + dmm.toFixed(1) + ' mm') : ('Ø ' + Math.round(2 * b.r) + ' px');
        label(c.x, c.y - rr - 4, txt, isSel ? '#ffd24a' : '#cfe9b0');
      }
    }

    // Línea de escala
    if (img.escalaLinea) {
      const L = img.escalaLinea;
      const a = imgToScreen(L.x1, L.y1), b = imgToScreen(L.x2, L.y2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 3; ctx.strokeStyle = '#5a9bd4';
      ctx.stroke();
      drawHandle(a.x, a.y, '#5a9bd4'); drawHandle(b.x, b.y, '#5a9bd4');
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      label(mid.x, mid.y - 10, L.mm + ' mm', '#5a9bd4');
    }

    // Línea/escala en construcción o polígono en construcción → lo gestiona tools.draw
    if (MV.tools && MV.tools.drawPreview) MV.tools.drawPreview(ctx, { imgToScreen: imgToScreen });
  }

  function drawPolygon(pts, closed) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = imgToScreen(pts[i][0], pts[i][1]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    if (closed) ctx.closePath();
    ctx.lineWidth = 2; ctx.strokeStyle = '#8e44ad';
    ctx.fillStyle = 'rgba(142,68,173,.12)';
    if (closed) ctx.fill();
    ctx.stroke();
    // vértices
    for (const pt of pts) {
      const p = imgToScreen(pt[0], pt[1]);
      drawHandle(p.x, p.y, '#8e44ad');
    }
  }

  function drawHandle(x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    ctx.fill(); ctx.stroke();
  }

  function label(x, y, text, color) {
    ctx.font = '12px system-ui';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(x - w / 2, y - 14, w, 18);
    ctx.fillStyle = color || '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 5);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  // --- Zoom con rueda (centrado en el cursor) -------------------------
  function zoomAt(sx, sy, factor) {
    const v = state.view;
    const before = screenToImg(sx, sy);
    v.scale *= factor;
    v.scale = Math.max(0.02, Math.min(40, v.scale));
    // mantener el punto bajo el cursor
    v.offsetX = sx - before.x * v.scale;
    v.offsetY = sy - before.y * v.scale;
  }

  // Zoom centrado en el centro del lienzo (para botones y teclado)
  function zoomCenter(factor) {
    zoomAt(cv._cssW / 2, cv._cssH / 2, factor);
  }

  MV.canvas = {
    init: init, draw: draw, fit: fit, resize: resize,
    imgToScreen: imgToScreen, screenToImg: screenToImg, eventToImg: eventToImg,
    zoomAt: zoomAt, zoomCenter: zoomCenter,
    get el() { return cv; },
  };
})();
