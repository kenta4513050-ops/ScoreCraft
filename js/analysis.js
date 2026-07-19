// ============================================
// ScoreCraft
// analysis.js
// ラウンド分析
// ============================================

"use strict";

const ANALYSIS_CLUB_NAMES = {
    driver: "Driver", "2w": "2W", "3w": "3W", "5w": "5W", "7w": "7W", "9w": "9W",
    "2ut": "2UT", "3ut": "3UT", "4ut": "4UT", "5ut": "5UT", "6ut": "6UT",
    "3i": "3I", "4i": "4I", "5i": "5I", "6i": "6I", "7i": "7I", "8i": "8I", "9i": "9I",
    pw: "PW", "46": "46°", "48": "48°", "50": "50°", "52": "52°", "54": "54°",
    "56": "56°", "58": "58°", "60": "60°", putter: "Putter"
};

let analysisRounds = [];
let resizeTimer = null;

document.addEventListener("DOMContentLoaded", initializeAnalysis);
window.addEventListener("resize", handleChartResize);

function initializeAnalysis() {
    if (typeof renderNavigation === "function") {
        renderNavigation("analysis");
    }

    analysisRounds = loadAnalysisRounds();
    renderAnalysis();
}

function loadAnalysisRounds() {
    let rounds = [];

    try {
        if (typeof load === "function" && typeof STORAGE !== "undefined") {
            rounds = load(STORAGE.ROUNDS);
        } else {
            rounds = JSON.parse(localStorage.getItem("scorecraft_rounds") || "[]");
        }
    } catch (error) {
        console.error("分析データを読み込めませんでした。", error);
        rounds = [];
    }

    if (!Array.isArray(rounds)) return [];

    return rounds
        .filter(round => round && round.status !== "draft" && getRoundScore(round) > 0)
        .sort((a, b) => getRoundTime(b) - getRoundTime(a));
}

function renderAnalysis() {
    const count = document.getElementById("analysisRoundCount");
    if (count) count.textContent = `${analysisRounds.length}回`;

    if (analysisRounds.length === 0) {
        renderEmptyAnalysis();
        return;
    }

    renderSummary();
    renderScoreChart();
    renderRecentRounds();
    renderDirectionAnalysis();
    renderClubAnalysis();
}

function renderEmptyAnalysis() {
    const empty = `
        <div class="empty-state compact">
            <p>分析できるラウンドがまだありません。</p>
            <button class="btn" type="button" onclick="location.href='round.html'">
                ⛳ ラウンドを入力
            </button>
        </div>
    `;

    document.getElementById("analysisSummary").innerHTML = empty;
    document.getElementById("scoreChartArea").innerHTML = empty;
    document.getElementById("recentAnalysisRounds").innerHTML = empty;
    document.getElementById("directionAnalysis").innerHTML = empty;
    document.getElementById("clubAnalysis").innerHTML = empty;
}

function renderSummary() {
    const scores = analysisRounds.map(getRoundScore);
    const totalPutts = sumHoleValue("putts");
    const totalOb = sumHoleValue("ob");
    const totalBunker = sumHoleValue("bunker");

    const stats = [
        ["平均スコア", formatDecimal(average(scores))],
        ["ベスト", Math.min(...scores)],
        ["ラウンド数", `${analysisRounds.length}回`],
        ["平均パット", formatDecimal(totalPutts / analysisRounds.length)],
        ["OB平均", formatDecimal(totalOb / analysisRounds.length)],
        ["バンカー平均", formatDecimal(totalBunker / analysisRounds.length)]
    ];

    document.getElementById("analysisSummary").innerHTML = stats.map(([label, value]) => `
        <div class="analysis-stat-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
        </div>
    `).join("");
}

function renderRecentRounds() {
    const container = document.getElementById("recentAnalysisRounds");
    const recent = analysisRounds.slice(0, 5);

    container.innerHTML = `
        <div class="analysis-recent-list">
            ${recent.map(round => `
                <button class="analysis-recent-item" type="button" data-round-id="${escapeHtml(round.id || "")}">
                    <span class="analysis-recent-date">${escapeHtml(formatAnalysisDate(round.date))}</span>
                    <span class="analysis-recent-course">${escapeHtml(round.courseName || "ゴルフ場名未設定")}</span>
                    <strong>${getRoundScore(round)}</strong>
                    <span class="history-item-arrow">›</span>
                </button>
            `).join("")}
        </div>
    `;

    container.querySelectorAll("[data-round-id]").forEach(button => {
        button.addEventListener("click", () => {
            location.href = `history.html?id=${encodeURIComponent(button.dataset.roundId)}`;
        });
    });
}

