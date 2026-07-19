// ============================================
// ScoreCraft
// config.js
// アプリ設定（iPhone / PWA対応版）
// ============================================

"use strict";

const INPUT_MODES = Object.freeze({
    SIMPLE: "simple",
    STANDARD: "standard",
    CUSTOM: "custom"
});

const DEFAULT_CONFIG = Object.freeze({
    version: 2,
    inputMode: INPUT_MODES.STANDARD,
    distanceUnit: "step",
    enabledInputs: Object.freeze({
        score: true,
        putt: true,
        greenDistance: false,
        teeClub: true,
        direction: true,
        ob: true,
        onePenalty: true,
        bunker: true,
        memo: false
    })
});

const CONFIG_KEY = "scorecraft_config";

function cloneDefaultConfig() {
    return {
        version: DEFAULT_CONFIG.version,
        inputMode: DEFAULT_CONFIG.inputMode,
        distanceUnit: DEFAULT_CONFIG.distanceUnit,
        enabledInputs: { ...DEFAULT_CONFIG.enabledInputs }
    };
}

function normalizeConfig(value) {
    const base = cloneDefaultConfig();
    const source = value && typeof value === "object" ? value : {};

    if (Object.values(INPUT_MODES).includes(source.inputMode)) {
        base.inputMode = source.inputMode;
    }

    if (["step", "yard"].includes(source.distanceUnit)) {
        base.distanceUnit = source.distanceUnit;
    }

    if (source.enabledInputs && typeof source.enabledInputs === "object") {
        Object.keys(base.enabledInputs).forEach(key => {
            if (typeof source.enabledInputs[key] === "boolean") {
                base.enabledInputs[key] = source.enabledInputs[key];
            }
        });
    }

    // スコアはどのモードでも必須。
    base.enabledInputs.score = true;
    base.version = DEFAULT_CONFIG.version;
    return base;
}

function getConfig() {
    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return cloneDefaultConfig();
        return normalizeConfig(JSON.parse(raw));
    } catch (error) {
        console.error("設定を読み込めませんでした。", error);
        return cloneDefaultConfig();
    }
}

function saveConfig(config) {
    const normalized = normalizeConfig(config);

    try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));

        // iOS Safariでも書込み結果をその場で検証する。
        const savedRaw = localStorage.getItem(CONFIG_KEY);
        const saved = savedRaw ? normalizeConfig(JSON.parse(savedRaw)) : null;
        if (!saved || saved.inputMode !== normalized.inputMode ||
            saved.distanceUnit !== normalized.distanceUnit ||
            JSON.stringify(saved.enabledInputs) !== JSON.stringify(normalized.enabledInputs)) {
            throw new Error("保存内容の確認に失敗しました。");
        }

        return saved;
    } catch (error) {
        console.error("設定を保存できませんでした。", error);
        throw error;
    }
}

function initializeConfig() {
    try {
        const current = getConfig();
        localStorage.setItem(CONFIG_KEY, JSON.stringify(current));
    } catch (error) {
        console.error("設定の初期化に失敗しました。", error);
    }
}

initializeConfig();
