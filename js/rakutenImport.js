"use strict";

/* ScoreCraft Ver1.2.4
 * 楽天ゴルフ「スコアカード」専用レイアウト解析
 * 画面内の表罫線と行位置を検出し、1～2枚の画像を統合する。
 */
const importState = {
  files: [],
  worker: null,
  holes: createBlankHoles(),
  meta: {},
  pages: []
};

const ROW_OFFSET = {
  par: [59, 117],
  score: [146, 224],
  putts: [224, 282],
  direction: [282, 339],
  club: [339, 395],
  bunker: [395, 452],
  ob: [452, 509],
  penalty: [509, 566]
};

const FIELD_RULES = {
  par: { whitelist: "0123456789", min: 2, max: 6 },
  score: { whitelist: "0123456789", min: 1, max: 20 },
  putts: { whitelist: "0123456789", min: 0, max: 10 },
  club: { whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz°", text: true },
  bunker: { whitelist: "0123456789", min: 0, max: 9 },
  ob: { whitelist: "0123456789", min: 0, max: 9 },
  penalty: { whitelist: "0123456789", min: 0, max: 9 }
};

document.addEventListener("DOMContentLoaded", () => {
  if (typeof renderNavigation === "function") renderNavigation("settings");
  document.getElementById("rakutenImages")?.addEventListener("change", handleFiles);
  document.getElementById("analyzeButton")?.addEventListener("click", analyzeImages);
  document.getElementById("saveImportedRoundButton")?.addEventListener("click", saveImportedRound);
  document.getElementById("resetImportButton")?.addEventListener("click", resetImport);
});

function createBlankHoles() {
  return Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: null,
    score: null,
    putts: null,
    teeClub: "",
    direction: "",
    bunker: 0,
    ob: 0,
    onePenalty: 0
  }));
}

function safeId(prefix = "import") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function setMessage(text, type = "") {
  const el = document.getElementById("importMessage");
  if (!el) return;
  el.textContent = text;
  el.className = `data-message ${type}`;
}

function handleFiles(event) {
  const files = Array.from(event.target.files || []).slice(0, 2);
  importState.files = files;
  const list = document.getElementById("imagePreviewList");
  list.innerHTML = "";

  files.forEach((file, index) => {
    const card = document.createElement("div");
    card.className = "import-image-preview";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = `選択画像${index + 1}`;
    const span = document.createElement("span");
    span.textContent = `画像 ${index + 1}`;
    card.append(img, span);
    list.appendChild(card);
  });

  document.getElementById("analyzeButton").disabled = files.length === 0;
  setMessage(files.length ? `${files.length}枚選択しました。楽天のスコアカード画面を解析できます。` : "");
}

async function analyzeImages() {
  if (!importState.files.length) return;
  if (typeof Tesseract === "undefined") {
    setMessage("画像解析ライブラリを読み込めません。インターネット接続を確認してください。", "error");
    return;
  }

  toggleBusy(true);
  importState.holes = createBlankHoles();
  importState.meta = {};
  importState.pages = [];

  try {
    updateProgress(2, "楽天スコアカード専用解析を準備しています…");
    importState.worker = await Tesseract.createWorker("jpn+eng", 1, {
      logger: message => {
        if (message.status === "recognizing text") {
          const percent = Math.round((message.progress || 0) * 100);
          updateProgress(5 + Math.round((message.progress || 0) * 82), `文字を読み取っています ${percent}%`);
        }
      }
    });
    await importState.worker.setParameters({ preserve_interword_spaces: "1" });

    for (let index = 0; index < importState.files.length; index += 1) {
      updateProgress(8 + index * 42, `画像${index + 1}の表を検出しています…`);
      const image = await loadImage(importState.files[index]);
      const page = await analyzeRakutenPage(image, index);
      importState.pages.push(page);
      mergePage(page);
    }

    await importState.worker.terminate();
    importState.worker = null;

    inferCourseOrder();
    renderResult();
    updateProgress(100, "解析が完了しました。");
    document.getElementById("resultSection").hidden = false;
    document.getElementById("resultSection").scrollIntoView({ behavior: "smooth", block: "start" });

    const filled = importState.holes.filter(h => Number.isFinite(h.score)).length;
    setMessage(`解析が完了しました。スコアは18ホール中${filled}ホールを検出しました。保存前に内容を確認してください。`, filled >= 15 ? "success" : "warning");
  } catch (error) {
    console.error(error);
    if (importState.worker) {
      try { await importState.worker.terminate(); } catch (_) { /* noop */ }
      importState.worker = null;
    }
    setMessage(`画像を解析できませんでした：${error.message || error}`, "error");
  } finally {
    toggleBusy(false);
  }
}

