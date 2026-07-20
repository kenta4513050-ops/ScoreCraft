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
  container.classList.toggle("has-images", files.length > 0);
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const figure = document.createElement("figure");
    figure.className = "import-image-preview reference-preview";
    figure.innerHTML = `<img src="${url}" alt="参考画像${index + 1}"><span>画像 ${index + 1}</span>`;
    figure.querySelector("img").addEventListener("click", () => figure.classList.toggle("expanded"));
    container.appendChild(figure);
  });
}

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
