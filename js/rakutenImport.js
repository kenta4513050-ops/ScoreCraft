"use strict";

const state = {
  mode: "standard",
  enabled: {},
  myClubs: [],
  holes: Array.from({ length: 18 }, (_, index) => ({
    hole: index + 1, par: null, score: null, putts: null,
    greenDistance: null, teeClub: "", direction: "",
    ob: 0, onePenalty: 0, bunker: 0, memo: ""
  }))
};


const CLUB_CATALOG = [
  ["driver", "Driver"], ["2w", "2W"], ["3w", "3W"], ["5w", "5W"], ["7w", "7W"], ["9w", "9W"],
  ["2ut", "2UT"], ["3ut", "3UT"], ["4ut", "4UT"], ["5ut", "5UT"], ["6ut", "6UT"],
  ["3i", "3I"], ["4i", "4I"], ["5i", "5I"], ["6i", "6I"], ["7i", "7I"], ["8i", "8I"], ["9i", "9I"], ["pw", "PW"],
  ["46", "46°"], ["48", "48°"], ["50", "50°"], ["52", "52°"], ["54", "54°"], ["56", "56°"], ["58", "58°"], ["60", "60°"],
  ["putter", "Putter"]
].map(([id, name]) => ({ id, name }));

function buildClubCatalog() {
  const catalog = new Map(CLUB_CATALOG.map(club => [String(club.id), club]));
  // clubs.jsを読み込んでいない画面でも動作し、読み込まれている場合は全定義を優先する。
  if (typeof CLUBS !== "undefined" && Array.isArray(CLUBS)) {
    CLUBS.forEach(group => (group.clubs || []).forEach(club => {
      if (club && club.id) catalog.set(String(club.id), { id: String(club.id), name: String(club.name || club.id) });
    }));
  }
  return catalog;
}

function inferClubName(id) {
  const value = String(id || "").trim();
  if (!value) return "未設定";
  if (/^\d{2}$/.test(value)) return `${value}°`;
  return value.toUpperCase().replace("DRIVER", "Driver").replace("PUTTER", "Putter");
}

function loadClubIdMap() {
  const selected = typeof getMyClubs === "function" ? getMyClubs() : [];
  const catalog = buildClubCatalog();
  // 保存形式がID配列でもオブジェクト配列でも、登録された本数を欠かさず表示する。
  state.myClubs = (Array.isArray(selected) ? selected : []).map((entry, index) => {
    const id = String(typeof entry === "object" && entry !== null ? (entry.id ?? entry.clubId ?? entry.value ?? "") : entry).trim();
    const savedName = typeof entry === "object" && entry !== null ? (entry.name ?? entry.clubName ?? entry.label) : "";
    const club = catalog.get(id);
    return {
      number: index + 1,
      id,
      name: String(savedName || club?.name || inferClubName(id))
    };
  });
}

function getClubByNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) ? state.myClubs.find(club => club.number === number) || null : null;
}

function renderClubIdGuide() {
  const guide = document.getElementById("clubIdGuide");
  if (!guide) return;
  if (!state.myClubs.length) {
    guide.innerHTML = `<strong>クラブID表</strong><span>マイクラブが未登録です。<a href="myclubs.html">設定する</a></span>`;
    guide.classList.add("empty");
    return;
  }
  guide.classList.remove("empty");
  guide.innerHTML = `<strong>クラブID表（登録順・${state.myClubs.length}本）</strong><div>${state.myClubs.map(club => `<span><b>${club.number}</b>${escapeHtml(club.name)}</span>`).join("")}</div>`;
}

const MODE_LABELS = {
  simple: "スコアとパットを入力します。",
  standard: "スコア、パット、クラブ、方向、OB、1ペナ、バンカー、メモを入力します。",
  custom: "設定画面のカスタム入力項目を使用します。"
};