async function analyzeRakutenPage(img, pageIndex) {
  const geometry = detectRakutenGeometry(img);
  if (!geometry) {
    throw new Error("楽天スコアカードの緑色のホール行を検出できませんでした。画像全体が写っているスクリーンショットを選択してください。");
  }

  const meta = await recognizeHeaderMeta(img, geometry);
  const cells = await detectHoleCells(img, geometry);
  if (!cells.length) {
    throw new Error("ホール番号を検出できませんでした。横向きのスコアカード画像を使用してください。");
  }

  const rows = {};
  for (const [field, rule] of Object.entries(FIELD_RULES)) {
    rows[field] = await recognizeRow(img, geometry, cells, field, rule);
  }

  rows.direction = {};
  for (const cell of cells) {
    const band = getRowBand(geometry, "direction");
    rows.direction[cell.roundHole] = classifyDirection(img, cell.x0, band.y0, cell.x1 - cell.x0, band.y1 - band.y0);
  }

  return { pageIndex, meta, geometry, cells, rows };
}

function detectRakutenGeometry(img) {
  const canvas = imageToCanvas(img);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width: W, height: H } = canvas;
  const data = ctx.getImageData(0, Math.floor(H * 0.14), W, Math.floor(H * 0.28)).data;
  const yOffset = Math.floor(H * 0.14);
  const rowCounts = new Array(Math.floor(H * 0.28)).fill(0);

  for (let y = 0; y < rowCounts.length; y += 1) {
    let count = 0;
    for (let x = Math.floor(W * 0.04); x < Math.floor(W * 0.98); x += 2) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (g > 75 && g > r * 1.28 && g > b * 1.18) count += 1;
    }
    rowCounts[y] = count;
  }

  const threshold = W * 0.12;
  let bestStart = -1, bestEnd = -1, current = -1;
  for (let y = 0; y < rowCounts.length; y += 1) {
    if (rowCounts[y] > threshold) {
      if (current < 0) current = y;
    } else if (current >= 0) {
      if (bestStart < 0 || y - current > bestEnd - bestStart) {
        bestStart = current;
        bestEnd = y - 1;
      }
      current = -1;
    }
  }
  if (current >= 0 && (bestStart < 0 || rowCounts.length - current > bestEnd - bestStart)) {
    bestStart = current;
    bestEnd = rowCounts.length - 1;
  }
  if (bestStart < 0) return null;

  const headerTop = yOffset + bestStart;
  const headerBottom = yOffset + bestEnd + 1;
  const midY = Math.floor((headerTop + headerBottom) / 2);
  const line = ctx.getImageData(0, midY, W, 1).data;
  let xMin = W, xMax = 0;
  for (let x = 0; x < W; x += 1) {
    const i = x * 4;
    const r = line[i], g = line[i + 1], b = line[i + 2];
    if (g > 70 && g > r * 1.25 && g > b * 1.15) {
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
    }
  }
  if (xMax <= xMin) return null;

  const boundaries = detectVerticalBoundaries(ctx, headerTop, headerBottom, xMin, xMax);
  return {
    width: W,
    height: H,
    xMin,
    xMax,
    headerTop,
    headerBottom,
    headerHeight: Math.max(1, headerBottom - headerTop),
    boundaries
  };
}

function detectVerticalBoundaries(ctx, yTop, yBottom, xMin, xMax) {
  // ヘッダー中央1行だけを見ると、白いホール番号を罫線と誤認する。
  // ヘッダーの高さ全体を縦に調べ、ほぼ全域が白い場所だけを罫線とする。
  const candidates = [];
  const height = Math.max(1, yBottom - yTop);
  for (let x = xMin; x <= xMax; x += 1) {
    let whiteCount = 0;
    for (let y = yTop; y < yBottom; y += 2) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      if (p[0] > 205 && p[1] > 205 && p[2] > 205) whiteCount += 1;
    }
    const samples = Math.ceil(height / 2);
    if (whiteCount >= samples * 0.72) candidates.push(x);
  }
  const runs = groupConsecutive(candidates);
  const centers = runs
    .filter(run => run.length <= 12)
    .map(run => Math.round((run[0] + run[run.length - 1]) / 2));
  return uniqueByDistance([xMin, ...centers, xMax + 1].sort((a, b) => a - b), 3);
}

