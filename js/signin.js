// Sign In Sheet / Safety Meeting — recreado de ERS Forms (vertical, carta)
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let _logo = null;
async function logoBytes() {
  if (_logo) return _logo.slice(0);
  const r = await fetch("./assets/logo-full.png");
  _logo = new Uint8Array(await r.arrayBuffer());
  return _logo.slice(0);
}

const W = 612, H = 792;
const TD = (y) => H - y;

export async function fillSignIn({ project, day, shift }) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0), grid = rgb(0.11, 0.11, 0.11);
  const logo = await pdf.embedPng(await logoBytes());

  const text = (s, x, yTop, size, f = font) => { if (s != null && s !== "") page.drawText(String(s), { x, y: TD(yTop), size, font: f, color: black }); };
  const cen = (s, cx, yTop, size, f = font) => { if (s == null || s === "") return; const w = f.widthOfTextAtSize(String(s), size); text(s, cx - w / 2, yTop, size, f); };
  const fit = (s, x, yTop, maxSize, maxW, f = font) => { if (!s) return; let z = maxSize; while (z > 4 && f.widthOfTextAtSize(String(s), z) > maxW) z -= 0.5; text(s, x, yTop, z, f); };
  const vline = (x, y1, y2, w = 0.8) => page.drawLine({ start: { x, y: TD(y1) }, end: { x, y: TD(y2) }, thickness: w, color: grid });
  const hline = (x1, x2, y, w = 0.8) => page.drawLine({ start: { x: x1, y: TD(y) }, end: { x: x2, y: TD(y) }, thickness: w, color: grid });
  const field = (label, x, yTop, value, lineRight) => {
    text(label, x, yTop, 10, fontB);
    const lw = fontB.widthOfTextAtSize(label, 10);
    if (value) text(value, x + lw + 6, yTop, 10);
    hline(x + lw + 4, lineRight, yTop + 2.5, 0.7);
  };

  // Logo arriba-derecha
  const lw = 150, lh = lw * (192 / 692);
  page.drawImage(logo, { x: W - 18 - lw, y: TD(18 + lh), width: lw, height: lh });
  // Título
  cen("Sign In Sheet / Safety Meeting", 250, 44, 15, fontB);

  // Campos
  const date = (() => { const [y, m, d] = (day.date || "").split("-"); return day.date ? `${m}/${d}/${y.slice(2)}` : ""; })();
  const weekday = day.date ? EN_DAYS[new Date(day.date + "T00:00:00").getDay()] : "";
  field("Safety Topic:", 18, 80, "", 300);
  field("Conducted By:", 318, 80, "", 594);
  field("Duration:", 18, 102, "", 300);
  field("Location:", 318, 102, project.location || "", 594);
  field("Shift:", 18, 124, shift === "night" ? "Nights" : "Days", 300);
  field("Date:", 318, 124, date + (weekday ? "  (" + weekday + ")" : ""), 594);

  // Tabla
  const L = 18, R = 594;
  const X = [18, 40, 184, 386, 420, 478, 536, 594]; // #, Print Name, Sign Name, Trade, Time In, Time Out, Location
  const HEAD = ["#", "Print Name", "Sign Name", "Trade", "Time In", "Time Out", "Location"];
  const TOP = 142, HROW = 20, BOT = 766;
  // header
  hline(L, R, TOP, 1.2, black);
  hline(L, R, TOP + HROW, 1.2, black);
  HEAD.forEach((h, i) => cen(h, (X[i] + X[i + 1]) / 2, TOP + 13.5, i <= 1 ? 9.5 : 8.5, fontB));

  const workers = project.workers?.[shift] || [];
  const N = Math.max(32, workers.length);
  const rowH = (BOT - (TOP + HROW)) / N;
  const rowsTop = TOP + HROW;
  // líneas de filas
  for (let i = 1; i <= N; i++) hline(L, R, rowsTop + i * rowH, 0.5);
  // verticales
  X.forEach((x, i) => vline(x, TOP, BOT, (i === 0 || i === X.length - 1) ? 1.2 : 0.6));
  // marco exterior negro
  hline(L, R, BOT, 1.2, black);

  // contenido
  const ns = Math.max(7, Math.min(11, rowH - 8));
  workers.forEach((w, i) => {
    const baseY = rowsTop + i * rowH + rowH / 2 + ns * 0.34;
    cen(i + 1, (X[0] + X[1]) / 2, baseY, Math.max(6, ns - 1.5));
    fit(w.name, X[1] + 5, baseY, ns, X[2] - X[1] - 8);
    if (w.trade) cen(w.trade, (X[3] + X[4]) / 2, baseY, Math.max(6, ns - 1));
    if (day.absent && day.absent[w.id]) {
      page.drawRectangle({ x: L, y: TD(rowsTop + (i + 1) * rowH), width: R - L, height: rowH, color: rgb(1, 0.16, 0.16), opacity: 0.32 });
    }
  });
  // numeración de filas vacías restantes
  for (let i = workers.length; i < N; i++) {
    const baseY = rowsTop + i * rowH + rowH / 2 + ns * 0.34;
    cen(i + 1, (X[0] + X[1]) / 2, baseY, Math.max(6, ns - 1.5));
  }

  const bytes = await pdf.save();
  return { bytes, blob: new Blob([bytes], { type: "application/pdf" }) };
}

export function signInName(project, day, shift) {
  const num = (project.number || "project").replace(/[^\w-]+/g, "_");
  return `SignIn_${num}_${day.date}_${shift === "night" ? "Nights" : "Days"}.pdf`;
}