function inputsForMode(mode) {
  if (mode === "simple") return { score: true, putts: true, greenDistance: false, teeClub: false, direction: false, ob: false, onePenalty: false, bunker: false, memo: false };
  if (mode === "standard") return { score: true, putts: true, greenDistance: false, teeClub: true, direction: true, ob: true, onePenalty: true, bunker: true, memo: true };
  const config = typeof getConfig === "function" ? getConfig() : null;
  const custom = config?.enabledInputs || {};
  return {
    score: true,
    putts: custom.putt ?? custom.putts ?? true,
    greenDistance: custom.greenDistance ?? false,
    teeClub: custom.teeClub ?? false,
    direction: custom.direction ?? false,
    ob: custom.ob ?? false,
    onePenalty: custom.onePenalty ?? false,
    bunker: custom.bunker ?? false,
    memo: custom.memo ?? false
  };
}

function init() {
  const config = typeof getConfig === "function" ? getConfig() : { inputMode: "standard" };
  state.mode = ["simple", "standard", "custom"].includes(config.inputMode) ? config.inputMode : "standard";
  state.enabled = inputsForMode(state.mode);
  loadClubIdMap();
  document.getElementById("roundDate").value = new Date().toISOString().slice(0, 10);
  bindEvents();
  renderMode();
  renderClubIdGuide();
  renderTable();
  updateSummary();
  updateCourseNotice();
  if (typeof renderNavigation === "function") renderNavigation("settings");
}

function bindEvents() {
  document.getElementById("referenceImages").addEventListener("change", handleImages);
  document.querySelectorAll("#pastModeSelector [data-mode]").forEach(button => button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    state.enabled = inputsForMode(state.mode);
    renderMode();
    renderTable();
  }));
  document.getElementById("applyQuickButton").addEventListener("click", applyQuickEntry);
  document.getElementById("quickField").addEventListener("change", updateQuickEntryGuide);
  updateQuickEntryGuide();
  document.getElementById("saveImportedRoundButton").addEventListener("click", savePastRound);
  document.getElementById("resetImportButton").addEventListener("click", resetForm);
}

function handleImages(event) {
  const files = Array.from(event.target.files || []).slice(0, 2);
  const container = document.getElementById("imagePreviewList");
  container.innerHTML = "";
  const hasImages = files.length > 0;
  container.classList.toggle("has-images", hasImages);
  document.body.classList.toggle("has-fixed-reference-images", hasImages);
  document.body.classList.remove("reference-preview-enlarged");

  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const figure = document.createElement("figure");
    figure.className = "import-image-preview reference-preview";
    figure.dataset.imageIndex = String(index);
    figure.innerHTML = `<img src="${url}" alt="参考画像${index + 1}"><span>画像 ${index + 1}</span>`;
    figure.querySelector("img").addEventListener("click", () => toggleDockedReferenceImage(index));
    container.appendChild(figure);
  });

  if (hasImages) {
    ensureReferenceControls();
    bindVisualViewportSupport();
    updateReferenceViewportMetrics();
  } else {
    removeReferenceControls();
    updateReferenceViewportMetrics();
  }
}

let enlargedReferenceIndex = null;
let visualViewportBound = false;

function ensureReferenceControls() {
  const container = document.getElementById("imagePreviewList");
  if (!container || document.getElementById("referencePreviewControls")) return;
  const controls = document.createElement("div");
  controls.id = "referencePreviewControls";
  controls.className = "reference-preview-controls";
  controls.innerHTML = `
    <span>画像をタップで拡大</span>
    <button id="referencePreviewShrink" type="button" aria-label="画像を縮小">縮小</button>`;
  controls.querySelector("button").addEventListener("click", event => {
    event.stopPropagation();
    shrinkDockedReferenceImage();
  });
  container.appendChild(controls);
}

function removeReferenceControls() {
  document.getElementById("referencePreviewControls")?.remove();
}