async function recognizeHeaderMeta(img, geometry) {
  const top = Math.max(0, Math.floor(geometry.headerTop - geometry.height * 0.12));
  const height = Math.max(geometry.headerTop - top, Math.floor(geometry.height * 0.08));
  const headerCanvas = cropCanvas(img, geometry.xMin, top, geometry.xMax - geometry.xMin, height, 2);
  await importState.worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    tessedit_char_whitelist: ""
  });
  const result = await importState.worker.recognize(headerCanvas);
  const raw = normalizeOcrText(result.data.text || "");

  const dateMatch = raw.match(/(20\d{2})\s*[\/.年-]\s*(\d{1,2})\s*[\/.月-]\s*(\d{1,2})/);
  const teeMatch = raw.match(/ティー\s*[:：]\s*([^\s]+)/);
  const greenMatch = raw.match(/グリーン\s*[:：]\s*([^\s]+)/);

  let courseName = "";
  if (dateMatch) {
    const afterDate = raw.slice((dateMatch.index || 0) + dateMatch[0].length);
    courseName = afterDate
      .split(/ティー|グリーン/)[0]
      .replace(/スコアカード/g, "")
      .replace(/[|｜]/g, " ")
      .trim();
  }
  courseName = courseName.replace(/\s{2,}/g, " ").trim();

  const courseBandTop = Math.max(0, geometry.headerTop - Math.round(geometry.headerHeight * 0.65));
  const courseBand = cropCanvas(img, geometry.xMin, courseBandTop, geometry.xMax - geometry.xMin, Math.round(geometry.headerHeight * 0.7), 2);
  await importState.worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
  const courseResult = await importState.worker.recognize(courseBand);
  const courseLabels = extractCourseLabels(normalizeOcrText(courseResult.data.text || ""));

  return {
    date: dateMatch ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}` : "",
    courseName,
    teeName: teeMatch?.[1] || "",
    greenName: greenMatch?.[1] || "",
    courseLabels,
    raw
  };
}

async function detectHoleCells(img, geometry) {
  // まず行全体をOCRする。iPhoneでは白文字＋緑背景の数字を
  // 認識しづらい場合があるため、失敗時は各セルを個別に二値化して読む。
  const rowCanvas = cropCanvas(img, geometry.xMin, geometry.headerTop, geometry.xMax - geometry.xMin, geometry.headerHeight, 3);
  const preparedRow = prepareHeaderForOcr(rowCanvas);
  await importState.worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    tessedit_char_whitelist: "0123456789"
  });
  const result = await importState.worker.recognize(preparedRow);
  let words = getWords(result.data)
    .map(word => ({
      text: String(word.text || "").replace(/\D/g, ""),
      x: geometry.xMin + ((word.bbox.x0 + word.bbox.x1) / 2) / 3,
      confidence: word.confidence || 0
    }))
    .filter(word => /^\d{1,2}$/.test(word.text) && +word.text >= 1 && +word.text <= 18);

  const rawCells = [];
  for (let index = 0; index < geometry.boundaries.length - 1; index += 1) {
    const x0 = geometry.boundaries[index];
    const x1 = geometry.boundaries[index + 1];
    const width = x1 - x0;
    // 楽天のホール列は画像幅の約2.5～5.5%。ラベル列・前半/後半・合計列は除外。
    if (width < geometry.width * 0.023 || width > geometry.width * 0.058) continue;
    rawCells.push({ x0, x1, center: (x0 + x1) / 2, width });
  }

  // 罫線だけでホール列を特定する。OCRに依存しないため、iPhoneでも安定する。
  // 検出数が少ない場合は楽天の固定比率から列を復元する。
  if (rawCells.length < 5) {
    rawCells.push(...buildLayoutCellsFromRatios(geometry));
  }

  // 行全体OCRの結果をセルへ割り当てる。
  for (const cell of rawCells) {
    const match = words
      .filter(word => word.x >= cell.x0 - 5 && word.x <= cell.x1 + 5)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (match) cell.label = +match.text;
  }

  // 認識できなかったセルだけ、1セルずつ大きく二値化して再OCRする。
  for (const cell of rawCells.filter(item => !item.label)) {
    const cellCanvas = cropCanvas(
      img,
      cell.x0 + Math.max(1, cell.width * 0.08),
      geometry.headerTop + Math.max(1, geometry.headerHeight * 0.08),
      Math.max(4, cell.width * 0.84),
      Math.max(4, geometry.headerHeight * 0.84),
      5
    );
    const prepared = prepareHeaderForOcr(cellCanvas);
    await importState.worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
      tessedit_char_whitelist: "0123456789"
    });
    const cellResult = await importState.worker.recognize(prepared);
    const value = String(cellResult.data.text || "").replace(/\D/g, "");
    if (/^\d{1,2}$/.test(value) && +value >= 1 && +value <= 18) cell.label = +value;
  }

  let cells = rawCells.filter(cell => cell.label);

  // 罫線検出が弱い画像では、OCRされた数字位置から仮セルを作る。
  if (cells.length < 5 && words.length >= 5) {
    const sorted = words.sort((a, b) => a.x - b.x);
    cells = sorted.map((word, index, array) => {
      const left = index === 0 ? word.x - geometry.width * 0.019 : (array[index - 1].x + word.x) / 2;
      const right = index === array.length - 1 ? word.x + geometry.width * 0.019 : (word.x + array[index + 1].x) / 2;
      return { x0: left, x1: right, center: word.x, label: +word.text, width: right - left };
    });
  }

  cells.sort((a, b) => a.center - b.center);

  // 数字OCRが全滅しても、列の並びから番号を復元する。
  if (cells.length < 5) {
    cells = rawCells.sort((a, b) => a.center - b.center);
  }
  if (!cells.length) return [];
  assignHoleLabelsByLayout(cells, geometry);

  // 横スクロール画像では「10～18→1～9」や「14～18→1～9」のように並ぶ。
  // 数字が小さく戻った位置を境界として、実ホール番号をそのまま採用する。
  let previousLabel = null;
  for (const cell of cells) {
    const label = Number(cell.label);
    cell.roundHole = label;
    if (previousLabel !== null && label === previousLabel) cell.duplicateLabel = true;
    previousLabel = label;
  }

  // 同じ番号が重複認識された場合は信頼できる1つだけ残す。
  const byHole = new Map();
  for (const cell of cells) {
    if (cell.roundHole < 1 || cell.roundHole > 18) continue;
    const current = byHole.get(cell.roundHole);
    if (!current || cell.width > current.width) byHole.set(cell.roundHole, cell);
  }
  return [...byHole.values()].sort((a, b) => a.center - b.center);
}

function buildLayoutCellsFromRatios(geometry) {
  const tableWidth = geometry.xMax - geometry.xMin;
  const labelWidth = tableWidth * 0.135;
  const holeWidth = tableWidth * 0.041;
  const summaryWidth = tableWidth * 0.098;
  const cells = [];
  let x = geometry.xMin + labelWidth;

  // 最大18列。途中に前半・後半・合計の幅広列があるため、
  // 緑色の縦罫線を優先しつつ固定幅で補助する。
  for (let i = 0; i < 18 && x + holeWidth <= geometry.xMax + 2; i += 1) {
    cells.push({ x0: x, x1: x + holeWidth, center: x + holeWidth / 2, width: holeWidth });
    x += holeWidth;
    if (i === 8) x += summaryWidth;
  }
  return cells.filter(cell => cell.center >= geometry.xMin && cell.center <= geometry.xMax);
}

function assignHoleLabelsByLayout(cells, geometry) {
  const sorted = cells.sort((a, b) => a.center - b.center);
  const labelled = sorted.filter(cell => Number.isInteger(cell.label) && cell.label >= 1 && cell.label <= 18);
  if (labelled.length >= Math.min(5, sorted.length)) return;

  // セル間隔が大きく空く位置を前半/後半の区切りとする。
  const widths = sorted.map(cell => cell.width).filter(Number.isFinite);
  const base = widths.length ? widths.sort((a, b) => a - b)[Math.floor(widths.length / 2)] : geometry.width * 0.04;
  let split = -1;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const gap = sorted[i + 1].x0 - sorted[i].x1;
    if (gap > base * 1.25) { split = i + 1; break; }
  }

  const groups = split > 0 ? [sorted.slice(0, split), sorted.slice(split)] : [sorted];
  if (groups.length === 2) {
    const left = groups[0], right = groups[1];
    // 右側が9列なら通常はOUTの1～9。左側はINの末尾、または別コースの1～9。
    right.forEach((cell, i) => { if (!cell.label) cell.label = i + 1; });
    const leftStart = left.length === 9 ? 10 : Math.max(10, 19 - left.length);
    left.forEach((cell, i) => { if (!cell.label) cell.label = leftStart + i; });
  } else {
    // 1グループだけの場合は、見えている列数に応じて1から連番。
    groups[0].forEach((cell, i) => { if (!cell.label) cell.label = i + 1; });
  }
}

function prepareHeaderForOcr(sourceCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    // 白い文字を黒、緑背景を白へ変換してコントラストを最大化。
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const isWhiteText = r > 150 && g > 150 && b > 150;
    const value = isWhiteText ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

async function recognizeRow(img, geometry, cells, field, rule) {
  const band = getRowBand(geometry, field);
  const rowCanvas = cropCanvas(img, geometry.xMin, band.y0, geometry.xMax - geometry.xMin, band.y1 - band.y0, 2);
  await importState.worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    tessedit_char_whitelist: rule.whitelist
  });
  const result = await importState.worker.recognize(rowCanvas);
  const words = getWords(result.data).map(word => ({
    text: String(word.text || "").trim(),
    x: geometry.xMin + ((word.bbox.x0 + word.bbox.x1) / 2) / 2,
    confidence: word.confidence || 0
  })).filter(word => word.text);

  const output = {};
  for (const cell of cells) {
    const candidates = words
      .filter(word => word.x >= cell.x0 - 4 && word.x <= cell.x1 + 4)
      .sort((a, b) => b.confidence - a.confidence);
    if (!candidates.length) continue;
    const combined = candidates.map(item => item.text).join("");
    if (rule.text) {
      const club = cleanClub(combined);
      if (club) output[cell.roundHole] = club;
    } else {
      const match = combined.match(/\d+/);
      if (!match) continue;
      const value = +match[0];
      if (value >= rule.min && value <= rule.max) output[cell.roundHole] = value;
    }
  }
  return output;
}

function getRowBand(geometry, field) {
  const scale = geometry.headerHeight / 59;
  const [start, end] = ROW_OFFSET[field];
  return {
    y0: Math.round(geometry.headerTop + start * scale),
    y1: Math.round(geometry.headerTop + end * scale)
  };
}

function classifyDirection(img, x, y, width, height) {
  const canvas = cropCanvas(img, x + width * 0.12, y + height * 0.12, width * 0.76, height * 0.76, 1);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const W = canvas.width, H = canvas.height;
  const data = ctx.getImageData(0, 0, W, H).data;
  const points = [];
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const i = (py * W + px) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (gray < 95) points.push([px, py]);
    }
  }
  if (points.length < Math.max(6, W * H * 0.01)) return "";

  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const boxW = Math.max(1, maxX - minX + 1), boxH = Math.max(1, maxY - minY + 1);
  const aspect = boxW / boxH;
  const centerCount = points.filter(([px, py]) => px > W * 0.33 && px < W * 0.67 && py > H * 0.33 && py < H * 0.67).length;

  // 二重丸・丸印は、ほぼ正方形かつ中央にも十分な黒画素がある。
  if (aspect > 0.62 && aspect < 1.55 && centerCount > points.length * 0.13) return "center";

  if (aspect >= 1.15) {
    const left = points.filter(([px]) => px < W / 3).length;
    const right = points.filter(([px]) => px > W * 2 / 3).length;
    return left > right * 1.08 ? "left" : "right";
  }

  // 縦長の記号は上下矢印。矢印の先端側は画素が広がるため、
  // 上端・下端の黒画素量を比較して判定する。
  const topBand = points.filter(([, py]) => py < H * 0.38).length;
  const bottomBand = points.filter(([, py]) => py > H * 0.62).length;
  if (topBand > bottomBand * 1.08) return "over";
  if (bottomBand > topBand * 1.08) return "short";

  // 判定差が小さい場合は重心位置も補助判定に使う。
  const centerY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  return centerY < H / 2 ? "over" : "short";
}

function mergePage(page) {
  mergeMeta(page.meta);
  for (const cell of page.cells) {
    const hole = importState.holes[cell.roundHole - 1];
    if (!hole) continue;
    hole.par = chooseValue(page.rows.par[cell.roundHole], hole.par);
    hole.score = chooseValue(page.rows.score[cell.roundHole], hole.score);
    hole.putts = chooseValue(page.rows.putts[cell.roundHole], hole.putts);
    hole.bunker = chooseValue(page.rows.bunker[cell.roundHole], hole.bunker, 0);
    hole.ob = chooseValue(page.rows.ob[cell.roundHole], hole.ob, 0);
    hole.onePenalty = chooseValue(page.rows.penalty[cell.roundHole], hole.onePenalty, 0);
    if (page.rows.club[cell.roundHole]) hole.teeClub = page.rows.club[cell.roundHole];
    if (page.rows.direction[cell.roundHole]) {
      const detected = page.rows.direction[cell.roundHole];
      // 楽天の丸印は、PAR3なら1on、それ以外ならFWキープとして保存する。
      hole.direction = detected === "center"
        ? (Number(hole.par) === 3 ? "green" : "fairway")
        : detected;
    }
  }
}

function mergeMeta(meta) {
  for (const key of ["date", "courseName", "teeName", "greenName"]) {
    if (!importState.meta[key] && meta[key]) importState.meta[key] = meta[key];
  }
  importState.meta.courseLabels = [...new Set([...(importState.meta.courseLabels || []), ...(meta.courseLabels || [])])];
  importState.meta.raw = `${importState.meta.raw || ""} ${meta.raw || ""}`.trim();
}

function chooseValue(incoming, current, emptyValue = null) {
  if (incoming !== undefined && incoming !== null && incoming !== "") return incoming;
  return current === undefined || current === null ? emptyValue : current;
}

function inferCourseOrder() {
  const labels = (importState.meta.courseLabels || []).filter(Boolean);
  importState.meta.frontCourse = labels[0] || "";
  importState.meta.backCourse = labels[1] || "";
}

function renderResult() {
  document.getElementById("roundDate").value = importState.meta.date || "";
  document.getElementById("courseName").value = (importState.meta.courseName || "").replace(/\s+/g, "");
  document.getElementById("frontCourse").value = importState.meta.frontCourse || "";
  document.getElementById("backCourse").value = importState.meta.backCourse || "";
  document.getElementById("teeName").value = importState.meta.teeName || "";
  document.getElementById("greenName").value = importState.meta.greenName || "";

  const body = document.getElementById("holeTableBody");
  body.innerHTML = "";
  importState.holes.forEach(hole => {
    const tr = document.createElement("tr");
    const numberInput = (field, value, min, max) => `<td><input type="number" inputmode="numeric" data-field="${field}" data-hole="${hole.hole}" min="${min}" max="${max}" value="${value ?? ""}"></td>`;
    tr.innerHTML = `
      <th>${hole.hole}</th>
      ${numberInput("par", hole.par, 2, 6)}
      ${numberInput("score", hole.score, 1, 20)}
      ${numberInput("putts", hole.putts, 0, 10)}
      <td><input data-field="teeClub" data-hole="${hole.hole}" value="${escapeHtml(hole.teeClub)}" class="compact-text"></td>
      <td><select data-field="direction" data-hole="${hole.hole}">
        <option value=""></option>
        <option value="left" ${hole.direction === "left" ? "selected" : ""}>左</option>
        <option value="short" ${hole.direction === "short" ? "selected" : ""}>手前</option>
        <option value="fairway" ${hole.direction === "fairway" ? "selected" : ""}>FWキープ</option>
        <option value="green" ${hole.direction === "green" ? "selected" : ""}>1on・グリーンオン</option>
        <option value="over" ${hole.direction === "over" ? "selected" : ""}>オーバー</option>
        <option value="right" ${hole.direction === "right" ? "selected" : ""}>右</option>
      </select></td>
      ${numberInput("bunker", hole.bunker, 0, 9)}
      ${numberInput("ob", hole.ob, 0, 9)}
      ${numberInput("onePenalty", hole.onePenalty, 0, 9)}
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll("input,select").forEach(element => element.addEventListener("change", syncTable));
  updateSummary();
  updateCourseNotice();
}