function renderDirectionAnalysis() {
    const counts = { left: 0, center: 0, right: 0 };

    analysisRounds.forEach(round => {
        getHoles(round).forEach(hole => {
            const direction = normalizeDirection(hole?.teeShot?.direction);
            if (direction) counts[direction] += 1;
        });
    });

    const total = counts.left + counts.center + counts.right;
    const container = document.getElementById("directionAnalysis");

    if (total === 0) {
        container.innerHTML = `<div class="empty-state compact"><p>ティーショット方向の入力データがありません。</p></div>`;
        return;
    }

    const items = [
        ["左", counts.left, "left"],
        ["中央", counts.center, "center"],
        ["右", counts.right, "right"]
    ];

    container.innerHTML = `
        <div class="direction-grid">
            ${items.map(([label, value, key]) => {
                const percentage = Math.round((value / total) * 100);
                return `
                    <div class="direction-card direction-${key}">
                        <span>${label}</span>
                        <strong>${percentage}%</strong>
                        <small>${value}回</small>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderClubAnalysis() {
    const counts = {};

    analysisRounds.forEach(round => {
        getHoles(round).forEach(hole => {
            const clubId = String(hole?.teeShot?.clubId || "").trim();
            if (clubId) counts[clubId] = (counts[clubId] || 0) + 1;
        });
    });

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const container = document.getElementById("clubAnalysis");

    if (total === 0) {
        container.innerHTML = `<div class="empty-state compact"><p>使用クラブの入力データがありません。</p></div>`;
        return;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    container.innerHTML = `
        <div class="club-analysis-list">
            ${sorted.map(([clubId, count]) => {
                const percentage = Math.round((count / total) * 100);
                return `
                    <div class="club-analysis-item">
                        <div class="club-analysis-heading">
                            <strong>${escapeHtml(getClubName(clubId))}</strong>
                            <span>${percentage}% <small>(${count}回)</small></span>
                        </div>
                        <div class="analysis-progress" aria-label="${percentage}%">
                            <span style="width:${percentage}%"></span>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderScoreChart() {
    const canvas = document.getElementById("scoreChart");
    if (!canvas || !canvas.getContext) return;

    const displayRounds = [...analysisRounds].reverse().slice(-12);
    const scores = displayRounds.map(getRoundScore);
    const rect = canvas.parentElement.getBoundingClientRect();
    const cssWidth = Math.max(280, Math.floor(rect.width));
    const cssHeight = 230;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    const padding = { top: 22, right: 18, bottom: 42, left: 42 };
    const chartWidth = cssWidth - padding.left - padding.right;
    const chartHeight = cssHeight - padding.top - padding.bottom;
    const rawMin = Math.min(...scores);
    const rawMax = Math.max(...scores);
    const minScore = Math.floor((rawMin - 5) / 5) * 5;
    const maxScore = Math.ceil((rawMax + 5) / 5) * 5;
    const range = Math.max(10, maxScore - minScore);

    context.font = '11px "Yu Gothic UI", sans-serif';
    context.textAlign = "right";
    context.textBaseline = "middle";

    for (let i = 0; i <= 4; i += 1) {
        const value = maxScore - (range * i / 4);
        const y = padding.top + (chartHeight * i / 4);
        context.strokeStyle = "#e3e8e3";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(cssWidth - padding.right, y);
        context.stroke();
        context.fillStyle = "#777777";
        context.fillText(String(Math.round(value)), padding.left - 8, y);
    }

    const points = scores.map((score, index) => {
        const x = scores.length === 1
            ? padding.left + chartWidth / 2
            : padding.left + (chartWidth * index / (scores.length - 1));
        const y = padding.top + ((maxScore - score) / range) * chartHeight;
        return { x, y, score };
    });

    context.strokeStyle = "#2E7D32";
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.beginPath();
    points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
    });
    context.stroke();

    points.forEach((point, index) => {
        context.fillStyle = "#ffffff";
        context.strokeStyle = "#2E7D32";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        context.fillStyle = "#222222";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.font = 'bold 11px "Yu Gothic UI", sans-serif';
        context.fillText(String(point.score), point.x, point.y - 8);

        context.fillStyle = "#777777";
        context.textBaseline = "top";
        context.font = '10px "Yu Gothic UI", sans-serif';
        context.fillText(formatChartDate(displayRounds[index].date), point.x, cssHeight - padding.bottom + 12);
    });
}

function handleChartResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (analysisRounds.length > 0) renderScoreChart();
    }, 120);
}

function sumHoleValue(key) {
    return analysisRounds.reduce((roundTotal, round) => {
        return roundTotal + getHoles(round).reduce((holeTotal, hole) => {
            const value = Number(hole?.[key]);
            return holeTotal + (Number.isFinite(value) ? value : 0);
        }, 0);
    }, 0);
}

function getHoles(round) {
    return Array.isArray(round?.holes) ? round.holes : [];
}

function getRoundScore(round) {
    const total = Number(round?.total);
    if (Number.isFinite(total) && total > 0) return total;

    return getHoles(round).reduce((sum, hole) => {
        const score = Number(hole?.score);
        return sum + (Number.isFinite(score) ? score : 0);
    }, 0);
}

function getRoundTime(round) {
    const value = round?.completedAt || round?.date || round?.updatedAt || round?.createdAt;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function normalizeDirection(value) {
    const direction = String(value || "").toLowerCase().trim();
    if (["left", "l", "左"].includes(direction)) return "left";
    if (["center", "centre", "straight", "middle", "c", "中央", "真ん中", "ストレート"].includes(direction)) return "center";
    if (["right", "r", "右"].includes(direction)) return "right";
    return "";
}

function getClubName(clubId) {
    return ANALYSIS_CLUB_NAMES[clubId] || clubId.toUpperCase();
}

function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDecimal(value) {
    return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function formatAnalysisDate(value) {
    if (!value) return "日付未設定";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatChartDate(value) {
    if (!value) return "-";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "-";
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