function toggleDockedReferenceImage(index) {
  if (document.body.classList.contains("reference-preview-enlarged") && enlargedReferenceIndex === index) {
    shrinkDockedReferenceImage();
    return;
  }
  enlargedReferenceIndex = index;
  document.body.classList.add("reference-preview-enlarged");
  document.querySelectorAll("#imagePreviewList .reference-preview").forEach((figure, figureIndex) => {
    figure.classList.toggle("active-reference", figureIndex === index);
  });
  updateReferenceViewportMetrics();
}

function shrinkDockedReferenceImage() {
  enlargedReferenceIndex = null;
  document.body.classList.remove("reference-preview-enlarged");
  document.querySelectorAll("#imagePreviewList .reference-preview").forEach(figure => {
    figure.classList.remove("active-reference");
  });
  updateReferenceViewportMetrics();
}

function bindVisualViewportSupport() {
  if (visualViewportBound || !window.visualViewport) return;
  const update = () => updateReferenceViewportMetrics();
  window.visualViewport.addEventListener("resize", update);
  window.visualViewport.addEventListener("scroll", update);
  window.addEventListener("orientationchange", update);
  visualViewportBound = true;
}

function updateReferenceViewportMetrics() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const top = viewport ? Math.max(0, viewport.offsetTop) : 0;
  const height = viewport ? viewport.height : window.innerHeight;
  const enlarged = document.body.classList.contains("reference-preview-enlarged");
  const panelHeight = enlarged
    ? Math.max(170, Math.min(330, Math.round(height * 0.38)))
    : 120;
  root.style.setProperty("--reference-vv-top", `${top}px`);
  root.style.setProperty("--reference-panel-height", `${panelHeight}px`);
  root.style.setProperty("--reference-content-offset", `${panelHeight + 20}px`);
}

function keepFocusedFieldVisible(event) {
  if (!document.body.classList.contains("has-fixed-reference-images")) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
  window.setTimeout(() => {
    const panelHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--reference-panel-height")) || 120;
    const rect = target.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const minY = panelHeight + 18;
    const maxY = viewportHeight - 90;
    if (rect.top < minY || rect.bottom > maxY) {
      const desiredTop = window.scrollY + rect.top - minY - 12;
      window.scrollTo({ top: Math.max(0, desiredTop), behavior: "smooth" });
    }
  }, 180);
}

document.addEventListener("focusin", keepFocusedFieldVisible);

function renderMode() {
  document.querySelectorAll("#pastModeSelector [data-mode]").forEach(button => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.getElementById("modeDescription").textContent = MODE_LABELS[state.mode];
}

const columns = [
  ["par", "PAR"], ["score", "スコア"], ["putts", "パット"],
  ["greenDistance", "残距離"], ["teeClub", "クラブ"], ["direction", "方向"],
  ["bunker", "バンカー"], ["ob", "OB"], ["onePenalty", "1ペナ"], ["memo", "メモ"]
];

function visibleColumns() {
  return columns.filter(([key]) => key === "par" || state.enabled[key]);
}

function renderTable() {
  const visible = visibleColumns();
  document.getElementById("holeTableHead").innerHTML = `<tr><th>H</th>${visible.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
  document.getElementById("holeTableBody").innerHTML = state.holes.map(hole => `<tr><th>${hole.hole}</th>${visible.map(([key]) => `<td>${fieldHtml(hole, key)}</td>`).join("")}</tr>`).join("");
  document.querySelectorAll("[data-hole][data-field]").forEach(input => {
    input.addEventListener("input", handleFieldInput);
    input.addEventListener("change", handleFieldInput);
  });
}

function fieldHtml(hole, key) {
  const common = `data-hole="${hole.hole}" data-field="${key}"`;
  if (["par", "score", "putts", "greenDistance", "bunker", "ob", "onePenalty"].includes(key)) {
    const value = hole[key] ?? "";
    return `<input ${common} type="number" inputmode="numeric" min="0" max="99" value="${value}">`;
  }
  if (key === "direction") {
    const options = [["", "－"], ["keep", "キープ/1on"], ["left", "左"], ["right", "右"], ["short", "手前"], ["over", "オーバー"]];
    return `<select ${common}>${options.map(([value, label]) => `<option value="${value}" ${hole.direction === value ? "selected" : ""}>${label}</option>`).join("")}</select>`;
  }
  const value = escapeHtml(hole[key] || "");
  if (key === "teeClub") {
    const club = getClubByNumber(value);
    const clubName = value ? (club?.name || "未登録ID") : "－";
    return `<div class="club-entry-cell"><input ${common} class="compact-text club-number-input${value && !club ? " invalid" : ""}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="ID" value="${value}"><small class="club-name-preview">${escapeHtml(clubName)}</small></div>`;
  }
  return `<input ${common} class="compact-text" type="text" value="${value}">`;
}

