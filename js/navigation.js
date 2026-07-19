// ============================================
// ScoreCraft
// navigation.js
// 全ページ共通ナビゲーション
// ============================================

const NAVIGATION_ITEMS = [

    {
        id: "home",
        title: "ホーム",
        icon: "🏠",
        page: "index.html"
    },

    {
        id: "round",
        title: "入力",
        icon: "⛳",
        page: "round.html"
    },

    {
        id: "history",
        title: "履歴",
        icon: "📜",
        page: "history.html"
    },

    {
        id: "analysis",
        title: "分析",
        icon: "📊",
        page: "analysis.html"
    },

    {
        id: "settings",
        title: "設定",
        icon: "⚙️",
        page: "settings.html"
    }

];


// ============================================
// ナビゲーション生成
// ============================================

function createNavigation(activePage) {

    const nav = document.createElement("nav");

    nav.className = "bottom-nav";

    NAVIGATION_ITEMS.forEach(item => {

        const link = document.createElement("a");

        link.href = item.page;

        link.className = "nav-item";

        if (item.id === activePage) {

            link.classList.add("active");

        }

        link.innerHTML = `

            <span class="nav-icon">${item.icon}</span>

            <span class="nav-text">${item.title}</span>

        `;

        nav.appendChild(link);

    });

    return nav;

}


// ============================================
// ナビゲーション表示
// ============================================

function renderNavigation(activePage) {

    const container = document.getElementById("navigation");

    if (!container) {

        return;

    }

    container.innerHTML = "";

    container.appendChild(

        createNavigation(activePage)

    );

}

// ============================================
// スマホのソフトキーボード表示への対応
// ============================================
function setupKeyboardAwareNavigation() {
    if (!window.visualViewport) return;

    const updateKeyboardState = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        document.body.classList.toggle("keyboard-visible", keyboardHeight > 160);
    };

    window.visualViewport.addEventListener("resize", updateKeyboardState);
    window.visualViewport.addEventListener("scroll", updateKeyboardState);
    updateKeyboardState();
}

document.addEventListener("DOMContentLoaded", setupKeyboardAwareNavigation);
