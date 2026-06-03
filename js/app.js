import * as DB from "./db.js";
import { TOOLS } from "./tools.js";
import { t, getLang, setLang } from "./i18n.js";
import { fillWO, fileName } from "./pdf.js";
import { COLS } from "./coords.js";

const MAX_WORKERS = 23, MAX_AREAS = 8;

const state = {
  route: "projects",      // 'projects' | 'project'
  projectId: null,
  project: null,
  tab: "workers",         // 'workers' | 'capture' | 'history'
  captureShift: localStorage.getItem("wo_shift_role") || "day", // 'day' | 'night'
  toolArea: null
};

function getRole() { return localStorage.getItem("wo_shift_role"); }
function setRole(s) { localStorage.setItem("wo_shift_role", s); state.captureShift = s; }

/* ---------- utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dowOf(iso) { return new Date(iso + "T00:00:00").getDay(); }
function colEnabled(col, iso) {
  const d = dowOf(iso);
  if (d === 6) return col === "OT" || col === "PD";  // Sábado
  if (d === 0) return col === "DT" || col === "PD";  // Domingo
  return true;
}
function weekdayName(iso) { return t("weekdays")[dowOf(iso)]; }
// Formato USA: MM/DD/AA (año de 2 dígitos)
function fmtUS(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}
function prettyDate(iso) {
  if (!iso) return "";
  return `${weekdayName(iso)} ${fmtUS(iso)}`;
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "?";
}

const ICON = {
  flame: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1 .3-1.8.7-2.5C8 9 7 11 7 13a5 5 0 1 0 10 0c0-5-5-7-5-11Z" fill="#fff"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
};

// Pastilla "Mi turno: Día/Noche" (abre el selector)
function shiftRolePill() {
  const role = getRole() || "day";
  return el("button", { class: "btn btn-ghost shift-pill", onclick: () => roleChooser(false) },
    el("span", { class: "dot " + role }),
    el("span", {}, t("myShift") + ": "),
    el("b", {}, t(role))
  );
}

/* ---------- toast & modal ---------- */
function toast(msg, type = "") {
  const old = $(".toast"); if (old) old.remove();
  const n = el("div", { class: "toast " + type }, type === "ok" ? span(ICON.check) : null, msg);
  document.body.append(n);
  setTimeout(() => n.remove(), 2600);
}
function span(html) { const s = document.createElement("span"); s.style.display = "inline-flex"; s.innerHTML = html; s.firstChild.style.width = "17px"; s.firstChild.style.height = "17px"; return s; }

function confirmBox(message, onYes, confirmLabel) {
  const ov = el("div", { class: "overlay", onclick: e => { if (e.target === ov) ov.remove(); } },
    el("div", { class: "modal" },
      el("h3", {}, message),
      el("div", { class: "row" },
        el("button", { class: "btn btn-ghost", onclick: () => ov.remove() }, t("cancel")),
        el("button", { class: "btn btn-primary", onclick: () => { ov.remove(); onYes(); } }, confirmLabel || t("delete"))
      )
    )
  );
  document.body.append(ov);
}

// Modal inicial: elegir turno (rol del supervisor)
function roleChooser(force) {
  const pick = (s) => { setRole(s); ov.remove(); render(); };
  const ov = el("div", { class: "overlay", onclick: e => { if (force ? false : e.target === ov) ov.remove(); } },
    el("div", { class: "modal" },
      el("h3", {}, t("chooseRole")),
      el("div", { class: "role-pick" },
        el("button", { class: "role-btn day" + (getRole() === "day" ? " on" : ""), onclick: () => pick("day") },
          el("span", { class: "dot" }), el("b", {}, t("dayShift"))),
        el("button", { class: "role-btn night" + (getRole() === "night" ? " on" : ""), onclick: () => pick("night") },
          el("span", { class: "dot" }), el("b", {}, t("nightShift")))
      ),
      el("p", { class: "hint", style: "margin-top:14px;text-align:center" }, t("roleHint"))
    )
  );
  document.body.append(ov);
}

