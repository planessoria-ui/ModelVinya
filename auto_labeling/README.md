# 🍇 Etiquetatge automàtic amb SAM 3

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/planessoria-ui/ModelVinya/blob/main/auto_labeling/sam3_to_modelvinya.ipynb)

Aquest mòdul fa servir **SAM 3** (Meta Segment Anything Model 3) per **pre-etiquetar baies
automàticament** a partir d'un *prompt* de text (p. ex. `berry`). Segmenta les baies, les
converteix en **cercles** (centre + diàmetre equivalent `D = 2·√(A/π)`) i genera un
**projecte `.json` de ModelVinya** que obres a l'anotador per revisar i corregir.

> SAM 3 és un model de PyTorch de ~848M de paràmetres: **necessita GPU** i **no pot córrer al
> navegador**. Per això l'integrem com un notebook de Colab (GPU gratuïta) que produeix el `.json`
> que l'app sap importar. L'app continua sent 100% estàtica.

## Requisits
- **GPU** (a Colab: *Entorn d'execució → Canviar el tipus d'entorn → GPU*).
- **Accés als checkpoints** (gated): demana accés a <https://huggingface.co/facebook/sam3> i crea
  un token a <https://huggingface.co/settings/tokens>.

## Passos
1. Obre el notebook a Colab amb el botó de dalt.
2. Executa les cel·les en ordre: instal·la SAM 3 → login a Hugging Face → carrega el model.
3. Ajusta `PROMPT` i els llindars, puja les teves fotos de racims i executa la inferència.
4. Descarrega `modelvinya_sam3_proyecto.json`.
5. A l'anotador (<https://planessoria-ui.github.io/ModelVinya/>): **📦 Abrir proyecto** → tria el
   `.json`. Revisa els cercles, defineix l'escala (📏) per tenir mm, omple la fitxa i exporta.

## Conversió màscara → cercle
Per a cada màscara de SAM 3 es calcula:
- **centre** = centroide dels píxels de la màscara,
- **radi** = `√(A/π)` amb `A` = nombre de píxels de la màscara (equival al diàmetre equivalent
  del PDF, `D = 2·√(A/π)`).

Es filtren deteccions per **confiança** (`SCORE_MIN`) i per **àrea** (`AREA_MIN_FRAC` /
`AREA_MAX_FRAC`) per descartar soroll i evitar agafar el racim sencer.

## Limitacions honestes
- En racims **molt densos** el prompt de text pot agrupar baies; cal ajustar `PROMPT`/llindars o
  usar prompts visuals (punts/caixes) — ampliable al notebook.
- SAM 3 detecta **baies visibles**; les amagades les corregeix el model d'oclusió (fase 2).
- La precisió final sempre s'ha de **revisar a mà** a l'anotador abans d'entrenar.
