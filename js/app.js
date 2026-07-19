// ============================================
// ScoreCraft
// app.js
// 共通処理・PWA対応
// ============================================

"use strict";

const APP = {
    name: "ScoreCraft",
    version: "1.1.0",
    slogan: "Record. Analyze. Improve."
};

let deferredInstallPrompt = null;

function initializeApp() {
    console.log(`${APP.name} Ver.${APP.version}`);
    registerServiceWorker();
    initializeInstallUi();
}

function getToday() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `sc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showMessage(message, color = "#2e7d32") {
    const area = document.getElementById("messageArea");
    if (!area) return;

    area.textContent = message;
    area.style.color = color;

    window.setTimeout(() => {
        area.textContent = "";
    }, 2500);
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!location.protocol.startsWith("http")) return;

    navigator.serviceWorker.register("./service-worker.js").catch(error => {
        console.warn("Service Workerを登録できませんでした。", error);
    });
}

function initializeInstallUi() {
    const installButton = document.getElementById("installAppButton");
    const status = document.getElementById("installStatus");
    const instructions = document.getElementById("installInstructions");

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        deferredInstallPrompt = event;

        if (installButton) installButton.hidden = false;
        if (status) status.textContent = "この端末にScoreCraftをインストールできます。";
    });

    if (installButton) {
        installButton.addEventListener("click", installScoreCraft);
    }

    if (isStandaloneMode()) {
        if (status) status.textContent = "ScoreCraftはアプリとして起動しています。";
        if (installButton) installButton.hidden = true;
        return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && instructions) {
        instructions.hidden = false;
        instructions.innerHTML = "Safariの共有ボタンから「ホーム画面に追加」を選択してください。";
        if (status) status.textContent = "iPhone・iPadではSafariからホーム画面へ追加できます。";
    } else if (location.protocol === "file:" && status) {
        status.textContent = "現在はファイルとして開いています。インストール機能はWeb公開後に利用できます。";
        if (instructions) {
            instructions.hidden = false;
            instructions.textContent = "通常の動作確認はこのままで可能です。PWA機能はHTTPSまたはlocalhost環境で有効になります。";
        }
    } else if (status) {
        status.textContent = "ブラウザのメニューからホーム画面へ追加できる場合があります。";
    }

    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        if (installButton) installButton.hidden = true;
        if (status) status.textContent = "ScoreCraftをインストールしました。";
    });
}

async function installScoreCraft() {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;

    const installButton = document.getElementById("installAppButton");
    if (installButton) installButton.hidden = true;
}

function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
}

document.addEventListener("DOMContentLoaded", initializeApp);