function syncTable(event) {
  const hole = importState.holes[+event.target.dataset.hole - 1];
  const field = event.target.dataset.field;
  if (!hole || !field) return;
  hole[field] = event.target.type === "number"
    ? (event.target.value === "" ? null : +event.target.value)
    : event.target.value;
  updateSummary();
  updateCourseNotice();
}

function updateSummary() {
  const sum = field => importState.holes.reduce((total, hole) => total + (Number(hole[field]) || 0), 0);
  document.getElementById("previewPar").textContent = sum("par") || "-";
  document.getElementById("previewScore").textContent = sum("score") || "-";
  document.getElementById("previewPutts").textContent = sum("putts") || "-";
  document.getElementById("previewOb").textContent = sum("ob") || "-";
}

function updateCourseNotice() {
  const complete = importState.holes.every(hole => Number.isFinite(hole.par));
  document.getElementById("courseSaveNotice").textContent = complete
    ? "18ホールのPARが揃っています。未登録コースの場合はゴルフ場管理にも保存できます。"
    : "PARが未入力のホールがあります。ラウンド履歴は保存できますが、コース情報の自動登録には18ホールのPARが必要です。";
}

function saveImportedRound() {
  syncMetaFromForm();
  const date = importState.meta.date;
  const courseName = importState.meta.courseName;
  if (!date || !courseName) {
    setMessage("ラウンド日とゴルフ場名を入力してください。", "error");
    return;
  }
  if (!importState.holes.every(hole => Number.isFinite(hole.score))) {
    if (!confirm("スコアが未入力のホールがあります。このまま保存しますか？")) return;
  }

  const rounds = load(STORAGE.ROUNDS);
  const total = sumField("score");
  const duplicate = rounds.some(round => round && round.status !== "draft" && round.date === date && normalize(round.courseName) === normalize(courseName) && Number(round.total) === total);
  if (duplicate && !confirm("同じ日付・ゴルフ場・合計スコアの履歴があります。重複して保存しますか？")) return;

  let courseId = "";
  const layout = [importState.meta.frontCourse, importState.meta.backCourse].filter(Boolean).join(" → ");
  if (document.getElementById("saveCourseCheck").checked && importState.holes.every(hole => Number.isFinite(hole.par))) {
    courseId = findOrCreateCourse(courseName, layout);
  }

  const now = new Date().toISOString();
  const round = {
    version: 1,
    id: safeId("round"),
    status: "completed",
    courseId,
    courseName,
    coursePrefecture: "",
    courseLayoutName: layout,
    date,
    inputMode: "standard",
    distanceUnit: "step",
    enabledInputs: { score: true, putt: true, greenDistance: false, teeClub: true, direction: true, ob: true, onePenalty: true, bunker: true, memo: true },
    currentHole: 18,
    holes: importState.holes.map(hole => ({
      hole: hole.hole,
      par: hole.par,
      score: hole.score,
      putts: hole.putts,
      greenDistance: { value: null, unit: "step" },
      teeShot: { clubId: "", clubName: hole.teeClub, direction: hole.direction },
      ob: hole.ob || 0,
      onePenalty: hole.onePenalty || 0,
      bunker: hole.bunker || 0,
      memo: ""
    })),
    out: importState.holes.slice(0, 9).reduce((totalValue, hole) => totalValue + (+hole.score || 0), 0),
    in: importState.holes.slice(9).reduce((totalValue, hole) => totalValue + (+hole.score || 0), 0),
    total,
    outPar: importState.holes.slice(0, 9).reduce((totalValue, hole) => totalValue + (+hole.par || 0), 0),
    inPar: importState.holes.slice(9).reduce((totalValue, hole) => totalValue + (+hole.par || 0), 0),
    totalPar: sumField("par"),
    teeName: importState.meta.teeName,
    greenName: importState.meta.greenName,
    importSource: "rakuten-screenshot-v1.2.3",
    createdAt: now,
    updatedAt: now
  };

  rounds.push(round);
  save(STORAGE.ROUNDS, rounds);
  localStorage.removeItem("scorecraft_draft_round");
  setMessage("ラウンド履歴を保存しました。", "success");
  setTimeout(() => { location.href = `history.html?id=${encodeURIComponent(round.id)}`; }, 500);
}