function formModal(title, fields, onSubmit) {
  const inputs = {};
  const body = fields.map(f => {
    const inp = f.type === "select"
      ? el("select", { class: "input" }, ...f.options.map(o => el("option", { value: o.value }, o.label)))
      : el("input", { class: "input", type: f.type || "text", placeholder: f.placeholder || "" });
    if (f.value) inp.value = f.value;
    inputs[f.name] = inp;
    return el("div", { class: "field" }, el("label", {}, f.label), inp);
  });
  const ov = el("div", { class: "overlay", onclick: e => { if (e.target === ov) ov.remove(); } },
    el("div", { class: "modal" },
      el("h3", {}, title),
      ...body,
      el("div", { class: "row" },
        el("button", { class: "btn btn-ghost", onclick: () => ov.remove() }, t("cancel")),
        el("button", {
          class: "btn btn-primary", onclick: () => {
            const vals = {}; for (const k in inputs) vals[k] = inputs[k].value.trim();
            if (onSubmit(vals) !== false) ov.remove();
          }
        }, t("save"))
      )
    )
  );
  document.body.append(ov);
  setTimeout(() => body[0]?.querySelector(".input")?.focus(), 50);
}

/* ---------- persistence helpers ---------- */
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => DB.saveProject(state.project), 250);
}
function persistNow() { clearTimeout(saveTimer); return DB.saveProject(state.project); }

function ensureDraft(project, shift) {
  project.drafts = project.drafts || {};
  if (!project.drafts[shift]) project.drafts[shift] = { date: todayISO(), areas: [], hours: {}, tools: {} };
  const d = project.drafts[shift];
  d.areas = d.areas || []; d.hours = d.hours || {}; d.tools = d.tools || {};
  if (!d.date) d.date = todayISO();
  return d;
}

/* ---------- root render ---------- */
const root = document.getElementById("app");
async function render() {
  root.innerHTML = "";
  // language toggle reflect
  document.querySelectorAll(".lang-toggle button").forEach(b => b.classList.toggle("active", b.dataset.l === getLang()));
  if (state.route === "projects") return renderProjects();
  if (state.route === "project") return renderProject();
}

/* ---------- PROJECTS ---------- */
async function renderProjects() {
  const projects = await DB.allProjects();
  const head = el("div", { class: "page-head" },
    el("div", { class: "titles" }, el("h2", {}, t("projects")), el("p", {}, "Elite Refractory Services")),
    el("div", { class: "spacer" }),
    shiftRolePill(),
    el("button", { class: "btn btn-primary", onclick: newProject }, span(ICON.plus), t("newProject"))
  );
  const wrap = el("div", { class: "wrap" }, head);
  if (!projects.length) {
    wrap.append(el("div", { class: "card empty" }, el("div", { html: ICON.folder }), el("p", {}, t("noProjects"))));
  } else {
    const grid = el("div", { class: "grid cols" });
    projects.forEach(p => grid.append(projectCard(p)));
    wrap.append(grid);
  }
  root.append(wrap);
}

function projectCard(p) {
  const dayN = p.workers?.day?.length || 0, nightN = p.workers?.night?.length || 0;
  return el("div", { class: "card proj-card", onclick: () => openProject(p.id) },
    el("div", { class: "num" }, p.number),
    el("div", { class: "meta" },
      p.location ? el("div", {}, t("location") + ": ", el("b", {}, p.location)) : null,
      p.supervisor ? el("div", {}, t("supervisor") + ": ", el("b", {}, p.supervisor)) : null,
      el("div", {}, `${dayN} ${t("day").toLowerCase()} · ${nightN} ${t("night").toLowerCase()}`)
    ),
    el("div", { class: "row" },
      el("button", { class: "btn btn-soft btn-sm", onclick: e => { e.stopPropagation(); openProject(p.id); } }, t("openProject")),
      el("button", {
        class: "btn btn-danger btn-sm", onclick: e => {
          e.stopPropagation();
          confirmBox(t("confirmDeleteProject"), async () => { await DB.deleteProject(p.id); render(); });
        }
      }, span(ICON.trash))
    )
  );
}

