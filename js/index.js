// ============================================
// ScoreCraft
// index.js
// ホーム・ダッシュボード
// ============================================

"use strict";

document.addEventListener("DOMContentLoaded", initializeDashboard);

function initializeDashboard() {
    if (typeof renderNavigation === "function") {
        renderNavigation("home");
    }

    const rounds = getSavedRounds();

    renderDashboard(rounds);
    renderRecentRounds(rounds);
}

function getSavedRounds() {
    let rounds = [];

    try {
        if (
            typeof load === "function" &&
            typeof STORAGE !== "undefined" &&
            STORAGE.ROUNDS
        ) {
            rounds = load(STORAGE.ROUNDS);
        } else {
            rounds = JSON.parse(
                localStorage.getItem("scorecraft_rounds") || "[]"
            );
        }
    } catch (error) {
        console.error("ラウンドデータを読み込めませんでした。", error);
        rounds = [];
    }

    if (!Array.isArray(rounds)) {
        return [];
    }

    return rounds
        .filter(round => round && round.status !== "draft")
        .sort((a, b) => getRoundTimestamp(b) - getRoundTimestamp(a));
}

function renderDashboard(rounds) {
    const dashboard = document.getElementById("dashboard");

    if (!dashboard) {
        return;
    }

    if (rounds.length === 0) {
        dashboard.innerHTML = `
            <div class="empty-state">
                <p>まだラウンドデータがありません。</p>
                <p>最初のラウンドを登録してみましょう！</p>
            </div>
        `;
        return;
    }

    const recentTenRounds = rounds.slice(0, 10);
    const averageScore = calculateAverageScore(recentTenRounds);
    const bestScore = calculateBestScore(rounds);
    const latestScore = getValidScore(rounds[0]);

    dashboard.innerHTML = `
        <div class="dashboard-grid">
            ${createStatCard("最新スコア", latestScore, "")}
            ${createStatCard("直近10回平均", averageScore, "")}
            ${createStatCard("ベストスコア", bestScore, "")}
            ${createStatCard("登録ラウンド", rounds.length, "回")}
        </div>
    `;
}

function renderRecentRounds(rounds) {
    const container = document.getElementById("recentRounds");

    if (!container) {
        return;
    }

    if (rounds.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact">
                <p>保存したラウンドがここに表示されます。</p>
            </div>
        `;
        return;
    }

    const recentRounds = rounds.slice(0, 5);
    const list = document.createElement("div");
    list.className = "recent-round-list";

    recentRounds.forEach(round => {
        list.appendChild(createRoundCard(round));
    });

    container.innerHTML = "";
    container.appendChild(list);
}

function createRoundCard(round) {
    const article = document.createElement("article");
    article.className = "recent-round-item";
    article.tabIndex = 0;
    article.setAttribute("role", "link");
    article.addEventListener("click", () => {
        location.href = `history.html?id=${encodeURIComponent(round.id)}`;
    });
    article.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            location.href = `history.html?id=${encodeURIComponent(round.id)}`;
        }
    });

    const main = document.createElement("div");
    main.className = "recent-round-main";

    const courseName = document.createElement("strong");
    courseName.className = "recent-round-course";
    courseName.textContent = round.courseName || "ゴルフ場名未設定";

    const meta = document.createElement("p");
    meta.className = "recent-round-meta";
    meta.textContent = createRoundMetaText(round);

    main.appendChild(courseName);
    main.appendChild(meta);

    const scoreArea = document.createElement("div");
    scoreArea.className = "recent-round-score-area";

    const scoreLabel = document.createElement("span");
    scoreLabel.className = "recent-round-score-label";
    scoreLabel.textContent = "SCORE";

    const score = document.createElement("strong");
    score.className = "recent-round-score";
    score.textContent = String(getValidScore(round));

    const relative = getScoreRelativeToPar(round);
    const relativeElement = document.createElement("span");
    relativeElement.className = "recent-round-relative";
    relativeElement.textContent = relative;

    scoreArea.appendChild(scoreLabel);
    scoreArea.appendChild(score);

    if (relative) {
        scoreArea.appendChild(relativeElement);
    }

    article.appendChild(main);
    article.appendChild(scoreArea);

    return article;
}

function createStatCard(label, value, suffix) {
    return `
        <div class="dashboard-stat">
            <span class="dashboard-stat-label">${escapeHtml(label)}</span>
            <div class="dashboard-stat-value">
                ${escapeHtml(String(value))}
                ${suffix ? `<small>${escapeHtml(suffix)}</small>` : ""}
            </div>
        </div>
    `;
}

function calculateAverageScore(rounds) {
    const scores = rounds
        .map(getValidScoreNumber)
        .filter(score => score !== null);

    if (scores.length === 0) {
        return "-";
    }

    const total = scores.reduce((sum, score) => sum + score, 0);
    return (total / scores.length).toFixed(1);
}

function calculateBestScore(rounds) {
    const scores = rounds
        .map(getValidScoreNumber)
        .filter(score => score !== null);

    return scores.length > 0 ? Math.min(...scores) : "-";
}

function getValidScore(round) {
    const score = getValidScoreNumber(round);
    return score === null ? "-" : score;
}

function getValidScoreNumber(round) {
    const score = Number(round && round.total);

    if (!Number.isFinite(score) || score <= 0) {
        return null;
    }

    return score;
}

function getScoreRelativeToPar(round) {
    const score = getValidScoreNumber(round);
    const par = Number(round && round.totalPar);

    if (
        score === null ||
        !Number.isFinite(par) ||
        par <= 0
    ) {
        return "";
    }

    const difference = score - par;

    if (difference === 0) {
        return "E";
    }

    return difference > 0 ? `+${difference}` : String(difference);
}

function createRoundMetaText(round) {
    const items = [];

    if (round.date) {
        items.push(formatDate(round.date));
    }

    if (round.coursePrefecture) {
        items.push(round.coursePrefecture);
    }

    if (round.courseLayoutName) {
        items.push(round.courseLayoutName);
    }

    return items.join(" / ") || "詳細情報なし";
}

function formatDate(value) {
    const parts = String(value).split("-");

    if (parts.length !== 3) {
        return String(value);
    }

    return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
}

function getRoundTimestamp(round) {
    const candidates = [
        round && round.date,
        round && round.completedAt,
        round && round.updatedAt,
        round && round.createdAt
    ];

    for (const candidate of candidates) {
        const timestamp = Date.parse(candidate);

        if (Number.isFinite(timestamp)) {
            return timestamp;
        }
    }

    return 0;
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