function syncMetaFromForm() {
  importState.meta.date = document.getElementById("roundDate").value;
  importState.meta.courseName = document.getElementById("courseName").value.trim();
  importState.meta.frontCourse = document.getElementById("frontCourse").value.trim();
  importState.meta.backCourse = document.getElementById("backCourse").value.trim();
  importState.meta.teeName = document.getElementById("teeName").value.trim();
  importState.meta.greenName = document.getElementById("greenName").value.trim();
}

function findOrCreateCourse(name, layout) {
  const database = getCourseDatabase();
  const existing = database.find(course => normalize(course.name) === normalize(name) && normalize(course.courseName || "") === normalize(layout));
  if (existing) return existing.id;

  const course = {
    id: createCourseId(),
    name,
    prefecture: "",
    courseName: layout || "画像取込",
    holes: importState.holes.map(hole => ({ hole: hole.hole, par: hole.par })),
    isCustom: true,
    createdFrom: "rakuten-screenshot"
  };
  return upsertCustomCourse(course).id;
}

function sumField(field) {
  return importState.holes.reduce((total, hole) => total + (Number(hole[field]) || 0), 0);
}

function normalize(value) {
  return String(value || "").replace(/[\s　]/g, "").toLowerCase();
}

function normalizeOcrText(value) {
  return String(value || "").replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractCourseLabels(text) {
  const labels = [];
  const matches = text.match(/[東西南北中]{1,2}コース|OUT|IN/gi) || [];
  for (const match of matches) {
    const normalized = /^(out|in)$/i.test(match) ? match.toUpperCase() : match;
    if (!labels.includes(normalized)) labels.push(normalized);
  }
  return labels.slice(0, 2);
}

function cleanClub(value) {
  let text = String(value || "").toUpperCase().replace(/[\s|｜]/g, "");
  text = text.replace(/^I([3-9])$/, "$1I").replace(/^W([1-9])$/, "$1W");
  if (/^(1W|[3-9]W|U\d|[3-9]I|PW|AW|SW|LW|\d{2}°)$/.test(text)) return text;
  return "";
}

function getWords(data) {
  if (Array.isArray(data.words) && data.words.length) return data.words;
  const words = [];
  (data.blocks || []).forEach(block => (block.paragraphs || []).forEach(paragraph => (paragraph.lines || []).forEach(line => (line.words || []).forEach(word => words.push(word)))));
  return words;
}

function imageToCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}

