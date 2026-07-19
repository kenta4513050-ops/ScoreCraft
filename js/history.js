// ============================================
// ScoreCraft
// history.js
// ラウンド履歴・詳細・削除
// ============================================

"use strict";

const historyState = {
    rounds: [],
    filteredRounds: [],
    selectedRoundId: ""
};

document.addEventListener("DOMContentLoaded", initializeHistory);

function initializeHistory() {
    if (typeof renderNavigation === "function") {
        renderNavigation("history");
    }

    historyState.rounds = loadCompletedRounds();
    historyState.filteredRounds = [...historyState.rounds];

    bindHistoryEvents();
    renderHistoryList();

    const requestedRoundId = new URLSearchParams(location.search).get("id");

    if (requestedRoundId) {
        showRoundDetail(requestedRoundId);
    }
}

function bindHistoryEvents() {
    const searchInput = document.getElementById("historySearch");
    const closeButton = document.getElementById("closeDetailButton");
    const editButton = document.getElementById("editRoundButton");
    const deleteButton = document.getElementById("deleteRoundButton");

    if (searchInput) {
        searchInput.addEventListener("input", handleHistorySearch);
    }

    if (closeButton) {
        closeButton.addEventListener("click", closeRoundDetail);
    }

    if (editButton) {
        editButton.addEventListener("click", editSelectedRound);
    }

    if (deleteButton) {
        deleteButton.addEventListener("click", deleteSelectedRound);
    }
}

function loadCompletedRounds() {
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
        console.error("ラウンド履歴を読み込めませんでした。", error);
        rounds = [];
    }

    if (!Array.isArray(rounds)) {
        return [];
    }

    return rounds
        .filter(round => round && round.status !== "draft")
        .sort((a, b) => getRoundTimestamp(b) - getRoundTimestamp(a));
}

function handleHistorySearch(event) {
    const keyword = normalizeText(event.target.value);

    if (!keyword) {
        historyState.filteredRounds = [...historyState.rounds];
    } else {
        historyState.filteredRounds = historyState.rounds.filter(round => {
            const searchableText = [
                round.courseName,
                round.coursePrefecture,
                round.courseLayoutName,
                round.date
            ]
                .filter(Boolean)
                .join(" ");

            return normalizeText(searchableText).includes(keyword);
        });
    }

    renderHistoryList();
}

function renderHistoryList() {
    const container = document.getElementById("historyList");
    const count = document.getElementById("historyCount");

    if (!container) {
        return;
    }

    if (count) {
        count.textContent = `${historyState.filteredRounds.length}回`;
    }

    if (historyState.rounds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>保存されたラウンドはまだありません。</p>
                <button class="btn" type="button" onclick="location.href='round.html'">
                    ⛳ 最初のラウンドを入力
                </button>
            </div>
        `;
        return;
    }

    if (historyState.filteredRounds.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact">
                <p>検索条件に一致するラウンドがありません。</p>
            </div>
        `;
        return;
    }

    const list = document.createElement("div");
    list.className = "history-list";

    historyState.filteredRounds.forEach(round => {
        list.appendChild(createHistoryItem(round));
    });

    container.innerHTML = "";
    container.appendChild(list);
}

function createHistoryItem(round) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.addEventListener("click", () => showRoundDetail(round.id));

    const main = document.createElement("div");
    main.className = "history-item-main";

    const date = document.createElement("span");
    date.className = "history-item-date";
    date.textContent = formatDate(round.date);

    const course = document.createElement("strong");
    course.className = "history-item-course";
    course.textContent = round.courseName || "ゴルフ場名未設定";

    const detail = document.createElement("span");
    detail.className = "history-item-detail";
    detail.textContent = createCourseDetailText(round);

    main.appendChild(date);
    main.appendChild(course);
    main.appendChild(detail);

    const scoreArea = document.createElement("div");
    scoreArea.className = "history-item-score-area";

    const score = document.createElement("strong");
    score.className = "history-item-score";
    score.textContent = String(getScore(round));

    const relative = document.createElement("span");
    relative.className = "history-item-relative";
    relative.textContent = getRelativeScore(round);

    scoreArea.appendChild(score);

    if (relative.textContent) {
        scoreArea.appendChild(relative);
    }

    const arrow = document.createElement("span");
    arrow.className = "history-item-arrow";
    arrow.textContent = "›";

    button.appendChild(main);
    button.appendChild(scoreArea);
    button.appendChild(arrow);

    return button;
}

function showRoundDetail(roundId) {
    const round = historyState.rounds.find(item => item.id === roundId);
    const section = document.getElementById("roundDetailSection");
    const container = document.getElementById("roundDetail");

    if (!round || !section || !container) {
        return;
    }

    historyState.selectedRoundId = round.id;

    container.innerHTML = "";
    container.appendChild(createDetailSummary(round));
    container.appendChild(createHoleScoreTable(round));

    section.hidden = false;
    section.scrollIntoView({ behavior: "smooth", block: "start" });

    const url = new URL(location.href);
    url.searchParams.set("id", round.id);
    history.replaceState(null, "", url);
}

