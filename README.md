# Daily Hours · Elite Refractory

PWA bilingüe (ES/EN) para capturar horas diarias por proyecto y **rellenar automáticamente el WO file** (Daily Hours).
Funciona **offline** y se puede instalar en celular (iPhone/Android) o PC.

## Cómo usar / probar localmente
Necesita un servidor (los módulos y el PDF no cargan con `file://`):

```bash
cd wo-daily-hours
python -m http.server 8000
```
Abre http://localhost:8000

## Subir a un hosting (ej. tiini.host)
Sube **toda la carpeta** `wo-daily-hours/` tal cual. Debe servirse por **https** para que funcione como PWA instalable.

## Flujo
1. **Proyectos** → crear con número de proyecto, ubicación, supervisor y aprobado por (fijos).
2. **Trabajadores** → agregar/eliminar por turno (día/noche). Se guardan por proyecto, una sola vez.
3. **Captura del día** → elegir turno y fecha; agregar áreas (Kiln, etc.); capturar horas REG/OT/DT/PD por trabajador y área; registrar herramientas con cantidad.
   - **Sábado:** solo OT y PD.  **Domingo:** solo DT y PD. (Bloqueo automático por fecha.)
4. **Rellenar WO file** → genera el PDF llenado, lo descarga y lo guarda en el historial.
5. **Cerrar día / Nuevo día** → archiva el día y limpia las horas para el siguiente día (conserva trabajadores y áreas).
6. **Historial** → ver datos de cada día y volver a descargar el PDF.

## Estructura
- `index.html`, `css/styles.css`
- `js/app.js` — UI y lógica
- `js/db.js` — almacenamiento local (IndexedDB)
- `js/pdf.js` + `js/coords.js` — llenado del PDF (pdf-lib) y mapeo de coordenadas
- `js/i18n.js` — textos ES/EN · `js/tools.js` — lista de herramientas
- `assets/wo-template.pdf` — plantilla del WO file
- `manifest.webmanifest`, `sw.js`, `icons/` — soporte PWA / offline

> Los datos se guardan **solo en el dispositivo** (IndexedDB). No hay servidor ni nube.
