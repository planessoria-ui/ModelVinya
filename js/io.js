/* =========================================================================
 * io.js — Guardar/cargar proyecto y exportar (CSV, YOLO, ZIP, data.yaml)
 * Expone MV.io
 * ======================================================================= */
window.MV = window.MV || {};

(function () {
  'use strict';

  const state = MV.state;

  // ---- Descarga genérica ---------------------------------------------
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
  function downloadText(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename);
  }

  // ---- Guardar proyecto (.json con imágenes embebidas) ---------------
  function saveProject() {
    if (!state.images.length) { MV.toast('No hay imágenes que guardar.', true); return; }
    const data = MV.serializeProject(true);
    downloadText(JSON.stringify(data, null, 2), 'modelvinya_proyecto.json', 'application/json');
    MV.toast('Proyecto guardado.');
  }

  // ---- Cargar proyecto (.json) ---------------------------------------
  function loadProjectObject(data, done) {
    if (!data || !Array.isArray(data.images)) { MV.toast('Archivo de proyecto no válido.', true); return; }
    const imgs = data.images;
    let pending = 0, finished = false;
    state.images = [];
    state.currentIndex = -1;

    imgs.forEach(function (o) {
      const im = MV.newImage(o.nombre || 'imagen', o.dataURL || null, o.w || 0, o.h || 0, null);
      im.escala_mm_px = o.escala_mm_px || null;
      im.escalaLinea = o.escalaLinea || null;
      im.bayas = o.bayas || [];
      im.racimo = o.racimo || null;
      im.ficha = Object.assign(im.ficha, o.ficha || {});
      im.verdad = Object.assign(im.verdad, o.verdad || {});
      state.images.push(im);

      if (o.dataURL) {
        pending++;
        const el = new Image();
        el.onload = function () {
          im.imgEl = el;
          if (!im.w) im.w = el.naturalWidth;
          if (!im.h) im.h = el.naturalHeight;
          if (--pending === 0 && finished) done && done();
        };
        el.onerror = function () { if (--pending === 0 && finished) done && done(); };
        el.src = o.dataURL;
      }
    });
    finished = true;
    if (pending === 0) done && done();
  }

  // ---- Exportar CSV (tabla de entrenamiento del PDF) -----------------
  function exportCSV() {
    if (!state.images.length) { MV.toast('No hay datos que exportar.', true); return; }
    const cols = [
      'id_racimo', 'nombre_imagen', 'fecha', 'variedad', 'fase_fenologica', 'tratamiento',
      'vigor', 'orientacion', 'sistema_conduccion', 'mm_por_pixel',
      'N_visible', 'A_racimo_px2', 'A_racimo_mm2', 'A_baya_media_px2', 'A_baya_media_mm2',
      'Diam_visible_px', 'Diam_visible_mm', 'D_visible', 'Ocupacion',
      'N_total_real', 'Diam_real_mm', 'Peso_baya_real_g', 'Peso_racimo_real_g', 'FO_real',
    ];
    const rows = [cols.join(',')];

    state.images.forEach(function (im) {
      const m = MV.metrics.compute(im);
      const v = im.verdad, f = im.ficha;
      const r = [
        f.id_racimo, im.nombre, f.fecha, f.variedad, f.fase_fenologica, f.tratamiento,
        f.vigor, f.orientacion, f.sistema_conduccion, num(m.mm_px, 6),
        m.N_visible, num(m.A_racimo_px, 1), num(m.A_racimo_mm2, 2),
        num(m.A_baya_media_px, 1), num(m.A_baya_media_mm2, 2),
        num(m.Diam_visible_px, 2), num(m.Diam_visible_mm, 3),
        num(m.D_visible, 8), num(m.Ocupacion, 4),
        v.N_total_real, v.Diam_real_mm, v.Peso_baya_real_g, v.Peso_racimo_real_g, num(m.FO_real, 4),
      ];
      rows.push(r.map(csvCell).join(','));
    });

    downloadText('﻿' + rows.join('\n'), 'modelvinya_tabla_entrenamiento.csv', 'text/csv;charset=utf-8');
    MV.toast('CSV exportado (' + state.images.length + ' filas).');
  }
  function num(v, d) { return (v === null || v === undefined || isNaN(v)) ? '' : v.toFixed(d); }
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // ---- YOLO: etiquetas a partir de círculos (bbox cuadrada) ----------
  function yoloLabelFor(im) {
    if (!im.w || !im.h) return '';
    const lines = [];
    im.bayas.forEach(function (b) {
      const xc = clamp01(b.cx / im.w);
      const yc = clamp01(b.cy / im.h);
      const w = clamp01((2 * b.r) / im.w);
      const h = clamp01((2 * b.r) / im.h);
      lines.push('0 ' + f6(xc) + ' ' + f6(yc) + ' ' + f6(w) + ' ' + f6(h));
    });
    return lines.join('\n');
  }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function f6(x) { return x.toFixed(6); }
  function baseName(name) { return name.replace(/\.[^.]+$/, ''); }

  function exportYoloCurrent() {
    const im = MV.current();
    if (!im) { MV.toast('No hay imagen activa.', true); return; }
    if (!im.bayas.length) { MV.toast('Esta imagen no tiene bayas marcadas.', true); return; }
    downloadText(yoloLabelFor(im), baseName(im.nombre) + '.txt');
    MV.toast('Etiqueta YOLO exportada.');
  }

  function dataYamlText() {
    return [
      '# Plantilla de dataset YOLO generada por ModelVinya',
      'path: ./dataset',
      'train: images/train',
      'val: images/val',
      '',
      'names:',
      '  0: baya',
      '',
    ].join('\n');
  }
  function exportYaml() {
    downloadText(dataYamlText(), 'data.yaml');
    MV.toast('data.yaml exportado.');
  }

  // ---- YOLO dataset completo en .zip (store-only) --------------------
  function exportYoloZip() {
    if (!state.images.length) { MV.toast('No hay imágenes.', true); return; }
    const files = [];
    let withBerries = 0;
    state.images.forEach(function (im, i) {
      const base = safeName(im.nombre, i);
      // imagen
      if (im.dataURL) {
        const parsed = dataURLtoBytes(im.dataURL);
        if (parsed) files.push({ name: 'dataset/images/' + base.full, bytes: parsed.bytes });
      }
      // etiqueta
      const label = yoloLabelFor(im);
      if (im.bayas.length) withBerries++;
      files.push({ name: 'dataset/labels/' + base.stem + '.txt', bytes: strBytes(label + (label ? '\n' : '')) });
    });
    files.push({ name: 'dataset/data.yaml', bytes: strBytes(dataYamlText()) });
    files.push({ name: 'dataset/README.txt', bytes: strBytes(zipReadme()) });

    const blob = makeZip(files);
    downloadBlob(blob, 'modelvinya_yolo_dataset.zip');
    MV.toast('Dataset YOLO (.zip) exportado · ' + withBerries + ' imágenes con bayas.');
  }

  function zipReadme() {
    return [
      'Dataset YOLO generado por ModelVinya.',
      '',
      'Estructura:',
      '  images/   -> tus fotos de racimos',
      '  labels/   -> etiquetas YOLO (clase 0 = baya), una por imagen',
      '  data.yaml -> configuración del dataset',
      '',
      'IMPORTANTE: separa imágenes y etiquetas en subcarpetas train/ y val/',
      'antes de entrenar. Ejemplo de entrenamiento con Ultralytics YOLOv11:',
      '',
      '  pip install ultralytics',
      '  yolo detect train model=yolo11n.pt data=data.yaml epochs=100 imgsz=640',
      '',
    ].join('\n');
  }

  function safeName(name, i) {
    let n = (name || ('img_' + i)).replace(/[\\/:*?"<>|]+/g, '_');
    const stem = n.replace(/\.[^.]+$/, '') || ('img_' + i);
    let ext = (n.match(/\.[^.]+$/) || ['.jpg'])[0];
    return { full: stem + ext, stem: stem };
  }

  // ---- Utilidades dataURL/bytes --------------------------------------
  function dataURLtoBytes(dataURL) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataURL);
    if (!m) return null;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: m[1], bytes: bytes };
  }
  function strBytes(s) {
    return new TextEncoder().encode(s);
  }

  // ---- ZIP store-only (sin compresión) -------------------------------
  // CRC32
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    function push(arr) { parts.push(arr); offset += arr.length; }
    function u16(v) { return new Uint8Array([v & 255, (v >>> 8) & 255]); }
    function u32(v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); }
    function cat() {
      let len = 0; for (const a of arguments) len += a.length;
      const out = new Uint8Array(len); let p = 0;
      for (const a of arguments) { out.set(a, p); p += a.length; }
      return out;
    }

    files.forEach(function (f) {
      const nameBytes = enc.encode(f.name);
      const data = f.bytes;
      const crc = crc32(data);
      const localHeader = cat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0)
      );
      const localOffset = offset;
      push(localHeader); push(nameBytes); push(data);

      const centralHeader = cat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(localOffset)
      );
      central.push({ header: centralHeader, name: nameBytes });
    });

    const centralStart = offset;
    let centralSize = 0;
    central.forEach(function (c) {
      push(c.header); push(c.name);
      centralSize += c.header.length + c.name.length;
    });

    const end = cat(
      u32(0x06054b50), u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(centralSize), u32(centralStart), u16(0)
    );
    push(end);

    return new Blob(parts, { type: 'application/zip' });
  }

  MV.io = {
    saveProject: saveProject,
    loadProjectObject: loadProjectObject,
    exportCSV: exportCSV,
    exportYoloCurrent: exportYoloCurrent,
    exportYoloZip: exportYoloZip,
    exportYaml: exportYaml,
    downloadText: downloadText,
  };
})();