function createDetailSummary(round) {
    const wrapper = document.createElement("div");
    wrapper.className = "round-detail-summary";

    const heading = document.createElement("div");
    heading.className = "round-detail-heading";

    const course = document.createElement("strong");
    course.className = "round-detail-course";
    course.textContent = round.courseName || "ゴルフ場名未設定";

    const meta = document.createElement("p");
    meta.className = "round-detail-meta";
    meta.textContent = [
        formatDate(round.date),
        round.coursePrefecture,
        round.courseLayoutName
    ].filter(Boolean).join(" / ");

    heading.appendChild(course);
    heading.appendChild(meta);

    const stats = document.createElement("div");
    stats.className = "round-detail-stats";

    stats.appendChild(createDetailStat("OUT", getNumberOrDash(round.out)));
    stats.appendChild(createDetailStat("IN", getNumberOrDash(round.in)));
    stats.appendChild(createDetailStat("TOTAL", getScore(round)));
    stats.appendChild(createDetailStat("PAR差", getRelativeScore(round) || "-"));

    wrapper.appendChild(heading);
    wrapper.appendChild(stats);

    return wrapper;
}

function createDetailStat(label, value) {
    const item = document.createElement("div");
    item.className = "round-detail-stat";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("strong");
    valueElement.textContent = String(value);

    item.appendChild(labelElement);
    item.appendChild(valueElement);

    return item;
}

function createHoleScoreTable(round) {
    const wrapper = document.createElement("div");
    wrapper.className = "hole-table-wrapper";

    const table = document.createElement("table");
    table.className = "hole-score-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>HOLE</th>
            <th>PAR</th>
            <th>SCORE</th>
            <th>PUTT</th>
            <th>OB</th>
        </tr>
    `;

    const tbody = document.createElement("tbody");
    const holes = Array.isArray(round.holes) ? round.holes : [];

    holes.forEach(hole => {
        const row = document.createElement("tr");
        const scoreClass = getHoleScoreClass(hole);

        row.innerHTML = `
            <td>${escapeHtml(String(hole.hole ?? "-"))}</td>
            <td>${escapeHtml(String(hole.par ?? "-"))}</td>
            <td class="${scoreClass}">${escapeHtml(String(hole.score ?? "-"))}</td>
            <td>${escapeHtml(String(hole.putts ?? "-"))}</td>
            <td>${escapeHtml(String(hole.ob ?? 0))}</td>
        `;

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
}

function getHoleScoreClass(hole) {
    const score = Number(hole && hole.score);
    const par = Number(hole && hole.par);

    if (!Number.isFinite(score) || !Number.isFinite(par)) {
        return "";
    }

    const difference = score - par;

    if (difference <= -2) {
        return "score-eagle";
    }

    if (difference === -1) {
        return "score-birdie";
    }

    if (difference === 0) {
        return "score-par";
    }

    if (difference === 1) {
        return "score-bogey";
    }

    return "score-double-or-more";
}

function closeRoundDetail() {
    const section = document.getElementById("roundDetailSection");

    historyState.selectedRoundId = "";

    if (section) {
        section.hidden = true;
    }

    const url = new URL(location.href);
    url.searchParams.delete("id");
    history.replaceState(null, "", url);
}


function editSelectedRound() {
    const roundId = historyState.selectedRoundId;

    if (!roundId) {
        return;
    }

    location.href = `round.html?edit=${encodeURIComponent(roundId)}`;
}

function deleteSelectedRound() {
    const roundId = historyState.selectedRoundId;
    const round = historyState.rounds.find(item => item.id === roundId);

    if (!round) {
        return;
    }

    const shouldDelete = window.confirm(
        `${round.courseName || "このラウンド"}の記録を削除しますか？\nこの操作は取り消せません。`
    );

    if (!shouldDelete) {
        return;
    }

    try {
        if (
            typeof remove === "function" &&
            typeof STORAGE !== "undefined" &&
            STORAGE.ROUNDS
        ) {
            remove(STORAGE.ROUNDS, roundId);
        } else {
            const filtered = historyState.rounds.filter(item => item.id !== roundId);
            localStorage.setItem("scorecraft_rounds", JSON.stringify(filtered));
        }
    } catch (error) {
        console.error("ラウンドを削除できませんでした。", error);
        window.alert("ラウンドを削除できませんでした。");
        return;
    }

    historyState.rounds = historyState.rounds.filter(item => item.id !== roundId);
    historyState.filteredRounds = historyState.filteredRounds.filter(item => item.id !== roundId);

    closeRoundDetail();
    renderHistoryList();
}

function getScore(round) {
    const score = Number(round && round.total);
    return Number.isFinite(score) && score > 0 ? score : "-";
}

function getRelativeScore(round) {
    const score = Number(round && round.total);
    const par = Number(round && round.totalPar);

    if (
        !Number.isFinite(score) ||
        score <= 0 ||
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

function createCourseDetailText(round) {
    return [round.coursePrefecture, round.courseLayoutName]
        .filter(Boolean)
        .join(" / ") || "詳細情報なし";
}

function formatDate(value) {
    if (!value) {
        return "日付未設定";
    }

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

function getNumberOrDash(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : "-";
}

function normalizeText(value) {
    return String(value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, "");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
