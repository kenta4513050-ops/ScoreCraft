// ============================================
// ScoreCraft
// settings.js
// ============================================

document.addEventListener(

    "DOMContentLoaded",

    initializeSettings

);


//============================================
// 初期化
//============================================

function initializeSettings(){

    renderNavigation("settings");

    createInputItems();

    loadSettings();

    document
        .getElementById("saveButton")
        .addEventListener(
            "click",
            saveSettings
        );

document
    .getElementById("inputMode")
    .addEventListener(
        "change",
        changeInputMode
    );

}

//
// カスタム入力項目
//

const INPUT_ITEMS = [

    {
        key:"score",
        name:"スコア"
    },

    {
        key:"putt",
        name:"パット数"
    },

    {
        key:"greenDistance",
        name:"グリーン距離"
    },

    {
        key:"teeClub",
        name:"ティーショットクラブ"
    },

    {
        key:"direction",
        name:"方向"
    },

    {
        key:"ob",
        name:"OB"
    },

    {
        key:"onePenalty",
        name:"1ペナ"
    },

    {
        key:"bunker",
        name:"バンカー"
    },

    {
        key:"memo",
        name:"メモ"
    }

];

//============================================
// 入力項目一覧生成
//============================================

function createInputItems(){

    const container =
        document.getElementById("customInputs");

    if(!container){

        return;

    }

    container.innerHTML = "";

    const config = getConfig();

    INPUT_ITEMS.forEach(item=>{

        const label =
            document.createElement("label");

        label.className = "setting-item";

        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";

        checkbox.id = item.key;

        checkbox.checked =
            config.enabledInputs[item.key] ?? false;

        const text =
            document.createElement("span");

        text.textContent = item.name;

        label.appendChild(checkbox);

        label.appendChild(text);

        container.appendChild(label);

    });

}

//============================================
// 設定読み込み
//============================================

function loadSettings(){

    const config = getConfig();

    document.getElementById("inputMode").value =
        config.inputMode;

    document.getElementById("distanceUnit").value =
        config.distanceUnit;

    changeInputMode();

}

//============================================
// 設定保存
//============================================

function saveSettings(){

    const config = getConfig();

    config.inputMode =
        document.getElementById("inputMode").value;

    config.distanceUnit =
        document.getElementById("distanceUnit").value;

    INPUT_ITEMS.forEach(item=>{

        config.enabledInputs[item.key] =
            document.getElementById(item.key).checked;

    });

    saveConfig(config);

    changeInputMode();

    showMessage("設定を保存しました！");

}

//============================================
// 入力モード変更
//============================================

function changeInputMode(){

    const mode =
        document.getElementById("inputMode").value;

    INPUT_ITEMS.forEach(item=>{

        const checkbox =
            document.getElementById(item.key);

        if (!checkbox) {

            return;

        }

        switch(mode){

            case INPUT_MODES.SIMPLE:

                checkbox.checked =
                    (item.key === "score");

                checkbox.disabled = true;

                break;

            case INPUT_MODES.STANDARD:

                checkbox.checked =
                    DEFAULT_CONFIG.enabledInputs[item.key];

                checkbox.disabled = true;

                break;

            case INPUT_MODES.CUSTOM:

                checkbox.disabled = false;

                break;

        }

    });

}