function handleFieldInput(event) {
  const hole = state.holes[Number(event.target.dataset.hole) - 1];
  const field = event.target.dataset.field;
  if (["par", "score", "putts", "greenDistance", "bunker", "ob", "onePenalty"].includes(field)) {
    hole[field] = event.target.value === "" ? null : Number(event.target.value);
  } else if (field === "teeClub") {
    const raw = event.target.value.trim();
    hole[field] = raw;
    const club = raw ? getClubByNumber(raw) : null;
    event.target.classList.toggle("invalid", Boolean(raw && !club));
    const preview = event.target.parentElement?.querySelector(".club-name-preview");
    if (preview) preview.textContent = raw ? (club?.name || "未登録ID") : "－";
  } else {
    hole[field] = event.target.value;
  }
  updateSummary();
  updateCourseNotice();
}

function updateQuickEntryGuide() {
  const field = document.getElementById("quickField").value;
  const input = document.getElementById("quickValue");
  const guide = document.getElementById("quickEntryGuide");
  if (field === "teeClub") {
    input.inputMode = "numeric";
    input.placeholder = "例：1,9,1,4,1,8,1,1,1";
    guide.textContent = "マイクラブのIDをカンマまたは空白で9個入力します。下のクラブID表を確認してください。";
  } else {
    input.inputMode = "numeric";
    input.placeholder = "例：434543445";
    guide.textContent = "数字を区切らず9桁で入力できます。";
  }
}

function parseSeparatedValues(input) {
  return input.split(/[、,\s/]+/).map(value => value.trim()).filter(Boolean);
}

function validateQuickNumeric(field, input) {
  const labels = { par: "PAR", score: "スコア", putts: "パット", ob: "OB", onePenalty: "1ペナ", bunker: "バンカー" };
  const ranges = { par: [3, 6], score: [1, 19], putts: [0, 9], ob: [0, 9], onePenalty: [0, 9], bunker: [0, 9] };
  if (!input) return { error: `${labels[field]}を入力してください。` };
  if (!/^[0-9、,\s/]+$/.test(input)) return { error: `${labels[field]}には数字と区切り記号だけを入力してください。` };

  const hasSeparator = /[、,\s/]/.test(input);
  const values = hasSeparator ? parseSeparatedValues(input) : [...input];
  if (values.length > 9) return { error: `${labels[field]}が${values.length}個あります。前半または後半の9個以内で入力してください。` };
  if (values.length < 9) return { error: `${labels[field]}は9個必要です。現在は${values.length}個です。` };
  if (values.some(value => !/^\d{1,2}$/.test(value))) return { error: `${labels[field]}に正しくない値があります。各値を数字で入力してください。` };

  const numbers = values.map(Number);
  const [min, max] = ranges[field];
  const badIndex = numbers.findIndex(value => value < min || value > max);
  if (badIndex >= 0) return { error: `${badIndex + 1}個目の${labels[field]}「${numbers[badIndex]}」は範囲外です（${min}～${max}）。` };
  return { values: numbers };
}