function newProject() {
  formModal(t("newProject"), [
    { name: "number", label: t("projectNumber"), placeholder: t("projectNumberPh") },
    { name: "location", label: t("location"), placeholder: t("locationPh") },
    { name: "supervisor", label: t("supervisor") },
    { name: "approvedBy", label: t("approvedBy") }
  ], async (v) => {
    if (!v.number) { toast(t("needNumber"), "err"); return false; }
    const p = {
      id: DB.uid(), number: v.number, location: v.location, supervisor: v.supervisor,
      approvedBy: v.approvedBy, createdAt: Date.now(),
      workers: { day: [], night: [] }, drafts: {}, history: []
    };
    await DB.saveProject(p);
    openProject(p.id);
  });
}

async function openProject(id) {
  state.project = await DB.getProject(id);
  state.projectId = id; state.route = "project"; state.tab = "workers";
  state.captureShift = getRole() || "day";
  state.toolArea = null;
  render();
}

/* ---------- PROJECT shell ---------- */
function renderProject() {
  const p = state.project;
  const head = el("div", { class: "page-head" },
    el("button", { class: "btn btn-ghost btn-icon", onclick: () => { state.route = "projects"; render(); } }, span(ICON.back)),
    el("div", { class: "titles" }, el("h2", {}, p.number),
      el("p", {}, [p.location, p.supervisor].filter(Boolean).join(" · "))),
  );
  const tabs = el("div", { class: "tabs" },
    tabBtn("workers", t("tabWorkers")),
    tabBtn("capture", t("tabCapture")),
    tabBtn("history", t("tabHistory"))
  );
  const wrap = el("div", { class: "wrap" }, head, tabs);
  const body = el("div", {});
  wrap.append(body);
  root.append(wrap);
  if (state.tab === "workers") renderWorkers(body);
  else if (state.tab === "capture") renderCapture(body);
  else renderHistory(body);
}
function tabBtn(id, label) {
  return el("button", { class: state.tab === id ? "active" : "", onclick: () => { state.tab = id; render(); } }, label);
}

/* ---------- WORKERS ---------- */
function renderWorkers(body) {
  const p = state.project;
  body.append(el("p", { class: "hint", style: "margin-bottom:16px" }, t("workersHint")));
  body.append(el("div", { class: "shift-cols" },
    workerColumn("day"), workerColumn("night")
  ));
}
function workerColumn(shift) {
  const p = state.project;
  const list = p.workers[shift];
  const head = el("div", { class: "shift-head " + shift },
    el("span", { class: "dot" }), el("h3", {}, t(shift === "day" ? "dayShift" : "nightShift")),
    el("span", { class: "count" }, list.length)
  );
  const items = list.length
    ? list.map(w => el("div", { class: "worker-row" },
        el("div", { class: "av" }, initials(w.name)),
        el("div", { class: "info" }, el("b", {}, w.name), w.trade ? el("span", {}, w.trade) : null),
        el("button", {
          class: "del", onclick: () => confirmBox(`${t("delete")}: ${w.name}?`, async () => {
            p.workers[shift] = list.filter(x => x.id !== w.id);
            await persistNow(); render();
          })
        }, span(ICON.trash))
      ))
    : [el("div", { class: "empty", style: "padding:24px" }, t("noWorkers"))];
  return el("div", { class: "card" }, head, ...items,
    el("button", {
      class: "btn btn-soft", style: "width:100%;margin-top:8px", onclick: () => {
        if (list.length >= MAX_WORKERS) return toast(t("tooManyWorkers"), "err");
        formModal(t("addWorker"), [
          { name: "name", label: t("workerName") },
          { name: "trade", label: t("trade"), placeholder: t("tradePh") }
        ], async (v) => {
          if (!v.name) { toast(t("needWorkerName"), "err"); return false; }
          list.push({ id: DB.uid(), name: v.name, trade: v.trade });
          await persistNow(); render();
        });
      }
    }, span(ICON.plus), t("addWorker"))
  );
}