function cropCanvas(img, x, y, width, height, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);
  enhanceCanvas(ctx, canvas.width, canvas.height);
  return canvas;
}

function enhanceCanvas(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const gray = 0.299 * imageData.data[index] + 0.587 * imageData.data[index + 1] + 0.114 * imageData.data[index + 2];
    const value = gray > 205 ? 255 : gray < 95 ? 0 : Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128));
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
}

function groupConsecutive(values) {
  const groups = [];
  for (const value of values) {
    const last = groups[groups.length - 1];
    if (!last || value > last[last.length - 1] + 1) groups.push([value]);
    else last.push(value);
  }
  return groups;
}

function uniqueByDistance(values, distance) {
  const output = [];
  for (const value of values) {
    if (!output.length || value - output[output.length - 1] >= distance) output.push(value);
  }
  return output;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 1;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を開けません")); };
    img.src = url;
  });
}

function toggleBusy(isBusy) {
  document.getElementById("analyzeButton").disabled = isBusy || !importState.files.length;
  document.getElementById("rakutenImages").disabled = isBusy;
  document.getElementById("ocrProgress").hidden = !isBusy;
}

function updateProgress(percent, text) {
  document.getElementById("ocrProgressBar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
  document.getElementById("ocrProgressText").textContent = text;
}

function resetImport() {
  location.reload();
}
