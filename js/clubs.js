// ============================================
// ScoreCraft
// clubs.js
// マイクラブ管理
// ============================================

document.addEventListener(

    "DOMContentLoaded",

    initializeClubs

);


//============================================
// 初期化
//============================================

function initializeClubs(){

    renderNavigation("settings");

    createClubList();

    loadMyClubs();

    document

        .getElementById("saveButton")

        .addEventListener(

            "click",

            saveClubs

        );

}

//============================================
// クラブ一覧
//============================================

const CLUBS = [

    {
        category: "ウッド",

        clubs: [

            {
                id: "driver",
                name: "Driver"
            },

            {
                id: "2w",
                name: "2W"
            },

            {
                id: "3w",
                name: "3W"
            },

            {
                id: "5w",
                name: "5W"
            },

            {
                id: "7w",
                name: "7W"
            },

            {
                id: "9w",
                name: "9W"
            }

        ]

    },

    {
        category: "ユーティリティ",

        clubs: [

            {
                id: "2ut",
                name: "2UT"
            },

            {
                id: "3ut",
                name: "3UT"
            },

            {
                id: "4ut",
                name: "4UT"
            },

            {
                id: "5ut",
                name: "5UT"
            },

            {
                id: "6ut",
                name: "6UT"
            }

        ]

    },

    {
        category: "アイアン",

        clubs: [

            {
                id: "3i",
                name: "3I"
            },

            {
                id: "4i",
                name: "4I"
            },

            {
                id: "5i",
                name: "5I"
            },

            {
                id: "6i",
                name: "6I"
            },

            {
                id: "7i",
                name: "7I"
            },

            {
                id: "8i",
                name: "8I"
            },

            {
                id: "9i",
                name: "9I"
            },

            {
                id: "pw",
                name: "PW"
            }

        ]

    },

    {
        category: "ウェッジ",

        clubs: [

            {
                id: "46",
                name: "46°"
            },

            {
                id: "48",
                name: "48°"
            },

            {
                id: "50",
                name: "50°"
            },

            {
                id: "52",
                name: "52°"
            },

            {
                id: "54",
                name: "54°"
            },

            {
                id: "56",
                name: "56°"
            },

            {
                id: "58",
                name: "58°"
            },

            {
                id: "60",
                name: "60°"
            }

        ]

    },

    {
        category: "パター",

        clubs: [

            {
                id: "putter",
                name: "Putter"
            }

        ]

    }

];

//============================================
// クラブ一覧生成
//============================================

function createClubList(){

    const container =
        document.getElementById("clubList");

    if(!container){

        return;

    }

    container.innerHTML = "";

    CLUBS.forEach(group=>{

        // カテゴリタイトル
        const title =
            document.createElement("h3");

        title.className = "club-category";

        title.textContent =
            "🏌️ " + group.category;

        container.appendChild(title);

        // クラブ一覧
        group.clubs.forEach(club=>{

            const label =
                document.createElement("label");

            label.className = "club-item";

            const checkbox =
                document.createElement("input");

            checkbox.type = "checkbox";

            checkbox.id = club.id;

            checkbox.checked = false;

            const text =
                document.createElement("span");

            text.textContent = club.name;

            label.appendChild(checkbox);

            label.appendChild(text);

            container.appendChild(label);

        });

    });

}

//============================================
// 保存
//============================================

function saveClubs(){

    const selected = [];

    CLUBS.forEach(group=>{

        group.clubs.forEach(club=>{

            const checkbox =
                document.getElementById(club.id);

            if(checkbox.checked){

                selected.push(club.id);

            }

        });

    });

    try {

        saveMyClubs(selected);

        const saved = getMyClubs();
        const savedCorrectly =
            Array.isArray(saved) &&
            saved.length === selected.length &&
            selected.every(id => saved.includes(id));

        if (!savedCorrectly) {
            throw new Error("保存内容を確認できませんでした。");
        }

        showMessage("マイクラブを保存しました！");

        window.setTimeout(() => {
            location.href = "settings.html";
        }, 450);

    } catch (error) {

        console.error("マイクラブを保存できませんでした。", error);
        showMessage("マイクラブを保存できませんでした。もう一度お試しください。");

    }

}

//============================================
// マイクラブ読込
//============================================

function loadMyClubs(){

    const selected =
        getMyClubs();

    CLUBS.forEach(group=>{

        group.clubs.forEach(club=>{

            const checkbox =
                document.getElementById(club.id);

            if(checkbox){

                checkbox.checked =
                    selected.includes(club.id)

            }

        });

    });

}