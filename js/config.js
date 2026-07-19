// ============================================
// ScoreCraft
// config.js
// アプリ設定
// ============================================

// 入力モード
const INPUT_MODES = {

    SIMPLE: "simple",

    STANDARD: "standard",

    CUSTOM: "custom"

};


// ============================================
// デフォルト設定
// ============================================

const DEFAULT_CONFIG = {

    // アプリバージョン
    version: 1,

    // 入力モード
    inputMode: INPUT_MODES.STANDARD,

    // グリーン距離単位
    distanceUnit: "step",

    // 入力項目
    enabledInputs: {

        score: true,

        putt: true,

        greenDistance: false,

        teeClub: true,

        direction: true,

        ob: true,

        onePenalty: true,

        bunker: true,

        memo: false

    }

};


// ============================================
// LocalStorageキー
// ============================================

const CONFIG_KEY = "scorecraft_config";


// ============================================
// 設定取得
// ============================================

function getConfig() {

    const data =
        localStorage.getItem(CONFIG_KEY);

    if (!data) {

        return structuredClone(DEFAULT_CONFIG);

    }

    try {

        return JSON.parse(data);

    }

    catch {

        return structuredClone(DEFAULT_CONFIG);

    }

}


// ============================================
// 設定保存
// ============================================

function saveConfig(config) {

    localStorage.setItem(

        CONFIG_KEY,

        JSON.stringify(config)

    );

}


// ============================================
// 初回起動チェック
// ============================================

function initializeConfig() {

    if (!localStorage.getItem(CONFIG_KEY)) {

        saveConfig(

            structuredClone(DEFAULT_CONFIG)

        );

    }

}

initializeConfig();