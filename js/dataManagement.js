// ============================================
// ScoreCraft
// dataManagement.js
// バックアップ・復元・CSV出力・全削除
// ============================================

const BACKUP_FORMAT = "ScoreCraft Backup";
const BACKUP_VERSION = 1;

const DATA_KEYS = [
    STORAGE.ROUNDS,
    STORAGE.CLUBS,
    STORAGE.CONFIG,
    STORAGE.COURSES
];

document.addEventListener("DOMContentLoaded", initializeDataManagement);

function initializeDataManagement() {
    renderDataSummary();

    document
        .getElementById("exportBackupButton")
        .addEventListener("click", exportBackup);

    document
        .getElementById("importBackupButton")
        .addEventListener("click", () => {
            document.getElementById("backupFileInput").click();
        });

    document
        .getElementById("backupFileInput")
        .addEventListener("change", importBackup);

    document
        .getElementById("exportCsvButton")
        .addEventListener("click", exportRoundsCsv);

    document
        .getElementById("deleteAllDataButton")
        .addEventListener("click", deleteAllData);
}

function renderDataSummary() {
    const rounds = readArray(STORAGE.ROUNDS);
    const clubs = readArray(STORAGE.CLUBS);
    const configExists = Boolean(localStorage.getItem(STORAGE.CONFIG));
    const container = document.getElementById("dataSummary");

    container.innerHTML = `
        <div class="data-summary-item">
            <span>ラウンド</span>
            <strong>${rounds.length}</strong>
            <small>件</small>
        </div>
        <div class="data-summary-item">
            <span>マイクラブ</span>
            <strong>${clubs.length}</strong>
            <small>本</small>
        </div>
        <div class="data-summary-item">
            <span>ゴルフ場</span>
            <strong>${readArray(STORAGE.COURSES).length}</strong>
            <small>件</small>
        </div>
        <div class="data-summary-item">
            <span>設定</span>
            <strong>${configExists ? "保存済み" : "未保存"}</strong>
        </div>
    `;
}

function exportBackup() {
    const backup = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        appVersion: typeof APP !== "undefined" ? APP.version : "unknown",
        exportedAt: new Date().toISOString(),
        data: {
            rounds: readArray(STORAGE.ROUNDS),
            clubs: readArray(STORAGE.CLUBS),
            config: readObject(STORAGE.CONFIG),
            courses: readArray(STORAGE.COURSES)
        }
    };

    const filename = `ScoreCraft_backup_${formatFileDate(new Date())}.json`;
    downloadTextFile(filename, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    showDataMessage("バックアップを保存しました。");
}

async function importBackup(event) {
    const input = event.target;
    const file = input.files && input.files[0];

    if (!file) {
        return;
    }

    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        validateBackup(backup);

        const shouldRestore = window.confirm(
            "現在のラウンド・設定・マイクラブを、選択したバックアップで上書きします。復元しますか？"
        );

        if (!shouldRestore) {
            return;
        }

        localStorage.setItem(STORAGE.ROUNDS, JSON.stringify(backup.data.rounds));
        localStorage.setItem(STORAGE.CLUBS, JSON.stringify(backup.data.clubs));
        localStorage.setItem(STORAGE.COURSES, JSON.stringify(backup.data.courses || []));

        if (backup.data.config && typeof backup.data.config === "object") {
            localStorage.setItem(STORAGE.CONFIG, JSON.stringify(backup.data.config));
        } else {
            localStorage.removeItem(STORAGE.CONFIG);
        }

        renderDataSummary();
        showDataMessage("バックアップを復元しました。画面を再読み込みします。");

        window.setTimeout(() => {
            location.reload();
        }, 900);
    } catch (error) {
        console.error(error);
        showDataMessage("復元できませんでした。ScoreCraftのバックアップファイルを選択してください。", true);
    } finally {
        input.value = "";
    }
}