/* ---------- CAPTURE ---------- */
function renderCapture(body) {
  const p = state.project;
  const shift = state.captureShift;
  const draft = ensureDraft(p, shift);
  if (!state.toolArea && draft.areas[0]) state.toolArea = draft.areas[0].id;

  // shift + date controls
  const controls = el("div", { class: "card", style: "margin-bottom:18px" },
    el("div", { class: "row-inline" },
      el("div", { class: "field" }, el("label", {}, t("shift")),
        el("div", { class: "lang-toggle" },
          shiftBtn("day", t("day")), shiftBtn("night", t("night")))
      ),
      dateField(draft)
    )
  );
  body.append(controls);

  // weekend banner
  const dow = dowOf(draft.date);
  if (dow === 6) body.append(el("div", { class: "weekend-banner" }, "⚠️ " + t("satBlocked")));
  if (dow === 0) body.append(el("div", { class: "weekend-banner" }, "⚠️ " + t("sunBlocked")));

  // areas
  body.append(el("div", { class: "section-title" }, t("areas")));
  const bar = el("div", { class: "area-bar" });
  draft.areas.forEach(a => bar.append(
    el("div", { class: "area-chip" }, a.name,
      el("button", {
        class: "x", onclick: async () => {
          draft.areas = draft.areas.filter(x => x.id !== a.id);
          delete draft.tools[a.id];
          for (const wid in draft.hours) delete draft.hours[wid]?.[a.id];
          if (state.toolArea === a.id) state.toolArea = draft.areas[0]?.id || null;
          await persistNow(); render();
        }
      }, "✕"))
  ));
  bar.append(el("button", {
    class: "btn btn-ghost btn-sm", onclick: () => {
      if (draft.areas.length >= MAX_AREAS) return toast(t("tooManyAreas"), "err");
      formModal(t("addArea"), [{ name: "name", label: t("areaName") }], async (v) => {
        if (!v.name) { toast(t("needAreaName"), "err"); return false; }
        draft.areas.push({ id: DB.uid(), name: v.name });
        state.toolArea = state.toolArea || draft.areas[draft.areas.length - 1].id;
        await persistNow(); render();
      });
    }
  }, span(ICON.plus), t("addArea")));
  body.append(bar);

  const workers = p.workers[shift];
  if (!draft.areas.length) {
    body.append(el("div", { class: "card empty" }, t("noAreas")));
  } else if (!workers.length) {
    body.append(el("div", { class: "card empty" }, t("noWorkers")));
  } else {
    body.append(el("div", { class: "section-title" }, t("hoursGrid")));
    body.append(hoursTable(draft, workers));
    body.append(el("div", { class: "section-title", style: "margin-top:26px" }, t("tools")));
    body.append(toolsSection(draft));
  }

  // action bar
  body.append(el("div", { class: "actionbar" },
    el("button", { class: "btn btn-ghost", onclick: () => closeDay() }, span(ICON.cal), t("closeDay")),
    el("button", { class: "btn btn-primary", onclick: () => generatePdf(true) }, span(ICON.download), t("fillWO"))
  ));
}
// Campo de fecha: muestra MM/DD/AA, abre el calendario nativo al tocar
function dateField(draft) {
  const hidden = el("input", {
    type: "date", class: "date-hidden", value: draft.date,
    onchange: e => { draft.date = e.target.value || todayISO(); persist(); render(); }
  });
  const display = el("button", {
    type: "button", class: "input date-display",
    onclick: () => { if (hidden.showPicker) { try { hidden.showPicker(); } catch (_) { hidden.focus(); } } else hidden.focus(); }
  }, el("span", {}, fmtUS(draft.date)), el("span", { class: "date-ic", html: ICON.cal }));
  return el("div", { class: "field" }, el("label", {}, t("dateLabel")),
    el("div", { class: "date-wrap" }, display, hidden));
}
function shiftBtn(s, label) {
  return el("button", {
    class: state.captureShift === s ? "active" : "", "data-l": s,
    onclick: () => { state.captureShift = s; state.toolArea = null; render(); }
  }, label);
}

