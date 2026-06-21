// Rellenado del WO file (Daily Hours) con pdf-lib
import * as C from "./coords.js";

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let _templateBytes = null;
async function templateBytes() {
  if (_templateBytes) return _templateBytes.slice(0);
  const res = await fetch("./assets/wo-template.pdf");
  _templateBytes = new Uint8Array(await res.arrayBuffer());
  return _templateBytes.slice(0);
}

const TD = (y) => C.PAGE.h - y; // top-down -> pdf-lib (bottom-left)

// Genera el PDF lleno (UNA sola hoja). Devuelve { bytes, blob }
export async function fillWO({ project, day, shift }) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.load(await templateBytes());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gridCol = rgb(0.11, 0.11, 0.11);
  const white = rgb(1, 1, 1);

  const drawCentered = (text, cx, yTop, size, f = font) => {
    if (text == null || text === "") return;
    const s = String(text), w = f.widthOfTextAtSize(s, size);
    page.drawText(s, { x: cx - w / 2, y: TD(yTop), size, font: f, color: black });
  };
  const drawLeft = (text, x, yTop, size, f = font) => {
    if (text == null || text === "") return;
    page.drawText(String(text), { x, y: TD(yTop), size, font: f, color: black });
  };
  const fitLeft = (text, x, yTop, maxSize, maxW, f = font) => {
    if (!text) return;
    let size = maxSize;
    while (size > 4 && f.widthOfTextAtSize(String(text), size) > maxW) size -= 0.5;
    drawLeft(text, x, yTop, size, f);
  };
  const fitCentered = (text, cx, yTop, maxSize, maxW, f = font) => {
    if (!text) return;
    let size = maxSize;
    while (size > 4 && f.widthOfTextAtSize(String(text), size) > maxW) size -= 0.5;
    drawCentered(text, cx, yTop, size, f);
  };

  // --- Encabezado ---
  drawLeft("Elite Refractory Services", C.HEADER.company.x, C.HEADER.company.y, 9, fontB);
  drawLeft(shift === "night" ? "Nights" : "Days", C.HEADER.shift.x, C.HEADER.shift.y, 9);
  if (project.location) drawLeft(project.location, C.HEADER.location.x, C.HEADER.location.y, 9);
  drawLeft(formatDate(day.date), C.HEADER.date.x, C.HEADER.date.y, 9);
  if (project.approvedBy) drawLeft(project.approvedBy, C.HEADER.approved.x, C.HEADER.approved.y, 9);
  const supervisor = (shift === "night" ? project.supervisorNight : project.supervisorDay) || project.supervisor;
  if (supervisor) drawLeft(supervisor, C.HEADER.supervisor.x, C.HEADER.supervisor.y, 9);

  // Día de la semana en inglés, arriba de la fecha (esquina superior derecha)
  const weekday = EN_DAYS[new Date(day.date + "T00:00:00").getDay()] || "";
  fitCentered(weekday, 727, 36, 11, 120, fontB);

  // --- Nombres de áreas ---
  const areas = (day.areas || []).slice(0, C.NUM_AREAS);
  areas.forEach((area, a) => {
    const cx = (C.groupLeft(a) + C.groupRight(a)) / 2;
    fitCentered(area.name, cx, C.areaNameBaseline(), 9, C.GROUP_WIDTH - 4, fontB);
  });

  // --- Trabajadores + horas ---
  const workers = project.workers?.[shift] || [];
  const drawWorkerRow = (wkr, baseY, nSize, hSize, tSize) => {
    if (wkr.trade) fitLeft(wkr.trade, C.NAME_LEFT - 16, baseY, tSize, 24, font);
    fitLeft(wkr.name, C.NAME_LEFT, baseY, nSize, 112, font);
    areas.forEach((area, a) => {
      const cell = day.hours?.[wkr.id]?.[area.id];
      if (!cell) return;
      C.COLS.forEach((col, c) => {
        const v = cell[col];
        if (v !== undefined && v !== null && v !== "" && Number(v) !== 0)
          drawCentered(v, C.cellCenterX(a, c), baseY, hSize);
      });
    });
  };

  if (workers.length <= C.WORKER_ROW.count) {
    // Caben en los recuadros impresos: alineados tal cual
    workers.forEach((wkr, i) => drawWorkerRow(wkr, C.workerRowBaseline(i), 8, 7.5, 7));
  } else {
    // Más de 23: redibujo la rejilla del cuerpo para que TODOS quepan en una hoja
    const N = workers.length;
    const TOPL = C.WORKER_ROW.top0;   // 118.4
    const BOTL = 348.6;               // justo arriba de "Equipment"
    const rowH = (BOTL - TOPL) / N;
    // tapa las líneas impresas del cuerpo
    page.drawRectangle({ x: 1.6, y: TD(BOTL), width: 789.2, height: BOTL - TOPL, color: white });
    // líneas verticales (Trade | Name | 8 áreas × 4)
    const vx = [1.4, 29, 148.2];
    for (let k = 1; k <= 32; k++) vx.push(148.2 + 20.05 * k);
    vx.forEach(x => page.drawLine({ start: { x, y: TD(TOPL) }, end: { x, y: TD(BOTL) }, thickness: 0.6, color: gridCol }));
    // líneas horizontales (N filas)
    for (let i = 0; i <= N; i++) {
      const y = TOPL + i * rowH;
      page.drawLine({ start: { x: 1.4, y: TD(y) }, end: { x: 789.8, y: TD(y) }, thickness: 0.6, color: gridCol });
    }
    const ns = Math.max(4.5, Math.min(8, rowH - 2));
    workers.forEach((wkr, i) => {
      const baseY = TOPL + i * rowH + rowH / 2 + ns * 0.34;
      drawWorkerRow(wkr, baseY, ns, ns, Math.max(4, ns - 0.5));
    });
  }

  // --- Equipo por área (si pasan de 8, compacta para que quepan) ---
  const EQ_BOTTOM = 449, EQ_TOP = C.equipRowBaseline(0);
  areas.forEach((area, a) => {
    const list = day.tools?.[area.id] || [];
    if (!list.length) return;
    let gap = C.EQUIP_ROW.height;
    if (list.length > C.EQUIP_ROW.count) gap = Math.min(gap, (EQ_BOTTOM - EQ_TOP) / (list.length - 1));
    const size = gap < 7.5 ? Math.max(5, gap - 0.8) : 6.5;
    list.forEach((item, j) => {
      fitLeft(`${item.qty}x ${item.tool}`, C.equipTextLeft(a), EQ_TOP + j * gap, size, C.EQUIP_MAX_WIDTH);
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
