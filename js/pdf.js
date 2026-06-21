// Rellenado del WO file (Daily Hours) con pdf-lib.
// Redibuja la tabla con SOLO las áreas activas (más anchas) en una sola hoja.
import * as C from "./coords.js";

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let _templateBytes = null;
async function templateBytes() {
  if (_templateBytes) return _templateBytes.slice(0);
  const res = await fetch("./assets/wo-template.pdf");
  _templateBytes = new Uint8Array(await res.arrayBuffer());
  return _templateBytes.slice(0);
}

const TD = (y) => C.PAGE.h - y;

// Geometría de la tabla (aprovecha más alto de la hoja para renglones más altos)
const G = {
  L: 1.4, TRADE_R: 29, NAME_R: 148.2, AREA_R: 789.8,
  AN_TOP: 81.5, COL_TOP: 106.6, ROWS_TOP: 117.8, ROWS_BOT: 452, EQ_TOP: 463, BOT: 556, FOOTER_Y: 578
};

export async function fillWO({ project, day, shift }) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.load(await templateBytes());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0), grid = rgb(0.13, 0.13, 0.13), white = rgb(1, 1, 1);

  const text = (s, x, yTop, size, f = font) => { if (s != null && s !== "") page.drawText(String(s), { x, y: TD(yTop), size, font: f, color: black }); };
  const cen = (s, cx, yTop, size, f = font) => { if (s == null || s === "") return; const w = f.widthOfTextAtSize(String(s), size); text(s, cx - w / 2, yTop, size, f); };
  const fit = (s, x, yTop, maxSize, maxW, f = font) => { if (!s) return; let z = maxSize; while (z > 3.5 && f.widthOfTextAtSize(String(s), z) > maxW) z -= 0.5; text(s, x, yTop, z, f); };
  const fitCen = (s, cx, yTop, maxSize, maxW, f = font) => { if (!s) return; let z = maxSize; while (z > 3.5 && f.widthOfTextAtSize(String(s), z) > maxW) z -= 0.5; cen(s, cx, yTop, z, f); };
  const vline = (x, y1, y2, w, col = grid) => page.drawLine({ start: { x, y: TD(y1) }, end: { x, y: TD(y2) }, thickness: w, color: col });
  const hline = (x1, x2, y, w, col = grid) => page.drawLine({ start: { x: x1, y: TD(y) }, end: { x: x2, y: TD(y) }, thickness: w, color: col });

  // --- Encabezado (de la plantilla) ---
  text("Elite Refractory Services", C.HEADER.company.x, C.HEADER.company.y, 9, fontB);
  text(shift === "night" ? "Nights" : "Days", C.HEADER.shift.x, C.HEADER.shift.y, 9);
  if (project.location) text(project.location, C.HEADER.location.x, C.HEADER.location.y, 9);
  text(formatDate(day.date), C.HEADER.date.x, C.HEADER.date.y, 9);
  const supervisor = (shift === "night" ? project.supervisorNight : project.supervisorDay) || project.supervisor;
  const weekday = EN_DAYS[new Date(day.date + "T00:00:00").getDay()] || "";
  fitCen(weekday, 727, 36, 11, 120, fontB);

  const areas = (day.areas || []).slice(0, C.NUM_AREAS);
  const workers = project.workers?.[shift] || [];
  const N = areas.length;

  if (N === 0) { // sin áreas: deja la plantilla en blanco
    const bytes = await pdf.save();
    return { bytes, blob: new Blob([bytes], { type: "application/pdf" }) };
  }

  // Tapa la tabla impresa y el pie impreso (los redibujamos más abajo)
  page.drawRectangle({ x: 1.0, y: TD(G.FOOTER_Y + 8), width: 790, height: (G.FOOTER_Y + 8) - (G.AN_TOP - 1), color: white });

  const groupW = (G.AREA_R - G.NAME_R) / N;
  const subW = groupW / 4;
  const gLeft = (a) => G.NAME_R + groupW * a;
  const cellCX = (a, c) => gLeft(a) + subW * (c + 0.5);
  const COLS = ["ST", "OT", "DT", "PD"];

  // ---- Líneas de la tabla ----
  // horizontales principales
  hline(G.NAME_R, G.AREA_R, G.AN_TOP, 1.4, black);     // techo de recuadros de área
  hline(G.L, G.AREA_R, G.COL_TOP, 1.0);                 // bajo recuadros de área / techo de etiquetas
  hline(G.L, G.AREA_R, G.ROWS_TOP, 1.0);                // bajo ST/OT/DT/PD
  hline(G.L, G.AREA_R, G.ROWS_BOT, 1.0);                // fin de filas
  hline(G.NAME_R, G.AREA_R, G.EQ_TOP, 0.8);             // bajo "Equipment"
  hline(G.L, G.AREA_R, G.BOT, 1.4, black);              // piso de la tabla

  // filas de trabajadores (rellena la zona; mínimo 23 para que se vea como forma)
  const R = Math.max(C.WORKER_ROW.count, workers.length);
  const rowH = (G.ROWS_BOT - G.ROWS_TOP) / R;
  for (let i = 1; i < R; i++) hline(G.L, G.AREA_R, G.ROWS_TOP + i * rowH, 0.4);

  // verticales: izquierda (Trade/Name) y sub-columnas
  vline(G.L, G.COL_TOP, G.BOT, 1.4, black);            // borde izquierdo
  vline(G.TRADE_R, G.COL_TOP, G.BOT, 0.6);             // Trade | Name
  for (let a = 0; a < N; a++) {
    for (let k = 1; k < 4; k++) vline(gLeft(a) + subW * k, G.COL_TOP, G.ROWS_BOT, 0.4); // sub-columnas
  }
  // separadores de área en NEGRO grueso (lo que marcaste)
  for (let a = 0; a <= N; a++) vline(gLeft(a), G.AN_TOP, G.BOT, 1.6, black);

  // ---- Encabezados ----
  text("JOBS", 58, 100, 8, fontB);
  cen("Trade", (G.L + G.TRADE_R) / 2, 114.5, 7.5, fontB);
  cen("Name", (G.TRADE_R + G.NAME_R) / 2, 114.5, 7.5, fontB);
  areas.forEach((area, a) => {
    fitCen(area.name, gLeft(a) + groupW / 2, 98, 11, groupW - 8, fontB);
    COLS.forEach((c, ci) => cen(c, cellCX(a, ci), 114.5, 7, fontB));
    cen("Equipment", gLeft(a) + groupW / 2, G.ROWS_BOT + 8, 8, font);
  });

  // ---- Trabajadores + horas ----
  const ns = Math.max(5.5, Math.min(9, rowH - 3));
  workers.forEach((w, i) => {
    const baseY = G.ROWS_TOP + i * rowH + rowH / 2 + ns * 0.34;
    if (w.trade) fitCen(w.trade, (G.L + G.TRADE_R) / 2, baseY, Math.max(4, ns - 0.5), G.TRADE_R - G.L - 2);
    fit(w.name, G.TRADE_R + 3, baseY, ns, G.NAME_R - G.TRADE_R - 5);
    areas.forEach((area, a) => {
      const cell = day.hours?.[w.id]?.[area.id];
      if (!cell) return;
      COLS.forEach((col, c) => {
        const v = cell[col];
        if (v !== undefined && v !== null && v !== "" && Number(v) !== 0) cen(v, cellCX(a, c), baseY, ns);
      });
    });
    // Trabajador ausente/despedido: marcatexto rojo transparente sobre su línea
    if (day.absent && day.absent[w.id]) {
      page.drawRectangle({
        x: G.L, y: TD(G.ROWS_TOP + (i + 1) * rowH),
        width: G.AREA_R - G.L, height: rowH, color: rgb(1, 0.16, 0.16), opacity: 0.32
      });
    }
  });

  // ---- Equipo por área ----
  const eqTop = G.EQ_TOP + 8, eqMaxW = groupW - 5;
  areas.forEach((area, a) => {
    const list = day.tools?.[area.id] || [];
    if (!list.length) return;
    let gap = 11;
    const avail = G.BOT - eqTop;
    if (list.length * gap > avail) gap = avail / list.length;
    const size = gap < 8 ? Math.max(5, gap - 1) : 7;
    list.forEach((it, j) => fit(`${it.qty}x ${it.tool}`, gLeft(a) + 3, eqTop + j * gap, size, eqMaxW));
  });

  // ---- Pie: Approved By / Supervisor (redibujado abajo) ----
  text("Approved By :", 3, G.FOOTER_Y, 9);
  if (project.approvedBy) text(project.approvedBy, 75, G.FOOTER_Y, 9);
  hline(72, 470, G.FOOTER_Y + 3, 0.8, black);
  text("Supervisor :", 500, G.FOOTER_Y, 9);
  if (supervisor) text(supervisor, 560, G.FOOTER_Y, 9);
  hline(557, 785, G.FOOTER_Y + 3, 0.8, black);

  const bytes = await pdf.save();
  return { bytes, blob: new Blob([bytes], { type: "application/pdf" }) };
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

export function fileName(project, day, shift) {
  const num = (project.number || "project").replace(/[^\w-]+/g, "_");
  return `WO_${num}_${day.date}_${shift === "night" ? "Nights" : "Days"}.pdf`;
}