function hoursTable(draft, workers) {
  const table = el("table", { class: "hours" });
  // header rows
  const r1 = el("tr", {}, el("th", { class: "corner", rowspan: "2" }, t("worker")));
  draft.areas.forEach(a => r1.append(el("th", { class: "area-th", colspan: "4" }, a.name)));
  const r2 = el("tr", { class: "sub" });
  draft.areas.forEach(() => COLS.forEach(c =>
    r2.append(el("th", { class: colEnabled(c, draft.date) ? "" : "blk" }, c === "ST" ? "REG" : c))));
  table.append(el("thead", {}, r1, r2));

  const tb = el("tbody", {});
  workers.forEach(w => {
    const tr = el("tr", {}, el("td", { class: "wname" }, w.name));
    draft.areas.forEach((a, ai) => {
      COLS.forEach((c, ci) => {
        const enabled = colEnabled(c, draft.date);
        const td = el("td", { class: "cell" + (ci === 0 ? " grp" : "") + (enabled ? "" : " blocked") });
        const cur = draft.hours[w.id]?.[a.id]?.[c] ?? "";
        const inp = el("input", {
          class: "h", type: "text", inputmode: "decimal", value: cur,
          disabled: !enabled,
          oninput: e => {
            const val = e.target.value.replace(/[^\d.]/g, "");
            e.target.value = val;
            draft.hours[w.id] = draft.hours[w.id] || {};
            draft.hours[w.id][a.id] = draft.hours[w.id][a.id] || {};
            draft.hours[w.id][a.id][c] = val;
            persist();
          }
        });
        td.append(inp); tr.append(td);
      });
    });
    tb.append(tr);
  });
  table.append(tb);
  return el("div", { class: "grid-scroll" }, table);
}

function toolsSection(draft) {
  const card = el("div", { class: "card" });
  // area tabs
  const tabs = el("div", { class: "tool-area-tabs" });
  draft.areas.forEach(a => tabs.append(el("button", {
    class: state.toolArea === a.id ? "active" : "",
    onclick: () => { state.toolArea = a.id; render(); }
  }, a.name)));
  card.append(tabs);

  const aid = state.toolArea;
  const list = (draft.tools[aid] = draft.tools[aid] || []);

  // add row
  const sel = el("select", { class: "input" },
    el("option", { value: "" }, "— " + t("tool") + " —"),
    ...TOOLS.map(tn => el("option", { value: tn }, tn)));
  const qty = el("input", { class: "input", type: "number", min: "1", value: "1", style: "max-width:90px" });
  const addBtn = el("button", {
    class: "btn btn-soft", onclick: async () => {
      if (!sel.value) return toast(t("pickTool"), "err");
      const q = Math.max(1, parseInt(qty.value) || 1);
      const ex = list.find(x => x.tool === sel.value);
      if (ex) ex.qty = q; else list.push({ tool: sel.value, qty: q });
      await persistNow(); render();
    }
  }, span(ICON.plus), t("addTool"));
  card.append(el("div", { class: "row-inline", style: "margin-bottom:14px" },
    el("div", { class: "field", style: "flex:2" }, el("label", {}, t("tool")), sel),
    el("div", { class: "field" }, el("label", {}, t("qty")), qty),
    addBtn));

  // chips
  if (!list.length) card.append(el("div", { class: "muted", style: "padding:6px 2px" }, t("noTools")));
  list.forEach(it => card.append(
    el("span", { class: "tool-chip" }, el("span", { class: "q" }, it.qty + "×"), it.tool,
      el("button", {
        class: "x", onclick: async () => {
          draft.tools[aid] = list.filter(x => x.tool !== it.tool);
          await persistNow(); render();
        }
      }, span(ICON.trash)))
  ));
  return card;
}

