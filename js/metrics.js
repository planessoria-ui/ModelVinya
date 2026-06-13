/* =========================================================================
 * metrics.js — Cálculo de variables derivadas (fórmulas del PDF)
 * Expone MV.metrics.compute(img) y MV.metrics.render()
 * ======================================================================= */
window.MV = window.MV || {};

(function () {
  'use strict';

  // Área de un polígono (fórmula del cordón / shoelace), en px²
  function polygonArea(pts) {
    if (!pts || pts.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return Math.abs(a) / 2;
  }

  // Calcula todas las métricas visibles de una imagen
  function compute(img) {
    const r = {
      N_visible: 0,
      A_racimo_px: 0, A_racimo_mm2: null,
      Diam_visible_mm: null, Diam_visible_px: null,
      A_baya_media_px: null, A_baya_media_mm2: null,
      D_visible: null,
      Ocupacion: null,
      FO_real: null,
      mm_px: null,
    };
    if (!img) return r;

    const s = img.escala_mm_px || null;   // mm por píxel
    r.mm_px = s;

    // N_visible y diámetros de bayas
    const bayas = img.bayas || [];
    r.N_visible = bayas.length;

    if (bayas.length) {
      let sumDpx = 0, sumApx = 0;
      for (const b of bayas) {
        sumDpx += 2 * b.r;                 // diámetro en px
        sumApx += Math.PI * b.r * b.r;     // área del círculo en px²
      }
      r.Diam_visible_px = sumDpx / bayas.length;
      r.A_baya_media_px = sumApx / bayas.length;
      if (s) {
        r.Diam_visible_mm = r.Diam_visible_px * s;
        r.A_baya_media_mm2 = r.A_baya_media_px * s * s;
      }
    }

    // A_racimo (polígono)
    if (img.racimo && img.racimo.puntos && img.racimo.puntos.length >= 3) {
      r.A_racimo_px = polygonArea(img.racimo.puntos);
      if (s) r.A_racimo_mm2 = r.A_racimo_px * s * s;

      // D_visible = N_visible / A_racimo  (usamos px² para densidad estable)
      if (r.A_racimo_px > 0) {
        r.D_visible = r.N_visible / r.A_racimo_px;
        // Ocupación = Σ A_baya / A_racimo
        const sumAbaya = (r.A_baya_media_px || 0) * r.N_visible;
        r.Ocupacion = sumAbaya / r.A_racimo_px;
      }
    }

    // FO_real = N_total_real / N_visible
    const ntot = parseFloat(img.verdad && img.verdad.N_total_real);
    if (!isNaN(ntot) && r.N_visible > 0) {
      r.FO_real = ntot / r.N_visible;
    }

    return r;
  }

  function fmt(v, dec, unit) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return v.toFixed(dec) + (unit ? ' ' + unit : '');
  }

  function render() {
    const img = MV.current();
    const m = compute(img);

    document.getElementById('m_nvis').textContent = m.N_visible;

    document.getElementById('m_aracimo').textContent =
      m.A_racimo_px ? (Math.round(m.A_racimo_px) + ' px²' +
        (m.A_racimo_mm2 ? '  (' + m.A_racimo_mm2.toFixed(1) + ' mm²)' : '')) : '—';

    document.getElementById('m_diam').textContent =
      m.Diam_visible_mm != null ? fmt(m.Diam_visible_mm, 2, 'mm')
        : (m.Diam_visible_px != null ? fmt(m.Diam_visible_px, 1, 'px') : '—');

    document.getElementById('m_abaya').textContent =
      m.A_baya_media_mm2 != null ? fmt(m.A_baya_media_mm2, 1, 'mm²')
        : (m.A_baya_media_px != null ? fmt(m.A_baya_media_px, 0, 'px²') : '—');

    document.getElementById('m_dvis').textContent =
      m.D_visible != null ? m.D_visible.toExponential(2) : '—';

    document.getElementById('m_ocup').textContent =
      m.Ocupacion != null ? (m.Ocupacion * 100).toFixed(1) + ' %' : '—';

    document.getElementById('m_fo').textContent =
      m.FO_real != null ? fmt(m.FO_real, 2, '×') : '—';
  }

  MV.metrics = { compute: compute, render: render, polygonArea: polygonArea };
})();