function validateBackup(backup) {
    const valid =
        backup &&
        backup.format === BACKUP_FORMAT &&
        backup.data &&
        Array.isArray(backup.data.rounds) &&
        Array.isArray(backup.data.clubs) &&
        (backup.data.config === null || typeof backup.data.config === "object") &&
        (!backup.data.courses || Array.isArray(backup.data.courses));

    if (!valid) {
        throw new Error("Invalid ScoreCraft backup");
    }
}

function exportRoundsCsv() {
    const rounds = readArray(STORAGE.ROUNDS);

    if (rounds.length === 0) {
        showDataMessage("CSVに出力できるラウンドがありません。", true);
        return;
    }

    const rows = [
        [
            "ラウンド日",
            "ゴルフ場",
            "コース",
            "合計スコア",
            "合計パット",
            "OB",
            "1ペナ",
            "バンカー",
            "OUTスコア",
            "INスコア",
            "保存日時"
        ]
    ];

    rounds
        .slice()
        .sort((a, b) => String(a.date || a.roundDate || "").localeCompare(String(b.date || b.roundDate || "")))
        .forEach(round => {
            const holes = Array.isArray(round.holes) ? round.holes : [];
            const scores = holes.map(hole => numberValue(hole.score));
            const outScore = scores.slice(0, 9).reduce((sum, value) => sum + value, 0);
            const inScore = scores.slice(9, 18).reduce((sum, value) => sum + value, 0);
            const totalScore = numberValue(round.totalScore) || scores.reduce((sum, value) => sum + value, 0);
            const totalPutts = numberValue(round.totalPutts) || sumHoleValue(holes, "putt", "putts");
            const totalOb = numberValue(round.totalOb) || sumHoleValue(holes, "ob");
            const totalPenalty = numberValue(round.totalOnePenalty) || sumHoleValue(holes, "onePenalty", "penalty");
            const totalBunker = numberValue(round.totalBunker) || sumHoleValue(holes, "bunker");

            rows.push([
                round.date || round.roundDate || "",
                round.courseName || round.course?.name || "未設定",
                round.course?.courseName || round.courseNameDetail || "",
                totalScore,
                totalPutts,
                totalOb,
                totalPenalty,
                totalBunker,
                outScore,
                inScore,
                round.createdAt || round.savedAt || ""
            ]);
        });

    const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const filename = `ScoreCraft_rounds_${formatFileDate(new Date())}.csv`;
    downloadTextFile(filename, csv, "text/csv;charset=utf-8");
    showDataMessage(`${rounds.length}件のラウンドをCSV出力しました。`);
}

function deleteAllData() {
    const firstConfirm = window.confirm(
        "ScoreCraftに保存されているラウンド・設定・マイクラブをすべて削除します。続けますか？"
    );

    if (!firstConfirm) {
        return;
    }

    const finalConfirm = window.confirm(
        "削除したデータは元に戻せません。バックアップ済みであることを確認してください。本当に削除しますか？"
    );

    if (!finalConfirm) {
        return;
    }

    DATA_KEYS.forEach(key => localStorage.removeItem(key));

    if (typeof initializeConfig === "function") {
        initializeConfig();
    }

    renderDataSummary();

    if (typeof loadSettings === "function") {
        loadSettings();
        createInputItems();
    }

    showDataMessage("すべてのデータを削除しました。");
}

function readArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function readObject(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function sumHoleValue(holes, ...keys) {
    return holes.reduce((sum, hole) => {
        const key = keys.find(candidate => hole[candidate] !== undefined);
        return sum + numberValue(key ? hole[key] : 0);
    }, 0);
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
}

function formatFileDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}${month}${day}_${hour}${minute}`;
}

function downloadTextFile(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showDataMessage(message, isError = false) {
    const area = document.getElementById("dataMessageArea");
    area.textContent = message;
    area.classList.toggle("error", isError);

    window.clearTimeout(showDataMessage.timer);
    showDataMessage.timer = window.setTimeout(() => {
        area.textContent = "";
        area.classList.remove("error");
    }, 4200);
}
