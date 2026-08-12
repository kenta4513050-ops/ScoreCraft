// ============================================
// ScoreCraft
// backup.js
// 自動バックアップ（内部ローテーション + JSONファイル）
// ============================================

"use strict";

const SCORECRAFT_BACKUP_FORMAT = "ScoreCraft Backup";
const SCORECRAFT_BACKUP_VERSION = 2;
const SCORECRAFT_AUTO_BACKUP_KEY = "scorecraft_auto_backups";
const SCORECRAFT_AUTO_BACKUP_ENABLED_KEY = "scorecraft_auto_backup_enabled";
const SCORECRAFT_AUTO_BACKUP_LIMIT = 5;

function isScoreCraftAutoBackupEnabled() {
    try {
        const raw = localStorage.getItem(SCORECRAFT_AUTO_BACKUP_ENABLED_KEY);
        return raw === null ? true : raw !== "0";
    } catch (_) {
        return true;
    }
}

function setScoreCraftAutoBackupEnabled(enabled) {
    try {
        localStorage.setItem(SCORECRAFT_AUTO_BACKUP_ENABLED_KEY, enabled ? "1" : "0");
    } catch (error) {
        console.error("自動バックアップ設定を保存できませんでした。", error);
    }
}

function safeReadArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch (_) {
        return [];
    }
}

function safeReadObject(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function createScoreCraftBackup(reason = "manual") {
    const roundsKey = typeof STORAGE !== "undefined" && STORAGE.ROUNDS ? STORAGE.ROUNDS : "scorecraft_rounds";
    const clubsKey = typeof STORAGE !== "undefined" && STORAGE.CLUBS ? STORAGE.CLUBS : "scorecraft_clubs";
    const configKey = typeof STORAGE !== "undefined" && STORAGE.CONFIG ? STORAGE.CONFIG : "scorecraft_config";
    const coursesKey = typeof STORAGE !== "undefined" && STORAGE.COURSES ? STORAGE.COURSES : "scorecraft_custom_courses";

    return {
        format: SCORECRAFT_BACKUP_FORMAT,
        version: SCORECRAFT_BACKUP_VERSION,
        appVersion: typeof APP !== "undefined" ? APP.version : "unknown",
        exportedAt: new Date().toISOString(),
        reason,
        data: {
            rounds: safeReadArray(roundsKey),
            clubs: safeReadArray(clubsKey),
            config: safeReadObject(configKey),
            courses: safeReadArray(coursesKey)
        }
    };
}

function saveRollingAutoBackup(backup) {
    try {
        const history = safeReadArray(SCORECRAFT_AUTO_BACKUP_KEY);
        const next = [backup, ...history].slice(0, SCORECRAFT_AUTO_BACKUP_LIMIT);
        localStorage.setItem(SCORECRAFT_AUTO_BACKUP_KEY, JSON.stringify(next));
        return next;
    } catch (error) {
        console.error("内部自動バックアップを保存できませんでした。", error);
        return [];
    }
}

function getRollingAutoBackups() {
    return safeReadArray(SCORECRAFT_AUTO_BACKUP_KEY);
}

function formatAutoBackupDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}_${hour}${minute}${second}`;
}

function downloadScoreCraftBackup(backup, prefix = "ScoreCraft_AutoBackup") {
    try {
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json;charset=utf-8"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${prefix}_${formatAutoBackupDate(new Date())}.json`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
    } catch (error) {
        console.error("バックアップファイルを作成できませんでした。", error);
        return false;
    }
}

function runScoreCraftAutoBackup(reason = "auto", options = {}) {
    if (!isScoreCraftAutoBackupEnabled()) {
        return { skipped: true, downloaded: false, backup: null };
    }

    const backup = createScoreCraftBackup(reason);
    saveRollingAutoBackup(backup);

    const shouldDownload = Boolean(options.download);
    const downloaded = shouldDownload ? downloadScoreCraftBackup(backup) : false;

    return { skipped: false, downloaded, backup };
}

function restoreScoreCraftBackupData(backup) {
    if (!backup || backup.format !== SCORECRAFT_BACKUP_FORMAT || !backup.data || !Array.isArray(backup.data.rounds)) {
        throw new Error("Invalid ScoreCraft backup");
    }

    const roundsKey = typeof STORAGE !== "undefined" && STORAGE.ROUNDS ? STORAGE.ROUNDS : "scorecraft_rounds";
    const clubsKey = typeof STORAGE !== "undefined" && STORAGE.CLUBS ? STORAGE.CLUBS : "scorecraft_clubs";
    const configKey = typeof STORAGE !== "undefined" && STORAGE.CONFIG ? STORAGE.CONFIG : "scorecraft_config";
    const coursesKey = typeof STORAGE !== "undefined" && STORAGE.COURSES ? STORAGE.COURSES : "scorecraft_custom_courses";

    localStorage.setItem(roundsKey, JSON.stringify(Array.isArray(backup.data.rounds) ? backup.data.rounds : []));
    localStorage.setItem(clubsKey, JSON.stringify(Array.isArray(backup.data.clubs) ? backup.data.clubs : []));
    localStorage.setItem(coursesKey, JSON.stringify(Array.isArray(backup.data.courses) ? backup.data.courses : []));

    if (backup.data.config && typeof backup.data.config === "object") {
        localStorage.setItem(configKey, JSON.stringify(backup.data.config));
    } else {
        localStorage.removeItem(configKey);
    }
}