function applyQuickEntry() {
  const field = document.getElementById("quickField").value;
  if (field !== "par" && !state.enabled[field]) {
    setMessage("現在の入力モードでは、この項目は使用しません。", true);
    return;
  }
  const input = document.getElementById("quickValue").value.trim();
  const start = document.getElementById("quickHalf").value === "front" ? 0 : 9;

  let values;
  if (field === "teeClub") {
    if (!input) return setMessage("クラブIDを入力してください。", true);
    if (!/^[0-9、,\s/]+$/.test(input)) return setMessage("クラブIDには数字と区切り記号だけを入力してください。", true);
    values = parseSeparatedValues(input);
    if (values.length > 9) return setMessage(`クラブIDが${values.length}個あります。前半または後半の9個以内で入力してください。`, true);
    if (values.length < 9) return setMessage(`クラブIDは9個必要です。現在は${values.length}個です。`, true);
    const malformedIndex = values.findIndex(value => !/^\d{1,3}$/.test(value));
    if (malformedIndex >= 0) return setMessage(`${malformedIndex + 1}個目のクラブID「${values[malformedIndex]}」が正しくありません。`, true);
    const invalidIndex = values.findIndex(value => !getClubByNumber(value));
    if (invalidIndex >= 0) return setMessage(`${invalidIndex + 1}個目のクラブID「${values[invalidIndex]}」はマイクラブにありません。ID表を確認してください。`, true);
  } else {
    const result = validateQuickNumeric(field, input);
    if (result.error) return setMessage(result.error, true);
    values = result.values;
  }

  values.forEach((value, index) => { state.holes[start + index][field] = value; });
  document.getElementById("quickValue").value = "";
  renderTable();
  updateSummary();
  updateCourseNotice();
  setMessage("9ホール分を反映しました。", false);
}

function updateSummary() {
  const sum = key => state.holes.reduce((total, hole) => total + (Number(hole[key]) || 0), 0);
  document.getElementById("previewPar").textContent = sum("par") || "-";
  document.getElementById("previewScore").textContent = sum("score") || "-";
  document.getElementById("previewPutts").textContent = sum("putts") || "-";
  document.getElementById("previewOb").textContent = sum("ob") || "-";
}

function updateCourseNotice() {
  const valid = state.holes.every(hole => Number.isFinite(hole.par) && hole.par >= 3 && hole.par <= 6);
  document.getElementById("courseSaveNotice").textContent = valid
    ? "18ホールのPARが揃っています。未登録コースならラウンド保存時に自動登録できます。"
    : "コース自動登録には、18ホールすべてのPAR（3～6）を入力してください。";
}

