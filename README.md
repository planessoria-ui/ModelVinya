# 🍇 ModelVinya — Anotador de racimos (estilo VGG)

[![Abrir anotador](https://img.shields.io/badge/▶_Abrir-Anotador_web-2ea44f)](https://planessoria-ui.github.io/ModelVinya/)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/planessoria-ui/ModelVinya/blob/main/auto_labeling/sam3_to_modelvinya.ipynb)

Anotador de imágenes para viña, inspirado en **VGG Image Annotator (VIA)** y adaptado a la
metodología de los documentos del proyecto (conteo de bayas, diámetro y peso). Es una
aplicación **web estática**: no necesita instalación, ni servidor, ni conexión a internet.

> Detector de objectes per a comptar número de raïms per racim i cep i segmentació per a
> predir diàmetres a través de referència coneguda real.

## ¿Qué hace?

1. **Cargar fotos** de racimos.
2. **Marcar cada baya con un círculo** → conteo (`N_visible`) y diámetro a la vez.
3. **Definir la escala** con una referencia real (regla, moneda, tarjeta) → `mm/píxel`,
   para medir diámetros en **milímetros**.
4. **Dibujar el contorno del racimo** (polígono) → `A_racimo`.
5. **Rellenar la ficha agronómica** (variedad, fase fenológica, tratamiento, vigor…) y la
   **verdad terreno** (conteo manual, calibre, balanza).
6. **Calcular variables derivadas** en vivo: `N_visible`, `A_racimo`, `Diam_visible`,
   `D_visible`, `Ocupación`, `FO_real`.
7. **Exportar** los datos en los formatos necesarios para entrenar después.

## ¿Por qué un anotador y no un detector automático?

Un detector genérico **no** cuenta bayas de uva sin haber sido entrenado antes con tus
propias imágenes etiquetadas. Por eso el primer paso —el que cubre esta herramienta— es
crear la **verdad terreno** etiquetando a mano. Con esos datos se entrena luego **YOLOv11**,
que sí aprende a contar y a localizar bayas. Primero etiquetas tú → después el modelo aprende.

## 🤖 Etiquetado automático con SAM 3 (opcional)

Para **pre-marcar las bayas automáticamente** puedes usar **SAM 3** (Meta) en un notebook de
Google Colab (GPU gratuita): segmenta las bayas, las convierte en círculos y genera un
proyecto `.json` que abres en el anotador con «📦 Abrir proyecto» para revisar y corregir.

👉 **[Abrir el notebook en Google Colab](https://colab.research.google.com/github/planessoria-ui/ModelVinya/blob/main/auto_labeling/sam3_to_modelvinya.ipynb)**
 · detalles y requisitos en [`auto_labeling/`](auto_labeling/README.md).

## Cómo usarlo

Opción A (la más simple): **abre `index.html`** con doble clic en tu navegador.

Opción B (servidor local, recomendado si tu navegador bloquea algo en `file://`):

```bash
cd ModelVinya
python3 -m http.server 8000
# abre http://localhost:8000
```

### Flujo paso a paso (también disponible en el botón «❔ Guía»)

1. Captura la foto con una **referencia de escala** visible.
2. «📂 Cargar imágenes» y selecciona una en la lista de la izquierda.
3. **Escala (📏)**: traza una línea sobre la referencia e introduce su longitud real en mm.
4. **Baya (⭕)**: clic-arrastra para ajustar el círculo a cada baya (o un clic = radio por
   defecto, ajustable abajo a la derecha). El contador sube solo.
5. **Racimo (⬠)**: clic en cada vértice del contorno, doble clic para cerrar.
6. **Seleccionar (🖱)**: mover/redimensionar/borrar (tecla `Supr`).
7. Rellena **ficha** y **verdad terreno**.
8. **Exporta** (panel derecho).

### Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `B` / `R` / `E` / `S` | Herramienta baya / racimo / escala / seleccionar |
| `F` | Ajustar imagen a pantalla |
| Rueda del ratón | Zoom (centrado en el cursor) |
| Botón central/derecho o `Espacio`+arrastrar | Mover (pan) |
| `Ctrl+Z` / `Ctrl+Y` | Deshacer / rehacer |
| `Supr` | Borrar la anotación seleccionada |

## Exportaciones

- **📦 Proyecto `.json`** — guarda **todo** (imágenes embebidas + anotaciones + ficha). Vuelve
  a abrirlo con «📦 Abrir proyecto» para continuar exactamente donde lo dejaste.
- **📄 CSV** — la *tabla de entrenamiento* de los PDFs (una fila por racimo con métricas
  visibles + verdad terreno). Lista para análisis estadístico / regresión.
- **🔖 YOLO (imagen actual)** — un `.txt` con las cajas (clase `0 = baya`) de la imagen activa.
- **🗂 YOLO dataset `.zip`** — `images/`, `labels/` y `data.yaml` de todo el proyecto.
- **⚙ data.yaml** — plantilla de configuración del dataset.

> Autoguardado: las anotaciones (sin las imágenes, por límites del navegador) se guardan en el
> navegador. Para portabilidad completa usa siempre **Guardar proyecto `.json`**.

## Fase 2 (fuera de este anotador): entrenar el modelo

Con el `.zip` exportado, separa `images/` y `labels/` en `train/` y `val/` y entrena:

```bash
pip install ultralytics
yolo detect train model=yolo11n.pt data=data.yaml epochs=100 imgsz=640
```

El CSV sirve para entrenar la corrección por oclusión (`N_total = N_visible · FO_estimado`),
la calibración de diámetro y el modelo de peso, tal como describen los documentos del proyecto.

## Estructura del proyecto

```
index.html        Interfaz
css/style.css     Estilos
js/state.js       Estado, historial (deshacer/rehacer), serialización
js/metrics.js     Variables derivadas (fórmulas del flujo metodológico)
js/canvas.js      Render, zoom/pan, coordenadas
js/tools.js       Herramientas: baya, racimo, escala, seleccionar
js/io.js          Guardar/cargar proyecto y exportar (CSV, YOLO, ZIP)
js/app.js         Arranque y orquestación de la interfaz
```
