/* =========================================================================
 * state.js — Estado global del anotador ModelVinya
 * Sin frameworks. Expone window.MV.state
 * ======================================================================= */
window.MV = window.MV || {};

(function () {
  'use strict';

  // --- Estructura de una imagen/racimo ---------------------------------
  // {
  //   id, nombre, dataURL, w, h,
  //   imgEl (HTMLImageElement, no se serializa),
  //   escala_mm_px (number|null),
  //   escalaLinea ({x1,y1,x2,y2,mm}|null),
  //   bayas: [{cx,cy,r}],            // px de imagen
  //   racimo: {puntos:[[x,y],...]} | null,
  //   ficha: {id_racimo,fecha,variedad,fase_fenologica,tratamiento,vigor,orientacion,sistema_conduccion},
  //   verdad: {N_total_real,Diam_real_mm,Peso_baya_real_g,Peso_racimo_real_g}
  // }

  const LS_KEY = 'modelvinya_project_v1';

  const state = {
    images: [],          // array de imágenes (ver estructura arriba)
    currentIndex: -1,     // índice de la imagen activa
    tool: 'baya',         // herramienta activa
    defaultRadius: 12,    // radio por defecto para bayas (px imagen)
    view: { scale: 1, offsetX: 0, offsetY: 0 }, // transformada del canvas
    selection: null,      // {type:'baya', index} | {type:'racimoPt', index} | null
    history: [],          // pila de snapshots (JSON sin imágenes)
    future: [],           // pila de rehacer
    _nextId: 1,
  };

  MV.state = state;

  // --- Helpers de creación --------------------------------------------
  MV.newImage = function (nombre, dataURL, w, h, imgEl) {
    return {
      id: state._nextId++,
      nombre: nombre,
      dataURL: dataURL,
      w: w, h: h,
      imgEl: imgEl,
      escala_mm_px: null,
      escalaLinea: null,
      bayas: [],
      racimo: null,
      ficha: {
        id_racimo: '', fecha: '', variedad: '', fase_fenologica: '',
        tratamiento: '', vigor: '', orientacion: '', sistema_conduccion: '',
      },
      verdad: {
        N_total_real: '', Diam_real_mm: '', Peso_baya_real_g: '', Peso_racimo_real_g: '',
      },
    };
  };

  MV.current = function () {
    if (state.currentIndex < 0 || state.currentIndex >= state.images.length) return null;
    return state.images[state.currentIndex];
  };

  // --- Historial (deshacer/rehacer) -----------------------------------
  // Guardamos un snapshot ligero de las anotaciones de la imagen actual.
  function snapshot() {
    const img = MV.current();
    if (!img) return null;
    return JSON.stringify({
      idx: state.currentIndex,
      bayas: img.bayas,
      racimo: img.racimo,
      escalaLinea: img.escalaLinea,
      escala_mm_px: img.escala_mm_px,
    });
  }

  MV.pushHistory = function () {
    const s = snapshot();
    if (s === null) return;
    state.history.push(s);
    if (state.history.length > 80) state.history.shift();
    state.future.length = 0;
  };

  function applySnap(snapStr) {
    const snap = JSON.parse(snapStr);
    const img = state.images[snap.idx];
    if (!img) return;
    state.currentIndex = snap.idx;
    img.bayas = snap.bayas;
    img.racimo = snap.racimo;
    img.escalaLinea = snap.escalaLinea;
    img.escala_mm_px = snap.escala_mm_px;
  }

  MV.undo = function () {
    if (state.history.length === 0) return false;
    const cur = snapshot();
    const prev = state.history.pop();
    if (cur) state.future.push(cur);
    applySnap(prev);
    return true;
  };

  MV.redo = function () {
    if (state.future.length === 0) return false;
    const cur = snapshot();
    const next = state.future.pop();
    if (cur) state.history.push(cur);
    applySnap(next);
    return true;
  };

  // --- Serialización del proyecto -------------------------------------
  MV.serializeProject = function (includeImages) {
    return {
      app: 'ModelVinya',
      version: 1,
      savedAt: new Date().toISOString(),
      images: state.images.map(function (im) {
        const o = {
          id: im.id, nombre: im.nombre, w: im.w, h: im.h,
          escala_mm_px: im.escala_mm_px, escalaLinea: im.escalaLinea,
          bayas: im.bayas, racimo: im.racimo, ficha: im.ficha, verdad: im.verdad,
        };
        if (includeImages) o.dataURL = im.dataURL;
        return o;
      }),
    };
  };

  // Autosave ligero (sin imágenes, para no exceder la cuota de localStorage)
  MV.autosave = function () {
    try {
      const data = MV.serializeProject(false);
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { /* cuota llena u otro: ignorar */ }
  };

  MV.loadAutosave = function () {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  };

})();
