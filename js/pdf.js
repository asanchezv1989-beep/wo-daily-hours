// Rellenado del WO file (Daily Hours) con pdf-lib
import * as C from "./coords.js";

let _templateBytes = null;
async function templateBytes() {
  if (_templateBytes) return _templateBytes.slice(0);
  const res = await fetch("./assets/wo-template.pdf");
  _templateBytes = new Uint8Array(await res.arrayBuffer());
  return _templateBytes.slice(0);
}

const TD = (y) => C.PAGE.h - y; // top-down -> pdf-lib (bottom-left)

// Genera el PDF lleno. Devuelve { bytes, blob }
export async function fillWO({ project, day, shift, weekdayName }) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.load(await templateBytes());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const drawCentered = (text, cx, yTop, size, f = font) => {
    if (text == null || text === "") return;
    const s = String(text);
    const w = f.widthOfTextAtSize(s, size);
    page.drawText(s, { x: cx - w / 2, y: TD(yTop), size, font: f, color: black });
  };
  const drawLeft = (text, x, yTop, size, f = font) => {
    if (text == null || text === "") return;
    page.drawText(String(text), { x, y: TD(yTop), size, font: f, color: black });
  };
  // Ajusta el tamaño de fuente para que el texto quepa en maxW
  const fitLeft = (text, x, yTop, maxSize, maxW, f = font) => {
    if (!text) return;
    let size = maxSize;
    while (size > 4 && f.widthOfTextAtSize(String(text), size) > maxW) size -= 0.5;
    drawLeft(text, x, yTop, size, f);
  };

  // --- Encabezado ---
  drawLeft("Elite Refractory Services", C.HEADER.company.x, C.HEADER.company.y, 9, fontB);
  drawLeft(shift === "night" ? "Nights" : "Days", C.HEADER.shift.x, C.HEADER.shift.y, 9);
  if (project.location) drawLeft(project.location, C.HEADER.location.x, C.HEADER.location.y, 9);
  drawLeft(formatDate(day.date), C.HEADER.date.x, C.HEADER.date.y, 9);
  if (project.approvedBy) drawLeft(project.approvedBy, C.HEADER.approved.x, C.HEADER.approved.y, 9);
  if (project.supervisor) drawLeft(project.supervisor, C.HEADER.supervisor.x, C.HEADER.supervisor.y, 9);

  // --- Nombres de áreas (recuadro superior) ---
  const areas = (day.areas || []).slice(0, C.NUM_AREAS);
  areas.forEach((area, a) => {
    const cx = (C.groupLeft(a) + C.groupRight(a)) / 2;
    fitLeftCentered(area.name, cx, C.areaNameBaseline(), 9, C.GROUP_WIDTH - 4, fontB);
  });
  function fitLeftCentered(text, cx, yTop, maxSize, maxW, f) {
    if (!text) return;
    let size = maxSize;
    while (size > 4 && f.widthOfTextAtSize(String(text), size) > maxW) size -= 0.5;
    drawCentered(text, cx, yTop, size, f);
  }

  // --- Trabajadores + horas ---
  const workers = (project.workers?.[shift] || []).slice(0, C.WORKER_ROW.count);
  workers.forEach((wkr, i) => {
    const baseY = C.workerRowBaseline(i);
    if (wkr.trade) fitLeft(wkr.trade, C.NAME_LEFT - 16, baseY, 7, 24, font); // Trade (col estrecha)
    fitLeft(wkr.name, C.NAME_LEFT, baseY, 8, 112, font);                     // Name
    areas.forEach((area, a) => {
      const cell = day.hours?.[wkr.id]?.[area.id];
      if (!cell) return;
      C.COLS.forEach((col, c) => {
        const v = cell[col];
        if (v !== undefined && v !== null && v !== "" && Number(v) !== 0)
          drawCentered(v, C.cellCenterX(a, c), baseY, 7.5);
      });
    });
  });

  // --- Equipo por área ---
  areas.forEach((area, a) => {
    const list = (day.tools?.[area.id] || []).slice(0, C.EQUIP_ROW.count);
    list.forEach((item, j) => {
      const label = `${item.qty}x ${item.tool}`;
      fitLeft(label, C.equipTextLeft(a), C.equipRowBaseline(j), 6.5, C.EQUIP_MAX_WIDTH);
    });
  });

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  return { bytes, blob };
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`; // MM/DD/AA (USA, año 2 dígitos)
}

export function fileName(project, day, shift) {
  const num = (project.number || "project").replace(/[^\w-]+/g, "_");
  return `WO_${num}_${day.date}_${shift === "night" ? "Nights" : "Days"}.pdf`;
}
