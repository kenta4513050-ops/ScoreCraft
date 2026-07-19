"use strict";

const importState = { rows: [], filename: "" };

const HEADER_ALIASES = {
  date: ["ラウンド日","日付","プレー日","プレイ日","date","rounddate","playdate"],
  courseName: ["ゴルフ場","ゴルフ場名","コース名","course","coursename","golfcourse"],
  layoutName: ["コース","使用コース","レイアウト","layout","courselayout"],
  total: ["合計スコア","トータル","total","totalscore","score"],
  out: ["outスコア","out","前半","前半スコア"],
  in: ["inスコア","in","後半","後半スコア"],
  totalPar: ["合計par","totalpar","par合計","par"],
  outPar: ["outpar","out par","前半par"],
  inPar: ["inpar","in par","後半par"],
  totalPutts: ["合計パット","パット数","totalputts","putts"],
  memo: ["メモ","備考","memo","note"]
};

document.addEventListener("DOMContentLoaded", initializeCsvImport);

function initializeCsvImport() {
  if (typeof renderNavigation === "function") renderNavigation("settings");
  byId("selectCsvButton").addEventListener("click", () => byId("csvFileInput").click());
  byId("csvFileInput").addEventListener("change", handleCsvSelection);
  byId("downloadTemplateButton").addEventListener("click", downloadTemplateCsv);
  byId("selectAllButton").addEventListener("click", () => setAllSelections(true));
  byId("clearAllButton").addEventListener("click", () => setAllSelections(false));
  byId("executeImportButton").addEventListener("click", executeImport);
}

async function handleCsvSelection(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  importState.filename = file.name;
  try {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvBuffer(buffer);
    const table = parseCsv(text);
    if (table.length < 2) throw new Error("データ行がありません。");
    const headers = table[0].map(normalizeHeader);
    const parsed = table.slice(1)
      .filter(row => row.some(value => String(value || "").trim() !== ""))
      .map((row, index) => createImportCandidate(headers, row, index + 2));
    importState.rows = parsed;
    renderImportResult();
  } catch (error) {
    console.error(error);
    showImportMessage(`CSVを読み込めませんでした。${error.message || "ファイル形式を確認してください。"}`, true);
  } finally {
    event.target.value = "";
  }
}

function decodeCsvBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const replacementCount = (text.match(/�/g) || []).length;
  if (replacementCount > 2) {
    try { text = new TextDecoder("shift_jis", { fatal: false }).decode(bytes); } catch (_) {}
  }
  return text.replace(/^\uFEFF/, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ""; }
    else if (char === '\n') { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value !== "" || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function createImportCandidate(headers, row, lineNumber) {
  const record = {};
  headers.forEach((header, index) => { record[header] = String(row[index] ?? "").trim(); });
  const date = normalizeDate(findValue(record, HEADER_ALIASES.date));
  const courseName = findValue(record, HEADER_ALIASES.courseName);
  const layoutName = findValue(record, HEADER_ALIASES.layoutName);
  const holes = Array.from({ length: 18 }, (_, index) => createImportedHole(record, index + 1));
  const holeScores = holes.map(h => h.score).filter(Number.isFinite);
  const calculatedOut = sumFinite(holes.slice(0, 9).map(h => h.score));
  const calculatedIn = sumFinite(holes.slice(9, 18).map(h => h.score));
  const out = positiveNumber(findValue(record, HEADER_ALIASES.out)) || calculatedOut;
  const inScore = positiveNumber(findValue(record, HEADER_ALIASES.in)) || calculatedIn;
  const total = positiveNumber(findValue(record, HEADER_ALIASES.total)) || (out + inScore) || sumFinite(holeScores);
  const outPar = positiveNumber(findValue(record, HEADER_ALIASES.outPar)) || sumFinite(holes.slice(0, 9).map(h => h.par));
  const inPar = positiveNumber(findValue(record, HEADER_ALIASES.inPar)) || sumFinite(holes.slice(9, 18).map(h => h.par));
  const totalPar = positiveNumber(findValue(record, HEADER_ALIASES.totalPar)) || (outPar + inPar) || sumFinite(holes.map(h => h.par));
  const errors = [];
  if (!date) errors.push("日付を判定できません");
  if (!courseName) errors.push("ゴルフ場名がありません");
  if (!total) errors.push("合計スコアを判定できません");
  const round = {
    version: 1,
    id: createImportId(),
    status: "completed",
    courseId: "",
    courseName: courseName || "ゴルフ場名未設定",
    coursePrefecture: "",
    courseLayoutName: layoutName || "",
    date: date || "",
    inputMode: holeScores.length ? "standard" : "simple",
    distanceUnit: "step",
    enabledInputs: { score: true, putt: true, greenDistance: false, teeClub: false, direction: false, ob: false, onePenalty: false, bunker: false, memo: true },
    currentHole: 1,
    holes,
    out: out || 0,
    in: inScore || 0,
    total: total || 0,
    outPar: outPar || null,
    inPar: inPar || null,
    totalPar: totalPar || null,
    importedFrom: importState.filename,
    importLine: lineNumber,
    memo: findValue(record, HEADER_ALIASES.memo),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: date ? `${date}T12:00:00.000Z` : new Date().toISOString()
  };
  return { selected: errors.length === 0, lineNumber, round, errors, duplicate: isDuplicateRound(round) };
}

function createImportedHole(record, holeNumber) {
  const score = findNumberByPatterns(record, [
    `${holeNumber}番スコア`, `hole${holeNumber}score`, `score${holeNumber}`, `h${holeNumber}`, `${holeNumber}番`, `${holeNumber}`
  ]);
  const par = findNumberByPatterns(record, [
    `${holeNumber}番par`, `hole${holeNumber}par`, `par${holeNumber}`, `p${holeNumber}`
  ]);
  const putts = findNumberByPatterns(record, [
    `${holeNumber}番パット`, `hole${holeNumber}putts`, `putt${holeNumber}`, `putts${holeNumber}`
  ]);
  return {
    hole: holeNumber,
    par: par || null,
    score: score || null,
    putts: putts || null,
    greenDistance: { value: null, unit: "step" },
    teeShot: { clubId: "", direction: "" },
    ob: 0,
    onePenalty: 0,
    bunker: 0,
    memo: ""
  };
}

function renderImportResult() {
  byId("importStatusCard").hidden = false;
  byId("importPreviewCard").hidden = false;
  const valid = importState.rows.filter(item => item.errors.length === 0).length;
  const duplicates = importState.rows.filter(item => item.duplicate).length;
  byId("importSummary").innerHTML = `<strong>${escapeHtml(importState.filename)}</strong><span>${importState.rows.length}行を読込 / 登録可能 ${valid}件 / 重複候補 ${duplicates}件</span>`;
  const warningTexts = [];
  if (importState.rows.some(item => item.errors.length)) warningTexts.push("赤い行は必須情報を判定できないため登録できません。");
  if (duplicates) warningTexts.push("重複候補は初期状態で選択を外しています。");
  byId("importWarnings").innerHTML = warningTexts.map(text => `<p>${text}</p>`).join("");
  const list = byId("importPreviewList");
  list.innerHTML = "";
  importState.rows.forEach((candidate, index) => list.appendChild(createPreviewItem(candidate, index)));
  updateImportButton();
}

function createPreviewItem(candidate, index) {
  const label = document.createElement("label");
  label.className = `import-preview-item${candidate.errors.length ? " invalid" : ""}${candidate.duplicate ? " duplicate" : ""}`;
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = candidate.selected && !candidate.duplicate;
  checkbox.disabled = candidate.errors.length > 0;
  checkbox.addEventListener("change", () => { candidate.selected = checkbox.checked; updateImportButton(); });
  candidate.selected = checkbox.checked;
  const content = document.createElement("span");
  content.className = "import-preview-content";
  const badges = [candidate.duplicate ? '<em class="import-badge warning">重複候補</em>' : "", candidate.errors.length ? '<em class="import-badge error">要確認</em>' : ""].join("");
  content.innerHTML = `<span class="import-preview-heading"><strong>${escapeHtml(candidate.round.courseName)}</strong>${badges}</span><span>${escapeHtml(candidate.round.date || `CSV ${candidate.lineNumber}行目`)} / SCORE ${candidate.round.total || "-"} / OUT ${candidate.round.out || "-"} / IN ${candidate.round.in || "-"}</span>${candidate.errors.length ? `<small>${escapeHtml(candidate.errors.join("・"))}</small>` : ""}`;
  label.appendChild(checkbox); label.appendChild(content); return label;
}

function executeImport() {
  const selected = importState.rows.filter(item => item.selected && item.errors.length === 0);
  if (!selected.length) { showImportMessage("登録するラウンドを選択してください。", true); return; }
  const rounds = readStoredRounds();
  selected.forEach(item => rounds.push(item.round));
  try {
    localStorage.setItem("scorecraft_rounds", JSON.stringify(rounds));
    const verified = readStoredRounds();
    if (verified.length < rounds.length) throw new Error("保存確認に失敗しました。");
    showImportMessage(`${selected.length}件のラウンドを登録しました。履歴画面へ移動します。`);
    setTimeout(() => { location.href = "history.html"; }, 1200);
  } catch (error) {
    console.error(error); showImportMessage("登録できませんでした。端末の空き容量やSafariの設定を確認してください。", true);
  }
}

function setAllSelections(selected) {
  importState.rows.forEach(item => { item.selected = selected && item.errors.length === 0; });
  renderImportResult();
}

function updateImportButton() {
  const count = importState.rows.filter(item => item.selected && item.errors.length === 0).length;
  byId("executeImportButton").textContent = count ? `選択した${count}件を登録` : "登録するラウンドを選択";
  byId("executeImportButton").disabled = count === 0;
}

function downloadTemplateCsv() {
  const headers = ["ラウンド日","ゴルフ場名","コース","合計スコア","OUTスコア","INスコア","合計PAR"];
  for (let i = 1; i <= 18; i++) headers.push(`${i}番スコア`);
  for (let i = 1; i <= 18; i++) headers.push(`${i}番PAR`);
  for (let i = 1; i <= 18; i++) headers.push(`${i}番パット`);
  const example = ["2026/07/01","サンプルゴルフ倶楽部","OUT・IN","90","44","46","72"];
  example.push(...[5,4,3,5,4,5,4,5,4,5,5,3,5,5,4,4,4,4]);
  example.push(...[4,4,3,5,4,4,3,5,4,4,4,3,5,4,4,3,5,4]);
  example.push(...Array(18).fill(""));
  const csv = "\uFEFF" + [headers, example].map(row => row.map(csvEscape).join(",")).join("\r\n");
  downloadFile("ScoreCraft_import_template.csv", csv, "text/csv;charset=utf-8");
}

function findValue(record, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== "") return record[key];
  }
  return "";
}
function findNumberByPatterns(record, patterns) {
  for (const pattern of patterns) {
    const key = normalizeHeader(pattern);
    if (record[key] !== undefined && record[key] !== "") return positiveNumber(record[key]);
  }
  return 0;
}
function normalizeHeader(value) { return String(value || "").trim().toLowerCase().replace(/[\s　_\-\/()（）・]/g, ""); }
function normalizeDate(value) {
  const text = String(value || "").trim(); if (!text) return "";
  const normalized = text.replace(/[年月.]/g, "/").replace(/日/g, "").replace(/-/g, "/");
  const match = normalized.match(/(20\d{2}|19\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2,"0")}-${String(match[3]).padStart(2,"0")}`;
}
function positiveNumber(value) { const n = Number(String(value || "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; }
function sumFinite(values) { return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0); }
function readStoredRounds() { try { const value = JSON.parse(localStorage.getItem("scorecraft_rounds") || "[]"); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
function isDuplicateRound(round) { return readStoredRounds().some(item => item && item.date === round.date && normalizeHeader(item.courseName) === normalizeHeader(round.courseName) && Number(item.total) === Number(round.total)); }
function createImportId() { return (window.crypto && typeof window.crypto.randomUUID === "function") ? window.crypto.randomUUID() : `sc-import-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function csvEscape(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function downloadFile(filename, text, type) { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function showImportMessage(message, error = false) { const area = byId("importMessage") || byId("importWarnings"); area.textContent = message; area.classList.toggle("error", error); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char])); }
function byId(id) { return document.getElementById(id); }
