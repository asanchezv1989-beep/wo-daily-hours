// Catálogo central (Google Sheets) — proyectos y trabajadores administrados por el admin.
// La app lee este CSV en modo SOLO LECTURA; los supervisores solo capturan horas.

// URL del catálogo. La app lee la lista de proyectos/cuadrillas desde este CSV.
// Se actualiza regenerando assets/roster.csv desde el Excel de ManPower y redesplegando.
export const CATALOG_URL = "./assets/roster.csv";

export const CATALOG_MODE = !!CATALOG_URL;

function slug(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Parser CSV con soporte de comillas y comas dentro de campos
function parseCSV(text) {
  const rows = []; let row = [], field = "", inQ = false;
  text = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function buildCatalog(rows) {
  if (!rows.length) return [];
  const header = rows[0].map(h => String(h).trim().toLowerCase());
  const iP = header.indexOf("project"), iS = header.indexOf("shift"),
        iT = header.indexOf("trade"), iN = header.indexOf("name");
  const hasHeader = iP >= 0 && iN >= 0;
  const cP = iP >= 0 ? iP : 0, cS = iS >= 0 ? iS : 1, cT = iT >= 0 ? iT : 2, cN = iN >= 0 ? iN : 3;
  const map = {}; const usedIds = {};
  for (let r = hasHeader ? 1 : 0; r < rows.length; r++) {
    const row = rows[r]; if (!row) continue;
    const proj = (row[cP] || "").trim(), name = (row[cN] || "").trim();
    if (!proj || !name) continue;
    const shift = (row[cS] || "").trim().toLowerCase().startsWith("night") ? "night" : "day";
    const trade = (row[cT] || "").trim();
    const key = slug(proj);
    if (!map[key]) {
      map[key] = {
        key, number: proj,
        location: proj.includes(" - ") ? proj.split(" - ").slice(1).join(" - ").trim() : "",
        supDay: "", supNight: "", workers: { day: [], night: [] }
      };
      usedIds[key] = new Set();
    }
    const c = map[key];
    let base = `${shift[0]}_${slug(trade)}_${slug(name)}`, id = base, k = 2;
    while (usedIds[key].has(id)) id = base + "-" + (k++);
    usedIds[key].add(id);
    c.workers[shift].push({ id, name, trade });
    if (trade.toUpperCase() === "S") {
      if (shift === "day" && !c.supDay) c.supDay = name;
      if (shift === "night" && !c.supNight) c.supNight = name;
    }
  }
  return Object.values(map);
}

export async function fetchCatalog(url = CATALOG_URL) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  let text = await res.text();
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // quita BOM de Google
  return buildCatalog(parseCSV(text));
}
