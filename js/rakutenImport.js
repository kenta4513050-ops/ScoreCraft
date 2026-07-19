"use strict";

const state = {
  mode: "standard",
  enabled: {},
  holes: Array.from({ length: 18 }, (_, index) => ({
    hole: index + 1, par: null, score: null, putts: null,
    greenDistance: null, teeClub: "", direction: "",
    ob: 0, onePenalty: 0, bunker: 0, memo: ""
  }))
};

const MODE_LABELS = {
  simple: "スコアとパットを入力します。",
  standard: "スコア、パット、クラブ、方向、OB、1ペナ、バンカー、メモを入力します。",
  custom: "設定画面のカスタム入力項目を使用します。"
};

function inputsForMode(mode) {
  if (mode === "simple") return { score: true, putt: true, greenDistance: false, teeClub: false, direction: false, ob: false, onePenalty: false, bunker: false, memo: false };
  if (mode === "standard") return { score: true, putt: true, greenDistance: false, teeClub: true, direction: true, ob: true, onePenalty: true, bunker: true, memo: true };
  const config = typeof getConfig === "function" ? getConfig() : null;
  const custom = config?.enabledInputs || {};
  return {
    score: true,
    putt: custom.putt ?? true,
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
  document.getElementById("roundDate").value = new Date().toISOString().slice(0, 10);
  bindEvents();
  renderMode();
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
  document.getElementById("saveImportedRoundButton").addEventListener("click", savePastRound);
  document.getElementById("resetImportButton").addEventListener("click", resetForm);
}

function handleImages(event) {
  const files = Array.from(event.target.files || []).slice(0, 2);
  const container = document.getElementById("imagePreviewList");
  container.innerHTML = "";
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
  return `<input ${common} class="compact-text" type="text" value="${value}">`;
}

function handleFieldInput(event) {
  const hole = state.holes[Number(event.target.dataset.hole) - 1];
  const field = event.target.dataset.field;
  if (["par", "score", "putts", "greenDistance", "bunker", "ob", "onePenalty"].includes(field)) {
    hole[field] = event.target.value === "" ? null : Number(event.target.value);
  } else {
    hole[field] = event.target.value;
  }
  updateSummary();
  updateCourseNotice();
}

function applyQuickEntry() {
  const field = document.getElementById("quickField").value;
  if (field !== "par" && !state.enabled[field]) {
    setMessage("現在の入力モードでは、この項目は使用しません。", true);
    return;
  }
  const raw = document.getElementById("quickValue").value.replace(/[^0-9]/g, "");
  if (raw.length !== 9) {
    setMessage("9ホール分の数字を9桁で入力してください。", true);
    return;
  }
  const start = document.getElementById("quickHalf").value === "front" ? 0 : 9;
  [...raw].forEach((char, index) => { state.holes[start + index][field] = Number(char); });
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
      putts: state.enabled.putt ? hole.putts : null,
      greenDistance: { value: state.enabled.greenDistance ? hole.greenDistance : null, unit: "step" },
      teeShot: { clubId: "", clubName: state.enabled.teeClub ? hole.teeClub : "", direction: state.enabled.direction ? hole.direction : "" },
      ob: state.enabled.ob ? (hole.ob || 0) : 0,
      onePenalty: state.enabled.onePenalty ? (hole.onePenalty || 0) : 0,
      bunker: state.enabled.bunker ? (hole.bunker || 0) : 0,
      memo: state.enabled.memo ? hole.memo : ""
    })),
    out: sumRange("score", 0, 9), in: sumRange("score", 9, 18), total,
    outPar: sumRange("par", 0, 9), inPar: sumRange("par", 9, 18), totalPar: sum("par"),
    teeName: document.getElementById("teeName").value.trim(),
    greenName: document.getElementById("greenName").value.trim(),
    importSource: "past-round-manual-v1.3.0", createdAt: now, updatedAt: now
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