function savePastRound() {
  const date = document.getElementById("roundDate").value;
  const courseName = document.getElementById("courseName").value.trim();
  if (!date || !courseName) return setMessage("ラウンド日とゴルフ場名を入力してください。", true);
  if (!state.holes.every(hole => Number.isFinite(hole.score))) {
    if (!confirm("スコアが未入力のホールがあります。このまま保存しますか？")) return;
  }
  if (state.enabled.teeClub) {
    const invalidHole = state.holes.find(hole => hole.teeClub && !getClubByNumber(hole.teeClub));
    if (invalidHole) return setMessage(`${invalidHole.hole}番ホールのクラブID「${invalidHole.teeClub}」はマイクラブにありません。`, true);
  }
  const frontCourse = document.getElementById("frontCourse").value.trim();
  const backCourse = document.getElementById("backCourse").value.trim();
  const layout = [frontCourse, backCourse].filter(Boolean).join(" → ");
  const rounds = load(STORAGE.ROUNDS);
  const total = sum("score");
  const duplicate = rounds.some(round => round && round.status !== "draft" && round.date === date && normalize(round.courseName) === normalize(courseName) && Number(round.total) === total);
  if (duplicate && !confirm("同じ日付・ゴルフ場・合計スコアの履歴があります。重複して保存しますか？")) return;

  const now = new Date().toISOString();
  const round = {
    version: 1, id: safeId("round"), status: "completed", courseId: "", courseName,
    coursePrefecture: "", courseLayoutName: layout, date,
    inputMode: state.mode, distanceUnit: "step", enabledInputs: { ...state.enabled }, currentHole: 18,
    holes: state.holes.map(hole => ({
      hole: hole.hole, par: hole.par, score: hole.score,
      putts: state.enabled.putts ? hole.putts : null,
      greenDistance: { value: state.enabled.greenDistance ? hole.greenDistance : null, unit: "step" },
      teeShot: (() => {
        const club = state.enabled.teeClub ? getClubByNumber(hole.teeClub) : null;
        return { clubId: club?.id || "", clubName: club?.name || "", direction: state.enabled.direction ? hole.direction : "" };
      })(),
      ob: state.enabled.ob ? (hole.ob || 0) : 0,
      onePenalty: state.enabled.onePenalty ? (hole.onePenalty || 0) : 0,
      bunker: state.enabled.bunker ? (hole.bunker || 0) : 0,
      memo: state.enabled.memo ? hole.memo : ""
    })),
    out: sumRange("score", 0, 9), in: sumRange("score", 9, 18), total,
    outPar: sumRange("par", 0, 9), inPar: sumRange("par", 9, 18), totalPar: sum("par"),
    teeName: document.getElementById("teeName").value.trim(),
    greenName: document.getElementById("greenName").value.trim(),
    importSource: "past-round-manual-v1.3.3", createdAt: now, updatedAt: now
  };

  if (document.getElementById("saveCourseCheck").checked && typeof ensureCourseFromRound === "function") {
    const course = ensureCourseFromRound(round, { source: "past-round-manual" });
    if (course) round.courseId = course.id;
  }
  rounds.push(round);
  save(STORAGE.ROUNDS, rounds);
  localStorage.removeItem("scorecraft_draft_round");
  setMessage("過去ラウンドを保存しました。", false);
  setTimeout(() => { location.href = `history.html?id=${encodeURIComponent(round.id)}`; }, 500);
}

function sum(key) { return state.holes.reduce((total, hole) => total + (Number(hole[key]) || 0), 0); }
function sumRange(key, start, end) { return state.holes.slice(start, end).reduce((total, hole) => total + (Number(hole[key]) || 0), 0); }
function normalize(value) { return String(value || "").trim().replace(/\s+/g, "").toLowerCase(); }
function safeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function setMessage(message, error) { const element = document.getElementById("importMessage"); element.textContent = message; element.classList.toggle("error", Boolean(error)); }
function resetForm() { if (confirm("入力内容をリセットしますか？")) location.reload(); }

document.addEventListener("DOMContentLoaded", init);

/* Ver1.3.8: 高機能固定参考画像ビューア */
const referenceViewerState = {
  activeIndex: 0,
  transforms: [],
  pointers: new Map(),
  gestureStart: null,
  longPressTimer: null,
  longPressActive: false,
  lastTapAt: 0,
  lastTapIndex: -1,
  suppressClickUntil: 0
};

function defaultReferenceTransform() {
  return { scale: 1, x: 0, y: 0 };
}

function getReferenceFigures() {
  return Array.from(document.querySelectorAll("#imagePreviewList .reference-preview"));
}

function getReferenceTransform(index) {
  if (!referenceViewerState.transforms[index]) referenceViewerState.transforms[index] = defaultReferenceTransform();
  return referenceViewerState.transforms[index];
}

function clampReferenceTransform(index) {
  const figure = getReferenceFigures()[index];
  const image = figure?.querySelector("img");
  if (!figure || !image) return;
  const t = getReferenceTransform(index);
  t.scale = Math.min(6, Math.max(1, t.scale));
  if (t.scale <= 1.001) {
    t.scale = 1; t.x = 0; t.y = 0;
    return;
  }
  const rect = figure.getBoundingClientRect();
  const maxX = Math.max(0, rect.width * (t.scale - 1) / 2);
  const maxY = Math.max(0, rect.height * (t.scale - 1) / 2);
  t.x = Math.min(maxX, Math.max(-maxX, t.x));
  t.y = Math.min(maxY, Math.max(-maxY, t.y));
}

