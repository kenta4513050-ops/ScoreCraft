// ============================================
// ScoreCraft
// settings.js（保存安定化版）
// ============================================

"use strict";

const INPUT_ITEMS = [
    { key: "score", name: "スコア" },
    { key: "putt", name: "パット数" },
    { key: "greenDistance", name: "グリーン距離" },
    { key: "teeClub", name: "ティーショットクラブ" },
    { key: "direction", name: "方向" },
    { key: "ob", name: "OB" },
    { key: "onePenalty", name: "1ペナ" },
    { key: "bunker", name: "バンカー" },
    { key: "memo", name: "メモ" }
];

let savedCustomInputs = null;

document.addEventListener("DOMContentLoaded", initializeSettings);
window.addEventListener("pageshow", event => {
    if (event.persisted) loadSettings();
});

function initializeSettings() {
    renderNavigation("settings");
    createInputItems();
    loadSettings();

    const saveButton = document.getElementById("saveButton");
    const inputMode = document.getElementById("inputMode");

    if (saveButton) saveButton.addEventListener("click", saveSettings);
    if (inputMode) inputMode.addEventListener("change", changeInputMode);
}

function createInputItems() {
    const container = document.getElementById("customInputs");
    if (!container) return;

    container.innerHTML = "";
    const config = getConfig();
    savedCustomInputs = { ...config.enabledInputs };

    INPUT_ITEMS.forEach(item => {
        const label = document.createElement("label");
        label.className = "setting-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = item.key;
        checkbox.checked = Boolean(config.enabledInputs[item.key]);

        const text = document.createElement("span");
        text.textContent = item.name;

        label.append(checkbox, text);
        container.appendChild(label);
    });
}

function loadSettings() {
    const config = getConfig();
    savedCustomInputs = { ...config.enabledInputs };

    const inputMode = document.getElementById("inputMode");
    const distanceUnit = document.getElementById("distanceUnit");
    if (inputMode) inputMode.value = config.inputMode;
    if (distanceUnit) distanceUnit.value = config.distanceUnit;

    INPUT_ITEMS.forEach(item => {
        const checkbox = document.getElementById(item.key);
        if (checkbox) checkbox.checked = Boolean(config.enabledInputs[item.key]);
    });

    changeInputMode(false);
}

function saveSettings() {
    const button = document.getElementById("saveButton");
    const modeElement = document.getElementById("inputMode");
    const unitElement = document.getElementById("distanceUnit");
    if (!modeElement || !unitElement) return;

    const mode = modeElement.value;
    const current = getConfig();
    const enabledInputs = { ...current.enabledInputs };

    if (mode === INPUT_MODES.CUSTOM) {
        INPUT_ITEMS.forEach(item => {
            const checkbox = document.getElementById(item.key);
            enabledInputs[item.key] = checkbox ? checkbox.checked : false;
        });
        enabledInputs.score = true;
    } else if (mode === INPUT_MODES.SIMPLE) {
        Object.keys(enabledInputs).forEach(key => {
            enabledInputs[key] = key === "score";
        });
    } else {
        enabledInputs.score = true;
        enabledInputs.putt = true;
        enabledInputs.greenDistance = false;
        enabledInputs.teeClub = true;
        enabledInputs.direction = true;
        enabledInputs.ob = true;
        enabledInputs.onePenalty = true;
        enabledInputs.bunker = true;
        enabledInputs.memo = false;
    }

    try {
        if (button) button.disabled = true;
        const saved = saveConfig({
            ...current,
            inputMode: mode,
            distanceUnit: unitElement.value,
            enabledInputs
        });

        savedCustomInputs = { ...saved.enabledInputs };
        loadSettings();
        showMessage("設定を保存しました！");
    } catch (error) {
        showMessage("設定を保存できませんでした。Safariのプライベートブラウズを解除して、もう一度お試しください。", "#c62828");
    } finally {
        if (button) button.disabled = false;
    }
}

function changeInputMode(rememberCurrent = true) {
    const modeElement = document.getElementById("inputMode");
    if (!modeElement) return;
    const mode = modeElement.value;

    // カスタムから別モードへ切り替える前に、現在の選択を一時保持。
    if (rememberCurrent) {
        const anyEnabled = INPUT_ITEMS.some(item => {
            const checkbox = document.getElementById(item.key);
            return checkbox && !checkbox.disabled;
        });
        if (anyEnabled) {
            savedCustomInputs = savedCustomInputs || {};
            INPUT_ITEMS.forEach(item => {
                const checkbox = document.getElementById(item.key);
                if (checkbox) savedCustomInputs[item.key] = checkbox.checked;
            });
        }
    }

    INPUT_ITEMS.forEach(item => {
        const checkbox = document.getElementById(item.key);
        if (!checkbox) return;

        if (mode === INPUT_MODES.SIMPLE) {
            checkbox.checked = item.key === "score";
            checkbox.disabled = true;
        } else if (mode === INPUT_MODES.STANDARD) {
            checkbox.checked = Boolean(DEFAULT_CONFIG.enabledInputs[item.key]);
            checkbox.disabled = true;
        } else {
            checkbox.checked = item.key === "score" ? true : Boolean(savedCustomInputs?.[item.key]);
            checkbox.disabled = item.key === "score";
        }
    });
}
