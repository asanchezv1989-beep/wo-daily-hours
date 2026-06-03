// Mapeo de coordenadas del WO file (Daily Hours)
// Medidas en sistema TOP-DOWN (origen arriba-izquierda), como las da el PDF.
// pdf.js las convierte al sistema de pdf-lib (origen abajo-izquierda).

export const PAGE = { w: 792, h: 612 };

// Estructura de columnas: 8 áreas, cada una con 4 sub-columnas ST/OT/DT/PD
export const NUM_AREAS = 8;
export const COLS = ["ST", "OT", "DT", "PD"]; // ST = REG

// Geometría horizontal de la rejilla
const GROUP_LEFT_0 = 148.2;   // borde izq. del área 1
const GROUP_WIDTH = 80.2;     // ancho de cada grupo de 4 columnas
const SUBCELL_W = 20.05;      // ancho de cada sub-celda
const SUBCELL_C0 = 10.0;      // centro de la 1ª sub-celda relativo al borde del grupo

// Centro X de una celda de horas (top-down)
export function cellCenterX(area, col) {
  return GROUP_LEFT_0 + GROUP_WIDTH * area + SUBCELL_C0 + SUBCELL_W * col;
}

// Borde izquierdo del grupo de un área
export function groupLeft(area) {
  return GROUP_LEFT_0 + GROUP_WIDTH * area;
}
export function groupRight(area) {
  return GROUP_LEFT_0 + GROUP_WIDTH * (area + 1);
}

// Filas de trabajadores (horas)
export const WORKER_ROW = { top0: 118.4, height: 10.06, count: 23 };
// Y de la línea base del texto en la fila i (top-down)
export function workerRowBaseline(i) {
  return WORKER_ROW.top0 + i * WORKER_ROW.height + 7.6;
}

// Columnas de la izquierda (Trade / Name)
export const TRADE_CX = 15.2;   // centro col. Trade
export const NAME_LEFT = 32.0;  // inicio col. Name

// Recuadro del nombre de área (arriba de ST/OT/DT/PD)
export const AREA_NAME_BOX = { top: 81.5, bottom: 106.6 };
export function areaNameBaseline() {
  return 98.0; // baseline dentro del recuadro
}

// Sección de equipo (debajo de "Equipment")
export const EQUIP_ROW = { top0: 359.8, height: 10.07, count: 8 };
export function equipRowBaseline(j) {
  return EQUIP_ROW.top0 + j * EQUIP_ROW.height + 7.4;
}
export function equipTextLeft(area) {
  return groupLeft(area) + 2.5;
}
export const EQUIP_MAX_WIDTH = GROUP_WIDTH - 4;

// Campos del encabezado / pie (baseline, top-down)
export const HEADER = {
  company:  { x: 40,  y: 54.5 },   // Company:  (fijo: Elite Refractory)
  shift:    { x: 712, y: 54.5 },   // Days / Nights:
  location: { x: 62,  y: 66.3 },   // Project Location:
  date:     { x: 712, y: 66.3 },   // Date:
  approved: { x: 52,  y: 452.2 },  // Approved By:
  supervisor: { x: 472, y: 452.2 } // Supervisor:
};