function applyReferenceTransform(index) {
  clampReferenceTransform(index);
  const figure = getReferenceFigures()[index];
  const image = figure?.querySelector("img");
  if (!image) return;
  const t = getReferenceTransform(index);
  image.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`;
  figure.classList.toggle("is-zoomed", t.scale > 1.001);
  const zoomLabel = document.getElementById("referenceZoomLabel");
  if (zoomLabel && index === referenceViewerState.activeIndex) zoomLabel.textContent = `${Math.round(t.scale * 100)}%`;
}

function selectReferenceImage(index, enlarge = true) {
  const figures = getReferenceFigures();
  if (!figures[index]) return;
  referenceViewerState.activeIndex = index;
  enlargedReferenceIndex = index;
  document.body.classList.toggle("reference-preview-enlarged", enlarge);
  figures.forEach((figure, i) => figure.classList.toggle("active-reference", i === index));
  applyReferenceTransform(index);
  updateReferenceViewportMetrics();
}

function resetReferenceViewerState(count) {
  referenceViewerState.activeIndex = 0;
  referenceViewerState.transforms = Array.from({ length: count }, defaultReferenceTransform);
  referenceViewerState.pointers.clear();
  referenceViewerState.gestureStart = null;
  clearTimeout(referenceViewerState.longPressTimer);
  referenceViewerState.longPressActive = false;
  document.body.classList.remove("reference-longpress-fullscreen");
}

function distanceBetweenPointers(points) {
  return Math.hypot(points[1].clientX - points[0].clientX, points[1].clientY - points[0].clientY);
}

function midpointBetweenPointers(points) {
  return { x: (points[0].clientX + points[1].clientX) / 2, y: (points[0].clientY + points[1].clientY) / 2 };
}

function cancelReferenceLongPress() {
  clearTimeout(referenceViewerState.longPressTimer);
  referenceViewerState.longPressTimer = null;
}

function beginReferenceLongPress(index) {
  cancelReferenceLongPress();
  referenceViewerState.longPressTimer = window.setTimeout(() => {
    if (referenceViewerState.pointers.size !== 1) return;
    referenceViewerState.longPressActive = true;
    referenceViewerState.suppressClickUntil = Date.now() + 500;
    selectReferenceImage(index, true);
    document.body.classList.add("reference-longpress-fullscreen");
  }, 520);
}

function endReferenceLongPress() {
  cancelReferenceLongPress();
  if (!referenceViewerState.longPressActive) return;
  referenceViewerState.longPressActive = false;
  document.body.classList.remove("reference-longpress-fullscreen");
  updateReferenceViewportMetrics();
}

function onReferencePointerDown(event, index) {
  event.preventDefault();
  const figure = event.currentTarget;
  figure.setPointerCapture?.(event.pointerId);
  referenceViewerState.pointers.set(event.pointerId, event);
  selectReferenceImage(index, document.body.classList.contains("reference-preview-enlarged"));
  const t = getReferenceTransform(index);
  referenceViewerState.gestureStart = {
    index,
    x: event.clientX,
    y: event.clientY,
    transform: { ...t },
    moved: false
  };
  if (referenceViewerState.pointers.size === 1) beginReferenceLongPress(index);
  if (referenceViewerState.pointers.size === 2) {
    cancelReferenceLongPress();
    const points = Array.from(referenceViewerState.pointers.values());
    referenceViewerState.gestureStart.distance = distanceBetweenPointers(points);
    referenceViewerState.gestureStart.midpoint = midpointBetweenPointers(points);
  }
}

function onReferencePointerMove(event, index) {
  if (!referenceViewerState.pointers.has(event.pointerId)) return;
  event.preventDefault();
  referenceViewerState.pointers.set(event.pointerId, event);
  const start = referenceViewerState.gestureStart;
  if (!start || start.index !== index) return;
  const t = getReferenceTransform(index);
  const points = Array.from(referenceViewerState.pointers.values());
  if (points.length >= 2) {
    cancelReferenceLongPress();
    const dist = distanceBetweenPointers(points);
    const midpoint = midpointBetweenPointers(points);
    t.scale = start.transform.scale * (dist / Math.max(1, start.distance));
    t.x = start.transform.x + (midpoint.x - start.midpoint.x);
    t.y = start.transform.y + (midpoint.y - start.midpoint.y);
    start.moved = true;
  } else if (points.length === 1) {
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 7) { start.moved = true; cancelReferenceLongPress(); }
    if (start.transform.scale > 1.001) {
      t.x = start.transform.x + dx;
      t.y = start.transform.y + dy;
    }
  }
  applyReferenceTransform(index);
}

function onReferencePointerEnd(event, index) {
  if (!referenceViewerState.pointers.has(event.pointerId)) return;
  event.preventDefault();
  const start = referenceViewerState.gestureStart;
  referenceViewerState.pointers.delete(event.pointerId);
  endReferenceLongPress();
  applyReferenceTransform(index);
  if (referenceViewerState.pointers.size) {
    const remaining = Array.from(referenceViewerState.pointers.values())[0];
    const t = getReferenceTransform(index);
    referenceViewerState.gestureStart = { index, x: remaining.clientX, y: remaining.clientY, transform: { ...t }, moved: true };
    return;
  }
  if (start && !start.moved && Date.now() >= referenceViewerState.suppressClickUntil) {
    const now = Date.now();
    if (referenceViewerState.lastTapIndex === index && now - referenceViewerState.lastTapAt < 330) {
      const t = getReferenceTransform(index);
      t.scale = t.scale > 1.15 ? 1 : 2;
      t.x = 0; t.y = 0;
      selectReferenceImage(index, true);
      applyReferenceTransform(index);
      referenceViewerState.lastTapAt = 0;
    } else {
      referenceViewerState.lastTapAt = now;
      referenceViewerState.lastTapIndex = index;
      selectReferenceImage(index, true);
    }
  }
  referenceViewerState.gestureStart = null;
}

function installReferenceGestures() {
  const figures = getReferenceFigures();
  resetReferenceViewerState(figures.length);
  figures.forEach((figure, index) => {
    const image = figure.querySelector("img");
    image?.replaceWith(image.cloneNode(true));
    figure.addEventListener("pointerdown", event => onReferencePointerDown(event, index), { passive: false });
    figure.addEventListener("pointermove", event => onReferencePointerMove(event, index), { passive: false });
    figure.addEventListener("pointerup", event => onReferencePointerEnd(event, index), { passive: false });
    figure.addEventListener("pointercancel", event => onReferencePointerEnd(event, index), { passive: false });
    figure.addEventListener("contextmenu", event => event.preventDefault());
  });
  selectReferenceImage(0, false);
}

const originalHandleImagesV138 = handleImages;
handleImages = function(event) {
  originalHandleImagesV138(event);
  if ((event.target.files || []).length) installReferenceGestures();
};

const originalEnsureReferenceControlsV138 = ensureReferenceControls;
ensureReferenceControls = function() {
  originalEnsureReferenceControlsV138();
  const controls = document.getElementById("referencePreviewControls");
  if (!controls || document.getElementById("referenceZoomLabel")) return;
  const label = controls.querySelector("span");
  if (label) label.textContent = "タップで固定・長押しで一時全画面";
  const zoom = document.createElement("b");
  zoom.id = "referenceZoomLabel";
  zoom.textContent = "100%";
  controls.insertBefore(zoom, controls.querySelector("button"));
};

const originalShrinkDockedReferenceImageV138 = shrinkDockedReferenceImage;
shrinkDockedReferenceImage = function() {
  originalShrinkDockedReferenceImageV138();
  document.body.classList.remove("reference-longpress-fullscreen");
};