/* ---------- generate PDF + history upsert ---------- */
async function buildDayRecord(draft, shift) {
  const p = state.project;
  return {
    id: `${draft.date}_${shift}`,
    date: draft.date, shift, savedAt: Date.now(),
    areas: JSON.parse(JSON.stringify(draft.areas)),
    hours: JSON.parse(JSON.stringify(draft.hours)),
    tools: JSON.parse(JSON.stringify(draft.tools)),
    workersSnapshot: JSON.parse(JSON.stringify(p.workers[shift]))
  };
}
function upsertHistory(rec) {
  const p = state.project;
  p.history = p.history || [];
  const i = p.history.findIndex(h => h.id === rec.id);
  if (i >= 0) { rec.pdfName = rec.pdfName || p.history[i].pdfName; p.history[i] = rec; }
  else p.history.unshift(rec);
}

async function generatePdf(download) {
  const p = state.project, shift = state.captureShift;
  const draft = ensureDraft(p, shift);
  try {
    const { blob, bytes } = await fillWO({ project: p, day: draft, shift, weekdayName: weekdayName(draft.date) });
    const rec = await buildDayRecord(draft, shift);
    rec.pdf = blob; rec.pdfName = fileName(p, draft, shift);
    upsertHistory(rec);
    await persistNow();
    if (download) downloadBlob(blob, rec.pdfName);
    toast(t("pdfSaved"), "ok");
  } catch (e) {
    console.error(e); toast("Error: " + e.message, "err");
  }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function closeDay() {
  const p = state.project, shift = state.captureShift;
  const draft = ensureDraft(p, shift);
  confirmBox(t("confirmCloseDay"), async () => {
    const rec = await buildDayRecord(draft, shift);
    // si no hay PDF aún en el historial, generamos uno
    try {
      const { blob } = await fillWO({ project: p, day: draft, shift, weekdayName: weekdayName(draft.date) });
      rec.pdf = blob; rec.pdfName = fileName(p, draft, shift);
    } catch (e) { console.error(e); }
    upsertHistory(rec);
    // limpiar horas y herramientas, conservar áreas y trabajadores, avanzar fecha
    draft.hours = {}; draft.tools = {};
    draft.date = todayISO();
    await persistNow();
    toast(t("dayClosed"), "ok");
    render();
  });
}

/* ---------- HISTORY ---------- */
function renderHistory(body) {
  const p = state.project;
  const hist = (p.history || []).slice().sort((a, b) => b.savedAt - a.savedAt);
  if (!hist.length) { body.append(el("div", { class: "card empty" }, el("div", { html: ICON.cal }), el("p", {}, t("noHistory")))); return; }
  const card = el("div", { class: "card" });
  card.append(el("div", { class: "section-title" }, t("savedDays")));
  hist.forEach(h => {
    const workers = (h.workersSnapshot || []).length;
    card.append(el("div", { class: "hist-row" },
      el("div", { class: "cal", html: ICON.cal }),
      el("div", { class: "d" },
        el("b", {}, prettyDate(h.date)),
        el("span", {}, `${workers} ${t("worker").toLowerCase()} · ${(h.areas || []).length} ${t("areas").toLowerCase()}`)),
      el("span", { class: "badge " + h.shift }, t(h.shift)),
      h.pdf ? el("button", { class: "btn btn-soft btn-sm", onclick: () => downloadBlob(h.pdf, h.pdfName) }, span(ICON.download), t("downloadPdf"))
            : el("button", { class: "btn btn-soft btn-sm", onclick: () => regen(h) }, span(ICON.refresh), t("regenerate")),
      el("button", { class: "btn btn-ghost btn-sm", onclick: () => viewData(h) }, t("viewData")),
      el("button", {
        class: "btn btn-danger btn-sm", onclick: () => confirmBox(t("confirmDeleteDay"), async () => {
          p.history = p.history.filter(x => x !== h); await persistNow(); render();
        })
      }, span(ICON.trash))
    ));
  });
  body.append(card);
}

async function regen(h) {
  const p = state.project;
  try {
    const { blob } = await fillWO({ project: { ...p, workers: { ...p.workers, [h.shift]: h.workersSnapshot } }, day: h, shift: h.shift, weekdayName: weekdayName(h.date) });
    h.pdf = blob; h.pdfName = h.pdfName || fileName(p, h, h.shift);
    await persistNow();
    downloadBlob(blob, h.pdfName);
    toast(t("pdfSaved"), "ok");
  } catch (e) { console.error(e); toast("Error: " + e.message, "err"); }
}

function viewData(h) {
  const ws = h.workersSnapshot || [];
  const lines = [];
  lines.push(el("p", { class: "muted", style: "margin-bottom:14px" }, prettyDate(h.date) + " · " + t(h.shift)));
  (h.areas || []).forEach(a => {
    const rows = ws.map(w => {
      const cell = h.hours?.[w.id]?.[a.id];
      if (!cell) return null;
      const vals = COLS.map(c => cell[c] ? `${c === "ST" ? "REG" : c} ${cell[c]}` : null).filter(Boolean).join("  ");
      return vals ? el("div", { style: "font-size:13.5px;padding:2px 0" }, el("b", {}, w.name + ": "), vals) : null;
    }).filter(Boolean);
    const tools = (h.tools?.[a.id] || []).map(x => `${x.qty}× ${x.tool}`).join(", ");
    lines.push(el("div", { style: "margin-bottom:14px" },
      el("div", { class: "section-title", style: "margin-bottom:6px" }, a.name),
      ...(rows.length ? rows : [el("div", { class: "muted", style: "font-size:13px" }, "—")]),
      tools ? el("div", { class: "hint", style: "margin-top:6px" }, "🔧 " + tools) : null
    ));
  });
  const ov = el("div", { class: "overlay", onclick: e => { if (e.target === ov) ov.remove(); } },
    el("div", { class: "modal", style: "max-width:520px;max-height:80vh;overflow:auto" },
      el("h3", {}, t("viewData")), ...lines,
      el("div", { class: "row", style: "justify-content:space-between" },
        el("button", { class: "btn btn-soft", onclick: () => { ov.remove(); restoreDay(h); } }, span(ICON.refresh), t("restore")),
        el("button", { class: "btn btn-primary", onclick: () => ov.remove() }, "OK"))
    ));
  document.body.append(ov);
}

// Restaura un día guardado a la hoja de captura para poder modificarlo
function restoreDay(h) {
  confirmBox(t("confirmRestore"), async () => {
    const p = state.project;
    p.drafts = p.drafts || {};
    p.drafts[h.shift] = {
      date: h.date,
      areas: JSON.parse(JSON.stringify(h.areas || [])),
      hours: JSON.parse(JSON.stringify(h.hours || {})),
      tools: JSON.parse(JSON.stringify(h.tools || {}))
    };
    state.captureShift = h.shift;
    state.toolArea = p.drafts[h.shift].areas[0]?.id || null;
    state.tab = "capture";
    await persistNow();
    toast(t("restored"), "ok");
    render();
  }, t("restore"));
}

/* ---------- boot ---------- */
document.querySelectorAll(".lang-toggle button").forEach(b =>
  b.addEventListener("click", () => { setLang(b.dataset.l); render(); }));
render();
if (!getRole()) roleChooser(true); // primera vez: elegir turno
