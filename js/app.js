/* =========================================================================
 * app.js — Arranque, interfaz y orquestación de ModelVinya
 * ======================================================================= */
window.MV = window.MV || {};

(function () {
  'use strict';

  const state = MV.state;

  // ---- Toast ----------------------------------------------------------
  let toastTimer = null;
  MV.toast = function (msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2600);
  };

  // ---- Carga de imágenes ---------------------------------------------
  function loadFiles(fileList) {
    const files = Array.from(fileList).filter(function (f) { return /^image\//.test(f.type); });
    if (!files.length) { MV.toast('No hay imágenes válidas.', true); return; }
    let pending = files.length;
    const firstNew = state.images.length;

    files.forEach(function (file) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        const dataURL = ev.target.result;
        const el = new Image();
        el.onload = function () {
          const im = MV.newImage(file.name, dataURL, el.naturalWidth, el.naturalHeight, el);
          state.images.push(im);
          if (--pending === 0) afterLoad(firstNew);
        };
        el.onerror = function () {
          MV.toast('No se pudo leer: ' + file.name, true);
          if (--pending === 0) afterLoad(firstNew);
        };
        el.src = dataURL;   // robusto: dataURL siempre funciona, también en file://
      };
      reader.onerror = function () {
        MV.toast('Error leyendo ' + file.name, true);
        if (--pending === 0) afterLoad(firstNew);
      };
      reader.readAsDataURL(file);
    });
  }

  function afterLoad(firstNew) {
    renderImageList();
    if (state.currentIndex < 0 && state.images.length) selectImage(firstNew >= 0 ? firstNew : 0);
    else refreshAll();
    MV.toast(state.images.length + ' imagen(es) en el proyecto.');
  }

  // ---- Lista de imágenes ---------------------------------------------
  function renderImageList() {
    const ul = document.getElementById('imageItems');
    ul.innerHTML = '';
    state.images.forEach(function (im, i) {
      const m = MV.metrics.compute(im);
      const li = document.createElement('li');
      if (i === state.currentIndex) li.className = 'active';
      li.innerHTML =
        '<img src="' + (im.dataURL || '') + '" alt="">' +
        '<div class="meta"><div class="nm" title="' + escapeAttr(im.nombre) + '">' + escapeHtml(im.nombre) + '</div>' +
        '<div class="cnt">' + m.N_visible + ' bayas' + (im.escala_mm_px ? ' · escala✓' : '') + '</div></div>';
      li.addEventListener('click', function () { selectImage(i); });
      ul.appendChild(li);
    });
    document.getElementById('imgCount').textContent = state.images.length;
    document.getElementById('emptyHint').style.display = state.images.length ? 'none' : '';
    document.getElementById('canvasOverlay').classList.toggle('hidden', state.images.length > 0);
  }

  function selectImage(i) {
    if (i < 0 || i >= state.images.length) return;
    state.currentIndex = i;
    state.selection = null;
    state.history.length = 0; state.future.length = 0;
    MV.canvas.fit();
    bindFichaToForm();
    refreshAll();
    renderImageList();
  }

  function deleteCurrentImage() {
    const im = MV.current();
    if (!im) { MV.toast('No hay imagen activa.', true); return; }
    if (!confirm('¿Eliminar "' + im.nombre + '" del proyecto? (no borra el archivo original)')) return;
    state.images.splice(state.currentIndex, 1);
    state.currentIndex = Math.min(state.currentIndex, state.images.length - 1);
    if (state.currentIndex >= 0) { MV.canvas.fit(); bindFichaToForm(); }
    refreshAll(); renderImageList();
  }

  // ---- Ficha de campo y verdad terreno <-> formulario ----------------
  const FICHA_FIELDS = {
    id_racimo: 'f_id', fecha: 'f_fecha', variedad: 'f_variedad', fase_fenologica: 'f_fase',
    tratamiento: 'f_tratamiento', vigor: 'f_vigor', orientacion: 'f_orientacion', sistema_conduccion: 'f_sistema',
  };
  const VERDAD_FIELDS = {
    N_total_real: 'g_ntotal', Diam_real_mm: 'g_diam', Peso_baya_real_g: 'g_pbaya', Peso_racimo_real_g: 'g_pracimo',
  };

  function bindFichaToForm() {
    const im = MV.current(); if (!im) return;
    for (const k in FICHA_FIELDS) document.getElementById(FICHA_FIELDS[k]).value = im.ficha[k] || '';
    for (const k in VERDAD_FIELDS) document.getElementById(VERDAD_FIELDS[k]).value = im.verdad[k] || '';
  }
  function wireFichaInputs() {
    function bind(map, target) {
      for (const k in map) {
        (function (key, id) {
          document.getElementById(id).addEventListener('input', function (e) {
            const im = MV.current(); if (!im) return;
            im[target][key] = e.target.value;
            MV.metrics.render();
            if (key === 'id_racimo') renderImageList();
            MV.autosave();
          });
        })(k, map[k]);
      }
    }
    bind(FICHA_FIELDS, 'ficha');
    bind(VERDAD_FIELDS, 'verdad');
  }

  // ---- Herramientas ---------------------------------------------------
  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll('.tool').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    const cv = MV.canvas.el;
    cv.style.cursor = (tool === 'select') ? 'default' : 'crosshair';
  }

  function updateScaleBadge() {
    const im = MV.current();
    const el = document.getElementById('scaleBadge');
    if (im && im.escala_mm_px) {
      el.textContent = '📏 ' + im.escala_mm_px.toFixed(4) + ' mm/px';
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function refreshAll() {
    MV.canvas.draw();
    MV.metrics.render();
    updateScaleBadge();
  }

  // ---- Utilidades HTML ------------------------------------------------
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  // ---- Wiring de la UI -----------------------------------------------
  function wireUI() {
    document.querySelectorAll('.tool').forEach(function (b) {
      b.addEventListener('click', function () { setTool(b.dataset.tool); });
    });

    document.getElementById('fileInput').addEventListener('change', function (e) {
      loadFiles(e.target.files); e.target.value = '';
    });
    document.getElementById('projInput').addEventListener('change', function (e) {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        try {
          const data = JSON.parse(ev.target.result);
          MV.io.loadProjectObject(data, function () {
            if (state.images.length) selectImage(0); else refreshAll();
            renderImageList();
            MV.toast('Proyecto cargado (' + state.images.length + ' imágenes).');
          });
        } catch (err) { MV.toast('JSON no válido.', true); }
      };
      reader.readAsText(file);
    });

    document.getElementById('btnUndo').addEventListener('click', function () { if (MV.undo()) refreshAll(); });
    document.getElementById('btnRedo').addEventListener('click', function () { if (MV.redo()) refreshAll(); });
    document.getElementById('btnZoomIn').addEventListener('click', function () { MV.canvas.zoomCenter(1.2); MV.canvas.draw(); });
    document.getElementById('btnZoomOut').addEventListener('click', function () { MV.canvas.zoomCenter(1 / 1.2); MV.canvas.draw(); });
    document.getElementById('btnFit').addEventListener('click', function () { MV.canvas.fit(); MV.canvas.draw(); });
    document.getElementById('btnDelImg').addEventListener('click', deleteCurrentImage);

    document.getElementById('btnSaveProj').addEventListener('click', MV.io.saveProject);
    document.getElementById('btnExportCSV').addEventListener('click', MV.io.exportCSV);
    document.getElementById('btnExportYoloImg').addEventListener('click', MV.io.exportYoloCurrent);
    document.getElementById('btnExportYoloAll').addEventListener('click', MV.io.exportYoloZip);
    document.getElementById('btnYaml').addEventListener('click', MV.io.exportYaml);

    // Radio por defecto
    const rad = document.getElementById('defRadius');
    rad.addEventListener('input', function () {
      state.defaultRadius = parseInt(rad.value, 10);
      document.getElementById('defRadiusVal').textContent = rad.value;
    });

    // Ayuda
    document.getElementById('btnHelp').addEventListener('click', function () {
      document.getElementById('helpModal').classList.remove('hidden');
    });
    document.getElementById('helpClose').addEventListener('click', function () {
      document.getElementById('helpModal').classList.add('hidden');
    });
    document.getElementById('helpModal').addEventListener('click', function (e) {
      if (e.target.id === 'helpModal') e.currentTarget.classList.add('hidden');
    });

    wireFichaInputs();
  }

  // Exponer helpers que tools.js necesita
  MV.ui = { setTool: setTool, updateScaleBadge: updateScaleBadge, renderImageList: renderImageList, refreshAll: refreshAll };

  // ---- Arranque -------------------------------------------------------
  function start() {
    MV.canvas.init();
    MV.tools.init();
    wireUI();
    setTool('baya');

    // Restaurar autosave (sin imágenes): si lo hay, avisar.
    const auto = MV.loadAutosave();
    if (auto && auto.images && auto.images.length) {
      const hasData = auto.images.some(function (o) { return (o.bayas && o.bayas.length) || o.racimo || o.ficha && o.ficha.id_racimo; });
      if (hasData) {
        MV.toast('Hay anotaciones autoguardadas. Carga las mismas imágenes o abre tu proyecto .json para continuar.');
      }
    }
    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
