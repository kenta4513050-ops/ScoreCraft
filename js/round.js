// ============================================
// ScoreCraft
// round.js
// Version 2.1.0
// ゴルフ場検索・PAR自動反映対応
// ============================================

"use strict";


// ============================================
// 定数
// ============================================

const ROUND_DATA_VERSION = 1;

const ROUND_DRAFT_KEY =
    "scorecraft_round_draft";


// クラブIDと表示名の対応表
const CLUB_NAME_MAP = {

    driver: "Driver",

    "2w": "2W",
    "3w": "3W",
    "5w": "5W",
    "7w": "7W",
    "9w": "9W",

    "2ut": "2UT",
    "3ut": "3UT",
    "4ut": "4UT",
    "5ut": "5UT",
    "6ut": "6UT",

    "3i": "3I",
    "4i": "4I",
    "5i": "5I",
    "6i": "6I",
    "7i": "7I",
    "8i": "8I",
    "9i": "9I",

    pw: "PW",

    "46": "46°",
    "48": "48°",
    "50": "50°",
    "52": "52°",
    "54": "54°",
    "56": "56°",
    "58": "58°",
    "60": "60°",

    putter: "Putter"

};


// 入力項目の日本語名
const INPUT_LABELS = {

    score: "スコア",
    putt: "パット数",
    greenDistance: "グリーンオン時の距離",
    teeClub: "ティーショットクラブ",
    direction: "ティーショット着弾方向",
    curve: "ティーショット曲がり方向",
    approachShot: "グリーンを狙ったショット",
    ob: "OB数",
    onePenalty: "1ペナ数",
    bunker: "バンカーに入った回数",
    memo: "メモ"

};


// ============================================
// アプリ状態
// ============================================

const roundState = {

    currentHole: 1,

    round: null,

    config: null,

    selectedClubIds: [],

    courseSearchTimer: null,

    editMode: false,

    originalRoundId: ""

};


// ============================================
// 初期化
// ============================================

document.addEventListener(
    "DOMContentLoaded",
    initializeRound
);


function initializeRound() {

    if (typeof renderNavigation === "function") {

        renderNavigation("round");

    }

    roundState.config =
        getRoundConfig();

    roundState.selectedClubIds =
        getSelectedClubIds();

    const editRound = loadRoundForEditing();

    roundState.round =
        editRound || loadDraftRound() || createNewRound();

    // 新規入力では、設定画面で選択した最新モードを必ず反映する。
    // 既存の下書きが残っていても、入力済みデータは維持したまま表示項目だけ更新する。
    if (!roundState.editMode) {
        roundState.round.inputMode = roundState.config.inputMode;
        roundState.round.distanceUnit = roundState.config.distanceUnit;
        roundState.round.enabledInputs = getInputsForMode(roundState.config.inputMode);
    }

    roundState.currentHole =
        getFirstIncompleteHole();

    normalizeRoundData();

    setRoundInformation();

    bindMainEvents();

    restoreSelectedCourseDisplay();

    applyEditModeDisplay();

    initializeEditModeSelector();

    initializeRoundResetButton();

    renderCurrentHole();

}


function loadRoundForEditing() {

    const roundId =
        new URLSearchParams(location.search).get("edit");

    if (!roundId) {

        return null;

    }

    try {

        const rounds =
            typeof load === "function" &&
            typeof STORAGE !== "undefined" &&
            STORAGE.ROUNDS
                ? load(STORAGE.ROUNDS)
                : JSON.parse(
                    localStorage.getItem("scorecraft_rounds") || "[]"
                );

        const target = Array.isArray(rounds)
            ? rounds.find(round => round && round.id === roundId)
            : null;

        if (!target) {

            window.alert("編集するラウンドが見つかりませんでした。");
            location.href = "history.html";
            return null;

        }

        roundState.editMode = true;
        roundState.originalRoundId = target.id;

        return JSON.parse(JSON.stringify(target));

    }
    catch (error) {

        console.error("編集データを読み込めませんでした。", error);
        window.alert("編集データを読み込めませんでした。");
        location.href = "history.html";
        return null;

    }

}


function applyEditModeDisplay() {

    if (!roundState.editMode) {

        return;

    }

    const headerText = document.querySelector(".app-header p");
    const saveButton = document.getElementById("saveButton");
    const cancelButton = document.getElementById("cancelEditButton");

    if (headerText) {

        headerText.textContent = "ラウンド編集";

    }

    if (saveButton) {

        saveButton.textContent = "変更を保存";

    }

    if (cancelButton) {

        cancelButton.hidden = false;
        cancelButton.addEventListener("click", () => {

            clearDraftRound();
            location.href = `history.html?id=${encodeURIComponent(roundState.originalRoundId)}`;

        });

    }

}


function initializeEditModeSelector() {

    const selector = document.getElementById("editModeSelector");

    if (!selector || !roundState.editMode) {
        return;
    }

    selector.hidden = false;

    selector.querySelectorAll("[data-mode]").forEach(button => {
        button.addEventListener("click", () => {
            changeEditInputMode(button.dataset.mode);
        });
    });

    updateEditModeSelector();

}


function getInputsForMode(mode) {

    if (mode === "simple") {

        return {
            score: true,
            putt: true,
            greenDistance: false,
            shotInfo: false,
            teeClub: false,
            direction: false,
            curve: false,
            approachShot: false,
            ob: false,
            onePenalty: false,
            bunker: false,
            memo: false
        };

    }

    if (mode === "standard") {

        return {
            score: true,
            putt: true,
            greenDistance: false,
            shotInfo: true,
            teeClub: true,
            direction: true,
            curve: true,
            approachShot: true,
            ob: true,
            onePenalty: true,
            bunker: true,
            memo: true
        };

    }

    const custom = roundState.config.enabledInputs || {};

    return {
        score: custom.score ?? true,
        putt: custom.putt ?? true,
        greenDistance: custom.greenDistance ?? false,
        shotInfo: custom.shotInfo ?? true,
        teeClub: custom.teeClub ?? false,
        direction: custom.direction ?? false,
        curve: custom.curve ?? false,
        approachShot: custom.approachShot ?? false,
        ob: custom.ob ?? false,
        onePenalty: custom.onePenalty ?? false,
        bunker: custom.bunker ?? false,
        memo: custom.memo ?? false
    };

}


function changeEditInputMode(mode) {

    if (!roundState.editMode || !["simple", "standard", "custom"].includes(mode)) {
        return;
    }

    roundState.round.inputMode = mode;
    roundState.round.enabledInputs = getInputsForMode(mode);

    updateEditModeSelector();
    renderCurrentHole();
    saveDraftRound();

}


function updateEditModeSelector() {

    const currentMode = roundState.round.inputMode;
    const activeMode = ["simple", "standard", "custom"].includes(currentMode)
        ? currentMode
        : "standard";

    document.querySelectorAll("#editModeSelector [data-mode]").forEach(button => {
        const selected = button.dataset.mode === activeMode;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

}


// ============================================
// ラウンドデータ作成
// ============================================

function createNewRound() {

    const holes = [];

    for (let number = 1; number <= 18; number++) {

        holes.push(
            createEmptyHole(number)
        );

    }

    return {

        version: ROUND_DATA_VERSION,

        id: createSafeId(),

        status: "draft",

        courseId: "",

        courseName: "",

        coursePrefecture: "",

        courseLayoutName: "",

        date: getTodayValue(),

        inputMode:
            roundState.config.inputMode,

        distanceUnit:
            roundState.config.distanceUnit,

        enabledInputs: {
            ...getEnabledInputs()
        },

        currentHole: 1,

        holes: holes,

        out: 0,

        in: 0,

        total: 0,

        outPar: null,

        inPar: null,

        totalPar: null,

        createdAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()

    };

}


function createEmptyHole(number) {

    return {

        hole: number,

        par: null,

        score: null,

        putts: null,

        greenDistance: {

            value: null,

            unit:
                roundState.config
                    ? roundState.config.distanceUnit
                    : "step"

        },

        teeShot: {

            clubId: "",

            direction: "",

            curve: ""

        },

        approachShot: {

            clubId: "",

            distanceYards: null,

            greenOn: null

        },

        shots: Array.from({ length: 5 }, () => ({
            clubId: "",
            targetYards: null,
            landing: "",
            penalty: ""
        })),

        ob: 0,

        onePenalty: 0,

        bunker: 0,

        memo: ""

    };

}


function normalizeRoundData() {

    const round =
        roundState.round;

    round.courseId =
        round.courseId || "";

    round.courseName =
        round.courseName || "";

    round.coursePrefecture =
        round.coursePrefecture || "";

    round.courseLayoutName =
        round.courseLayoutName || "";

    round.outPar =
        round.outPar ?? null;

    round.inPar =
        round.inPar ?? null;

    round.totalPar =
        round.totalPar ?? null;

    if (!round.enabledInputs) {

        round.enabledInputs =
            getEnabledInputs();

    }

    round.holes.forEach(
        (hole, index) => {

            hole.hole =
                Number(hole.hole || index + 1);

            hole.par =
                hole.par === null ||
                hole.par === ""
                    ? null
                    : Number(hole.par);

            hole.score =
                hole.score === null ||
                hole.score === ""
                    ? null
                    : Number(hole.score);

            hole.putts =
                hole.putts === null ||
                hole.putts === ""
                    ? null
                    : Number(hole.putts);

            if (!hole.greenDistance) {

                hole.greenDistance = {
                    value: null,
                    unit: round.distanceUnit
                };

            }

            if (!hole.teeShot) {

                hole.teeShot = {
                    clubId: "",
                    direction: "",
                    curve: ""
                };

            }

            hole.teeShot.curve = hole.teeShot.curve || "";

            if (!hole.approachShot) {
                hole.approachShot = { clubId: "", distanceYards: null, greenOn: null };
            }
            hole.approachShot.clubId = hole.approachShot.clubId || "";
            hole.approachShot.distanceYards = hole.approachShot.distanceYards === null || hole.approachShot.distanceYards === "" ? null : Number(hole.approachShot.distanceYards);
            hole.approachShot.greenOn = typeof hole.approachShot.greenOn === "boolean" ? hole.approachShot.greenOn : null;

            if (!Array.isArray(hole.shots)) hole.shots = [];
            hole.shots = Array.from({ length: 5 }, (_, shotIndex) => {
                const source = hole.shots[shotIndex] || {};
                return {
                    clubId: source.clubId || "",
                    targetYards: source.targetYards === null || source.targetYards === "" || source.targetYards === undefined ? null : Number(source.targetYards),
                    landing: source.landing || "",
                    penalty: source.penalty || ""
                };
            });
            // Ver1.3.20以前のデータは、可能な範囲で1打目/グリーン狙いへ引き継ぐ。
            if (!hole.shots.some(s => s.clubId || s.targetYards !== null || s.landing || s.penalty)) {
                if (hole.teeShot && (hole.teeShot.clubId || hole.teeShot.direction)) {
                    hole.shots[0].clubId = hole.teeShot.clubId || "";
                    hole.shots[0].landing = hole.teeShot.direction || "";
                }
                if (hole.approachShot && (hole.approachShot.clubId || hole.approachShot.distanceYards !== null || hole.approachShot.greenOn !== null)) {
                    const idx = hole.shots[0].clubId ? 1 : 0;
                    hole.shots[idx].clubId = hole.approachShot.clubId || hole.shots[idx].clubId;
                    hole.shots[idx].targetYards = hole.approachShot.distanceYards;
                    if (hole.approachShot.greenOn === true) hole.shots[idx].landing = "green";
                }
            }

            hole.ob =
                Number(hole.ob || 0);

            hole.onePenalty =
                Number(hole.onePenalty || 0);

            hole.bunker =
                Number(hole.bunker || 0);

            hole.memo =
                hole.memo || "";

        }
    );

    calculateTotals();

}


// ============================================
// 設定取得
// ============================================

function getRoundConfig() {

    if (typeof getConfig === "function") {

        const config =
            getConfig();

        if (config) {

            return config;

        }

    }

    return {

        inputMode: "standard",

        distanceUnit: "step",

        enabledInputs: {

            score: true,
            putt: true,
            greenDistance: false,
            shotInfo: true,
            teeClub: true,
            direction: true,
            curve: true,
            approachShot: true,
            ob: true,
            onePenalty: true,
            bunker: true,
            memo: false

        }

    };

}


function getEnabledInputs() {

    const mode = roundState.config.inputMode;
    return getInputsForMode(mode);

}


// ============================================
// ラウンド基本情報
// ============================================

function setRoundInformation() {

    const courseInput =
        document.getElementById("courseName");

    const courseIdInput =
        document.getElementById("courseId");

    const dateInput =
        document.getElementById("roundDate");

    if (courseInput) {

        courseInput.value =
            roundState.round.courseName || "";

    }

    if (courseIdInput) {

        courseIdInput.value =
            roundState.round.courseId || "";

    }

    if (dateInput) {

        dateInput.value =
            roundState.round.date || getTodayValue();

    }

}


function bindMainEvents() {

    const courseSearch =
        document.getElementById("courseSearch");

    const dateInput =
        document.getElementById("roundDate");

    const clearCourseButton =
        document.getElementById("clearCourseButton");

    const prevButton =
        document.getElementById("prevHole");

    const nextButton =
        document.getElementById("nextHole");

    const saveButton =
        document.getElementById("saveButton");


    if (courseSearch) {

        courseSearch.addEventListener(
            "input",
            handleCourseSearchInput
        );

        courseSearch.addEventListener(
            "focus",
            handleCourseSearchFocus
        );

        courseSearch.addEventListener(
            "keydown",
            handleCourseSearchKeydown
        );

    }


    if (dateInput) {

        dateInput.addEventListener(
            "change",
            handleRoundInfoChange
        );

    }


    if (clearCourseButton) {

        clearCourseButton.addEventListener(
            "click",
            clearSelectedCourse
        );

    }


    if (prevButton) {

        prevButton.addEventListener(
            "click",
            goToPreviousHole
        );

    }


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            goToNextHole
        );

    }


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            finishRound
        );

    }


    document.addEventListener(
        "click",
        handleDocumentClick
    );

}


function handleRoundInfoChange() {

    const dateInput =
        document.getElementById("roundDate");

    if (dateInput) {

        roundState.round.date =
            dateInput.value;

    }

    saveDraftRound();

}


// ============================================
// ゴルフ場検索
// ============================================

function handleCourseSearchInput(event) {

    const keyword =
        event.target.value.trim();

    window.clearTimeout(
        roundState.courseSearchTimer
    );

    roundState.courseSearchTimer =
        window.setTimeout(
            () => {

                renderCourseSearchResults(
                    keyword
                );

            },
            120
        );

}


function handleCourseSearchFocus(event) {

    renderCourseSearchResults(
        event.target.value.trim()
    );

}


function handleCourseSearchKeydown(event) {

    if (event.key === "Escape") {

        hideCourseSearchResults();

        event.target.blur();

    }

}


function handleDocumentClick(event) {

    const searchInput =
        document.getElementById("courseSearch");

    const resultsArea =
        document.getElementById(
            "courseSearchResults"
        );

    if (
        !searchInput ||
        !resultsArea
    ) {

        return;

    }

    const clickedInside =
        searchInput.contains(event.target) ||
        resultsArea.contains(event.target);

    if (!clickedInside) {

        hideCourseSearchResults();

    }

}


function renderCourseSearchResults(keyword) {

    const resultsArea =
        document.getElementById(
            "courseSearchResults"
        );

    if (!resultsArea) {

        return;

    }

    if (
        typeof searchCourses !== "function"
    ) {

        resultsArea.innerHTML = "";

        const errorMessage =
            document.createElement("p");

        errorMessage.className =
            "course-search-empty";

        errorMessage.textContent =
            "ゴルフ場データを読み込めませんでした。";

        resultsArea.appendChild(
            errorMessage
        );

        resultsArea.hidden = false;

        return;

    }

    const courses =
        searchCourses(keyword);

    resultsArea.innerHTML = "";

    if (courses.length === 0) {

        const emptyMessage =
            document.createElement("p");

        emptyMessage.className =
            "course-search-empty";

        emptyMessage.textContent =
            "一致するゴルフ場がありません。";

        resultsArea.appendChild(
            emptyMessage
        );

        resultsArea.hidden = false;

        return;

    }

    courses.forEach(
        course => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "course-search-result-button";

            const name =
                document.createElement("strong");

            name.textContent =
                course.name;

            const details =
                document.createElement("span");

            details.textContent =
                createCourseDetailsText(
                    course
                );

            button.appendChild(name);

            button.appendChild(details);

            button.addEventListener(
                "click",
                () => {

                    selectCourse(
                        course.id
                    );

                }
            );

            resultsArea.appendChild(
                button
            );

        }
    );

    resultsArea.hidden = false;

}


function hideCourseSearchResults() {

    const resultsArea =
        document.getElementById(
            "courseSearchResults"
        );

    if (resultsArea) {

        resultsArea.hidden = true;

    }

}


function selectCourse(courseId) {

    if (
        typeof getCourseById !== "function"
    ) {

        showRoundMessage(
            "ゴルフ場データを読み込めませんでした。",
            true
        );

        return;

    }

    const course =
        getCourseById(courseId);

    if (!course) {

        showRoundMessage(
            "選択したゴルフ場が見つかりません。",
            true
        );

        return;

    }

    roundState.round.courseId =
        course.id;

    roundState.round.courseName =
        course.name;

    roundState.round.coursePrefecture =
        course.prefecture || "";

    roundState.round.courseLayoutName =
        course.courseName || "";

    applyCoursePars(course);

    updateCourseHiddenInputs();

    renderSelectedCourse(course);

    renderCourseParSummary(course);

    clearCourseSearchBox();

    hideCourseSearchResults();

    renderCurrentHole();

    saveDraftRound();

    showRoundMessage(
        "ゴルフ場と18ホールのPARを設定しました。"
    );

}


function applyCoursePars(course) {

    roundState.round.holes.forEach(
        hole => {

            const courseHole =
                course.holes.find(
                    item =>
                        Number(item.hole) ===
                        Number(hole.hole)
                );

            hole.par =
                courseHole
                    ? Number(courseHole.par)
                    : null;

            if (
                hole.teeShot.direction &&
                !isValidDirectionForPar(
                    hole.teeShot.direction,
                    hole.par
                )
            ) {

                hole.teeShot.direction = "";

            }

        }
    );

    roundState.round.outPar =
        getCourseParValue(
            course,
            1,
            9
        );

    roundState.round.inPar =
        getCourseParValue(
            course,
            10,
            18
        );

    roundState.round.totalPar =
        roundState.round.outPar +
        roundState.round.inPar;

}


function getCourseParValue(
    course,
    startHole,
    endHole
) {

    return course.holes

        .filter(
            hole =>
                Number(hole.hole) >= startHole &&
                Number(hole.hole) <= endHole
        )

        .reduce(
            (total, hole) =>
                total + Number(hole.par || 0),
            0
        );

}


function isValidDirectionForPar(
    direction,
    par
) {

    const validValues =
        getDirectionOptions(par)
            .map(
                option => option.value
            );

    return validValues.includes(
        direction
    );

}


function clearSelectedCourse() {

    const hasCourse =
        Boolean(
            roundState.round.courseId ||
            roundState.round.courseName
        );

    if (!hasCourse) {

        focusCourseSearch();

        return;

    }

    const shouldClear =
        window.confirm(
            "ゴルフ場の選択を解除しますか？\n入力済みのPARは未設定に戻ります。"
        );

    if (!shouldClear) {

        return;

    }

    roundState.round.courseId = "";

    roundState.round.courseName = "";

    roundState.round.coursePrefecture = "";

    roundState.round.courseLayoutName = "";

    roundState.round.outPar = null;

    roundState.round.inPar = null;

    roundState.round.totalPar = null;

    roundState.round.holes.forEach(
        hole => {

            hole.par = null;

            hole.teeShot.direction = "";

        }
    );

    updateCourseHiddenInputs();

    hideSelectedCourse();

    hideCourseParSummary();

    clearCourseSearchBox();

    renderCurrentHole();

    saveDraftRound();

    focusCourseSearch();

    showRoundMessage(
        "ゴルフ場の選択を解除しました。"
    );

}


function restoreSelectedCourseDisplay() {

    const courseId =
        roundState.round.courseId;

    if (
        courseId &&
        typeof getCourseById === "function"
    ) {

        const course =
            getCourseById(courseId);

        if (course) {

            renderSelectedCourse(course);

            renderCourseParSummary(course);

            updateCourseHiddenInputs();

            return;

        }

    }

    if (roundState.round.courseName) {

        const fallbackCourse = {

            name:
                roundState.round.courseName,

            prefecture:
                roundState.round.coursePrefecture,

            courseName:
                roundState.round.courseLayoutName

        };

        renderSelectedCourse(
            fallbackCourse
        );

        renderStoredParSummary();

        updateCourseHiddenInputs();

        return;

    }

    hideSelectedCourse();

    hideCourseParSummary();

}


function renderSelectedCourse(course) {

    const area =
        document.getElementById(
            "selectedCourseArea"
        );

    const name =
        document.getElementById(
            "selectedCourseName"
        );

    const details =
        document.getElementById(
            "selectedCourseDetails"
        );

    if (
        !area ||
        !name ||
        !details
    ) {

        return;

    }

    name.textContent =
        course.name || "未選択";

    details.textContent =
        createCourseDetailsText(
            course
        );

    area.hidden = false;

    const infoCard = document.querySelector(".round-info-card");
    if (infoCard) infoCard.classList.add("course-selected");

}


function hideSelectedCourse() {

    const area =
        document.getElementById(
            "selectedCourseArea"
        );

    if (area) {

        area.hidden = true;

    }

    const infoCard = document.querySelector(".round-info-card");
    if (infoCard) infoCard.classList.remove("course-selected");

}


function createCourseDetailsText(course) {

    return [
        course.prefecture || "",
        course.courseName || ""
    ]
        .filter(Boolean)
        .join(" / ");

}


function renderCourseParSummary(course) {

    const outPar =
        typeof getCourseOutPar === "function" &&
        course.id
            ? getCourseOutPar(course.id)
            : getCourseParValue(course, 1, 9);

    const inPar =
        typeof getCourseInPar === "function" &&
        course.id
            ? getCourseInPar(course.id)
            : getCourseParValue(course, 10, 18);

    const totalPar =
        typeof getCourseTotalPar === "function" &&
        course.id
            ? getCourseTotalPar(course.id)
            : outPar + inPar;

    roundState.round.outPar =
        outPar;

    roundState.round.inPar =
        inPar;

    roundState.round.totalPar =
        totalPar;

    updateParSummaryElements(
        outPar,
        inPar,
        totalPar
    );

}


function renderStoredParSummary() {

    updateParSummaryElements(
        roundState.round.outPar,
        roundState.round.inPar,
        roundState.round.totalPar
    );

}


function updateParSummaryElements(
    outPar,
    inPar,
    totalPar
) {

    const summary =
        document.getElementById(
            "courseParSummary"
        );

    const outElement =
        document.getElementById(
            "courseOutPar"
        );

    const inElement =
        document.getElementById(
            "courseInPar"
        );

    const totalElement =
        document.getElementById(
            "courseTotalPar"
        );

    const outScoreElement = document.getElementById("courseOutScore");
    const inScoreElement = document.getElementById("courseInScore");
    const totalScoreElement = document.getElementById("courseTotalScore");
    const outPuttsElement = document.getElementById("courseOutPutts");
    const inPuttsElement = document.getElementById("courseInPutts");
    const totalPuttsElement = document.getElementById("courseTotalPutts");

    if (
        !summary ||
        !outElement ||
        !inElement ||
        !totalElement
    ) {

        return;

    }

    outElement.textContent =
        outPar ?? "-";

    inElement.textContent =
        inPar ?? "-";

    totalElement.textContent =
        totalPar ?? "-";

    const holes = Array.isArray(roundState?.round?.holes) ? roundState.round.holes : [];
    const aggregateRange = (start, end, key) => {
        const values = holes
            .filter(hole => Number(hole?.hole) >= start && Number(hole?.hole) <= end)
            .map(hole => hole?.[key])
            .filter(value => value !== null && value !== "" && Number.isFinite(Number(value)));
        return values.length ? values.reduce((sum, value) => sum + Number(value), 0) : null;
    };
    const outScore = aggregateRange(1, 9, "score");
    const inScore = aggregateRange(10, 18, "score");
    const outPutts = aggregateRange(1, 9, "putts");
    const inPutts = aggregateRange(10, 18, "putts");
    const totalScore = outScore === null && inScore === null ? null : (outScore || 0) + (inScore || 0);
    const totalPutts = outPutts === null && inPutts === null ? null : (outPutts || 0) + (inPutts || 0);

    if (outScoreElement) outScoreElement.textContent = outScore ?? "-";
    if (inScoreElement) inScoreElement.textContent = inScore ?? "-";
    if (totalScoreElement) totalScoreElement.textContent = totalScore ?? "-";
    if (outPuttsElement) outPuttsElement.textContent = outPutts ?? "-";
    if (inPuttsElement) inPuttsElement.textContent = inPutts ?? "-";
    if (totalPuttsElement) totalPuttsElement.textContent = totalPutts ?? "-";

    summary.hidden =
        outPar === null &&
        inPar === null &&
        totalPar === null;

}


function hideCourseParSummary() {

    const summary =
        document.getElementById(
            "courseParSummary"
        );

    if (summary) {

        summary.hidden = true;

    }

}


function updateCourseHiddenInputs() {

    const courseNameInput =
        document.getElementById(
            "courseName"
        );

    const courseIdInput =
        document.getElementById(
            "courseId"
        );

    if (courseNameInput) {

        courseNameInput.value =
            roundState.round.courseName;

    }

    if (courseIdInput) {

        courseIdInput.value =
            roundState.round.courseId;

    }

}


function clearCourseSearchBox() {

    const search =
        document.getElementById(
            "courseSearch"
        );

    if (search) {

        search.value = "";

    }

}


function focusCourseSearch() {

    const search =
        document.getElementById(
            "courseSearch"
        );

    if (search) {

        search.focus();

        renderCourseSearchResults(
            search.value.trim()
        );

    }

}


// ============================================
// ホール表示
// ============================================

function renderCurrentHole() {

    const hole =
        getCurrentHoleData();

    renderHoleHeader(hole);

    renderInputArea(hole);

    updateNavigationButtons();

    roundState.round.currentHole =
        roundState.currentHole;

    saveDraftRound();

}


function renderHoleHeader(hole) {

    const holeTitle =
        document.getElementById("holeTitle");

    const holePar =
        document.getElementById("holePar");

    if (holeTitle) {

        holeTitle.textContent =
            `Hole ${hole.hole} / 18`;

    }

    if (holePar) {

        holePar.textContent =
            hole.par
                ? `Par ${hole.par}`
                : "Par -";

    }

}


function renderInputArea(hole) {

    const area = document.getElementById("inputArea");
    if (!area) return;

    area.innerHTML = "";
    area.className = "compact-hole-input";

    const enabled = roundState.round.enabledInputs;

    // 主要数値は最上段にまとめる。
    const primary = document.createElement("div");
    primary.className = "compact-primary-grid";
    primary.appendChild(createCompactParInput(hole));
    if (enabled.score) {
        primary.appendChild(createCompactNumberControl("score", "SCORE", hole.score, 1, 20));
    }
    if (enabled.putt) {
        primary.appendChild(createCompactNumberControl("putts", "PUTT", hole.putts, 0, 10));
    }
    area.appendChild(primary);

    // 1打目〜5打目のショット情報。
    if (enabled.shotInfo !== false) area.appendChild(createCompactShotsSection(hole));

    // パット距離は従来どおり残す。
    if (enabled.greenDistance) {
        area.appendChild(createCompactPuttingSection(hole));
    }

    if (enabled.memo) {
        area.appendChild(createCompactMemoInput(hole));
    }

    area.appendChild(createHoleProgress());
}

function createCompactParInput(hole) {
    const item = document.createElement("div");
    item.className = "compact-field compact-par-field";
    const label = createLabel("PAR");
    const select = document.createElement("select");
    select.id = "parInput";
    [{v:"",t:"-"},{v:"3",t:"3"},{v:"4",t:"4"},{v:"5",t:"5"},{v:"6",t:"6"}].forEach(x=>{
        const o=document.createElement("option"); o.value=x.v; o.textContent=x.t; select.appendChild(o);
    });
    select.value = hole.par ? String(hole.par) : "";
    select.addEventListener("change", event => {
        hole.par = event.target.value ? Number(event.target.value) : null;
        hole.teeShot.direction = "";
        recalculateStoredParSummary();
        calculateTotals();
        renderCurrentHole();
    });
    item.append(label, select);
    return item;
}

function createCompactNumberControl(field, labelText, value, min, max) {
    const item = document.createElement("div");
    item.className = "compact-field compact-step-field";
    item.appendChild(createLabel(labelText));
    const control = document.createElement("div");
    control.className = "compact-stepper";
    const minus = document.createElement("button"); minus.type="button"; minus.textContent="−"; minus.setAttribute("aria-label", `${labelText}を減らす`);
    const input = document.createElement("input"); input.type="number"; input.inputMode="numeric"; input.min=String(min); input.max=String(max); input.value=value??""; input.placeholder="-"; input.setAttribute("aria-label", labelText);
    const plus = document.createElement("button"); plus.type="button"; plus.textContent="＋"; plus.setAttribute("aria-label", `${labelText}を増やす`);
    const commit = next => {
        const hole = getCurrentHoleData();
        const val = next === null ? null : Math.max(min, Math.min(max, Number(next)));
        hole[field] = val;
        input.value = val ?? "";
        calculateTotals();
        saveDraftRound();
    };
    minus.addEventListener("click", ()=>commit(input.value==="" ? min : Number(input.value)-1));
    plus.addEventListener("click", ()=>commit(input.value==="" ? min : Number(input.value)+1));
    input.addEventListener("input", e=>{
        const hole=getCurrentHoleData();
        hole[field]=e.target.value===""?null:Number(e.target.value);
        calculateTotals(); saveDraftRound();
    });
    control.append(minus,input,plus); item.appendChild(control); return item;
}

function createCompactSection(title, className="") {
    const section=document.createElement("section");
    section.className=`compact-input-section ${className}`.trim();
    const heading=document.createElement("div"); heading.className="compact-section-title"; heading.textContent=title;
    section.appendChild(heading); return section;
}

function createCompactClubField(hole, target="tee") {
    const field=document.createElement("div"); field.className="compact-field";
    field.appendChild(createLabel(target==="tee"?"Club":"Club"));
    const select=document.createElement("select");
    const empty=document.createElement("option"); empty.value=""; empty.textContent=roundState.selectedClubIds.length?"-":"未登録"; select.appendChild(empty);
    roundState.selectedClubIds.filter(id=>target==="tee" || normalizeClubId(id)!=="putter").forEach(clubId=>{
        const o=document.createElement("option"); o.value=normalizeClubId(clubId); o.textContent=getClubDisplayName(clubId); select.appendChild(o);
    });
    const source=target==="tee"?hole.teeShot:hole.approachShot;
    select.value=normalizeClubId(source.clubId||"");
    select.addEventListener("change",e=>{source.clubId=e.target.value;saveDraftRound();});
    field.appendChild(select); return field;
}

function directionDisplay(hole) {
    const value=hole.teeShot.direction||"";
    const map={left:"←",right:"→",short:"手前",over:"奥",fairway:"FW",green:"1on"};
    return map[value]||"●";
}

function curveDisplay(hole) {
    const map={left:"←",straight:"─",right:"→"};
    return map[hole.teeShot.curve||""]||"─";
}

function markFlickGuideSeen() {
    try { localStorage.setItem("scorecraft_flick_guide_seen","1"); } catch (_) {}
    document.querySelectorAll(".flick-first-guide").forEach(el=>el.remove());
}

function removeFlickRadialGuide() {
    document.querySelectorAll(".flick-radial-layer").forEach(el=>el.remove());
}

function createFlickRadialGuide(button, options, centerLabel) {
    removeFlickRadialGuide();
    const layer=document.createElement("div");
    layer.className="flick-radial-layer";
    const menu=document.createElement("div");
    menu.className="flick-radial-menu";

    const rect=button.getBoundingClientRect();
    const radius=58;
    const horizontalPad=92;
    const verticalPad=88;
    const x=Math.max(horizontalPad,Math.min(window.innerWidth-horizontalPad,rect.left+rect.width/2));
    const y=Math.max(verticalPad,Math.min(window.innerHeight-verticalPad,rect.top+rect.height/2));
    menu.style.left=`${x}px`;
    menu.style.top=`${y}px`;

    const entries={...options,center:{label:centerLabel}};
    Object.entries(entries).forEach(([direction,item])=>{
        if(!item)return;
        const chip=document.createElement("div");
        chip.className=`flick-radial-option flick-${direction}`;
        chip.dataset.direction=direction;
        chip.textContent=item.label;
        menu.appendChild(chip);
    });
    layer.appendChild(menu);
    document.body.appendChild(layer);
    return {layer,menu,x,y,radius};
}

function setFlickRadialSelection(guide, direction) {
    if(!guide)return;
    guide.menu.querySelectorAll(".flick-radial-option").forEach(el=>{
        el.classList.toggle("active",el.dataset.direction===direction);
    });
}

function attachFlickGesture(button, handlers, guideConfig={}) {
    let sx=0, sy=0, active=false, guide=null, longPressTimer=null, longPressed=false, current="center";
    const threshold=24;
    const longPressMs=320;
    button.style.touchAction="none";

    const determineDirection=(dx,dy)=>{
        if(Math.max(Math.abs(dx),Math.abs(dy))<threshold)return "center";
        if(Math.abs(dx)>=Math.abs(dy))return dx<0?"left":"right";
        return dy<0?"up":"down";
    };

    const showGuide=()=>{
        if(!active)return;
        longPressed=true;
        guide=createFlickRadialGuide(button,guideConfig.options||{},guideConfig.centerLabel||"中央");
        setFlickRadialSelection(guide,"center");
        button.classList.add("flick-longpress");
        if(navigator.vibrate) { try{navigator.vibrate(18);}catch(_){} }
    };

    const cleanup=()=>{
        clearTimeout(longPressTimer);
        button.classList.remove("flick-active","flick-longpress");
        removeFlickRadialGuide();
        guide=null;
    };

    button.addEventListener("pointerdown", event=>{
        active=true; longPressed=false; current="center"; sx=event.clientX; sy=event.clientY;
        button.classList.add("flick-active");
        try{button.setPointerCapture(event.pointerId);}catch(_){}
        longPressTimer=setTimeout(showGuide,longPressMs);
        event.preventDefault();
    });
    button.addEventListener("pointermove",event=>{
        if(!active)return;
        const direction=determineDirection(event.clientX-sx,event.clientY-sy);
        if(longPressed && direction!==current){
            current=direction;
            setFlickRadialSelection(guide,current);
        }
        event.preventDefault();
    });
    button.addEventListener("pointerup", event=>{
        if(!active)return;
        active=false;
        clearTimeout(longPressTimer);
        const dx=event.clientX-sx, dy=event.clientY-sy;
        const direction=determineDirection(dx,dy);
        const action=direction==="center"?"tap":direction;
        cleanup();
        if(typeof handlers[action]==="function") handlers[action]();
        markFlickGuideSeen();
        event.preventDefault();
    });
    button.addEventListener("pointercancel",()=>{active=false;cleanup();});
    button.addEventListener("click",event=>event.preventDefault());
}

function createDirectionFlickField(hole) {
    const field=document.createElement("div"); field.className="compact-field flick-field"; field.appendChild(createLabel("着弾"));
    const button=document.createElement("button"); button.type="button"; button.className="flick-control direction-flick"; button.textContent=directionDisplay(hole); button.setAttribute("aria-label","着弾方向。長押しすると方向候補を表示し、候補方向へフリックして選択");
    if(hole.teeShot.direction)button.classList.add("selected");
    const centerLabel=Number(hole.par)===3?"1on":"FW";
    const center=()=>{hole.teeShot.direction=Number(hole.par)===3?"green":"fairway";saveDraftRound();renderCurrentHole();};
    attachFlickGesture(button,{
        tap:center,
        left:()=>{hole.teeShot.direction="left";saveDraftRound();renderCurrentHole();},
        right:()=>{hole.teeShot.direction="right";saveDraftRound();renderCurrentHole();},
        up:()=>{hole.teeShot.direction="over";saveDraftRound();renderCurrentHole();},
        down:()=>{hole.teeShot.direction="short";saveDraftRound();renderCurrentHole();}
    },{
        centerLabel,
        options:{left:{label:"←"},right:{label:"→"},up:{label:"奥"},down:{label:"手前"}}
    });
    field.appendChild(button); return field;
}

function createCurveFlickField(hole) {
    const field=document.createElement("div"); field.className="compact-field flick-field"; field.appendChild(createLabel("曲がり"));
    const button=document.createElement("button"); button.type="button"; button.className="flick-control curve-flick"; button.textContent=curveDisplay(hole); button.setAttribute("aria-label","球筋。長押しすると左右とまっすぐの候補を表示し、候補方向へフリックして選択");
    if(hole.teeShot.curve)button.classList.add("selected");
    attachFlickGesture(button,{
        tap:()=>{hole.teeShot.curve="straight";saveDraftRound();renderCurrentHole();},
        left:()=>{hole.teeShot.curve="left";saveDraftRound();renderCurrentHole();},
        right:()=>{hole.teeShot.curve="right";saveDraftRound();renderCurrentHole();}
    },{
        centerLabel:"直",
        options:{left:{label:"←"},right:{label:"→"}}
    });
    field.appendChild(button); return field;
}

function ensureFiveShots(hole) {
    if (!Array.isArray(hole.shots)) hole.shots = [];
    while (hole.shots.length < 5) hole.shots.push({ clubId:"", targetYards:null, landing:"", penalty:"" });
    hole.shots = hole.shots.slice(0,5);
    return hole.shots;
}

function shotLandingDisplay(value) {
    return ({left:"←", fairway:"・", green:"・", right:"→", over:"↑", short:"↓"})[value] || "・";
}

function shotPenaltyDisplay(value) {
    return ({ob:"OB", onePenalty:"1P", bunker:"砂", woods:"林"})[value] || "—";
}

function syncLegacyFieldsFromShots(hole) {
    const shots=ensureFiveShots(hole);
    const first=shots[0]||{};
    hole.teeShot=hole.teeShot||{clubId:"",direction:"",curve:""};
    hole.teeShot.clubId=first.clubId||"";
    hole.teeShot.direction=first.landing||"";
    const greenShot=shots.find(s=>s.landing==="green") || shots.find((s,i)=>i>0 && (s.clubId || s.targetYards!==null));
    hole.approachShot=hole.approachShot||{clubId:"",distanceYards:null,greenOn:null};
    if(greenShot){
        hole.approachShot.clubId=greenShot.clubId||"";
        hole.approachShot.distanceYards=greenShot.targetYards;
        hole.approachShot.greenOn=greenShot.landing==="green" ? true : null;
    } else {
        hole.approachShot.clubId=""; hole.approachShot.distanceYards=null; hole.approachShot.greenOn=null;
    }
    hole.ob=shots.filter(s=>s.penalty==="ob").length;
    hole.onePenalty=shots.filter(s=>s.penalty==="onePenalty").length;
    hole.bunker=shots.filter(s=>s.penalty==="bunker").length;
}

function createShotLandingFlickField(hole, shot) {
    const field=document.createElement("div"); field.className="shot-cell shot-flick-cell";
    const button=document.createElement("button"); button.type="button"; button.className="flick-control shot-flick-control";
    button.textContent=shotLandingDisplay(shot.landing);
    if(shot.landing) button.classList.add("selected");
    const center=()=>{shot.landing=(shot.targetYards!==null && shot.targetYards<=250)?"green":"fairway";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();};
    attachFlickGesture(button,{
        tap:center,
        left:()=>{shot.landing="left";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();},
        right:()=>{shot.landing="right";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();},
        up:()=>{shot.landing="over";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();},
        down:()=>{shot.landing="short";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();}
    },{centerLabel:"・",options:{left:{label:"←"},right:{label:"→"},up:{label:"↑"},down:{label:"↓"}}});
    field.appendChild(button); return field;
}

function createShotPenaltyFlickField(hole, shot) {
    const field=document.createElement("div"); field.className="shot-cell shot-flick-cell";
    const button=document.createElement("button"); button.type="button"; button.className="flick-control shot-flick-control penalty-flick";
    button.textContent=shotPenaltyDisplay(shot.penalty);
    if(shot.penalty) button.classList.add("selected");
    attachFlickGesture(button,{
        tap:()=>{shot.penalty="";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();},
        up:()=>{shot.penalty="ob";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();},
        right:()=>{shot.penalty="onePenalty";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();},
        down:()=>{shot.penalty="bunker";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();},
        left:()=>{shot.penalty="woods";syncLegacyFieldsFromShots(hole);saveDraftRound();renderCurrentHole();}
    },{centerLabel:"なし",options:{up:{label:"OB"},right:{label:"1P"},down:{label:"砂"},left:{label:"林"}}});
    field.appendChild(button); return field;
}

function createCompactShotsSection(hole) {
    const shots=ensureFiveShots(hole);
    const section=createCompactSection("SHOT","compact-shots-section");
    const header=document.createElement("div"); header.className="shot-grid shot-grid-header";
    ["打","Club","狙いyd","着弾","Penalty"].forEach(t=>{const el=document.createElement("span");el.textContent=t;header.appendChild(el);});
    section.appendChild(header);
    shots.forEach((shot,index)=>{
        const row=document.createElement("div"); row.className="shot-grid shot-grid-row";
        const num=document.createElement("strong"); num.className="shot-number"; num.textContent=String(index+1); row.appendChild(num);
        const club=document.createElement("select"); club.className="shot-club";
        const empty=document.createElement("option");empty.value="";empty.textContent="-";club.appendChild(empty);
        roundState.selectedClubIds.filter(id=>normalizeClubId(id)!=="putter").forEach(clubId=>{const o=document.createElement("option");o.value=normalizeClubId(clubId);o.textContent=getClubDisplayName(clubId);club.appendChild(o);});
        club.value=normalizeClubId(shot.clubId||"");
        club.addEventListener("change",e=>{shot.clubId=e.target.value;syncLegacyFieldsFromShots(hole);saveDraftRound();}); row.appendChild(club);
        const yards=document.createElement("input"); yards.className="shot-yards"; yards.type="number"; yards.inputMode="numeric"; yards.min="0"; yards.max="999"; yards.step="1"; yards.placeholder="-"; yards.value=shot.targetYards??"";
        yards.addEventListener("input",e=>{shot.targetYards=e.target.value===""?null:Number(e.target.value);syncLegacyFieldsFromShots(hole);saveDraftRound();}); row.appendChild(yards);
        row.appendChild(createShotLandingFlickField(hole,shot));
        row.appendChild(createShotPenaltyFlickField(hole,shot));
        section.appendChild(row);
    });
    const guide=document.createElement("div");guide.className="shot-flick-hint";guide.textContent="長押し→方向へフリック　着弾：← ・ → ↑ ↓　Penalty：←林 ↑OB →1P ↓砂";section.appendChild(guide);
    return section;
}

function createCompactTeeSection(hole, enabled) {
    const section=createCompactSection("TEE","compact-tee-section");
    const row=document.createElement("div"); row.className="compact-three-grid";
    if(enabled.teeClub) row.appendChild(createCompactClubField(hole,"tee"));
    if(enabled.direction) row.appendChild(createDirectionFlickField(hole));
    if(enabled.curve) row.appendChild(createCurveFlickField(hole));
    section.appendChild(row);
    let seen=true; try{seen=localStorage.getItem("scorecraft_flick_guide_seen")==="1";}catch(_){}
    if(!seen && (enabled.direction||enabled.curve)){
        const guide=document.createElement("div"); guide.className="flick-first-guide";
        guide.textContent="長押しで候補表示 → 選びたい方向へフリックして離す（短いタップは中央 / 直）";
        section.appendChild(guide);
    }
    return section;
}

function createCompactApproachSection(hole) {
    if(!hole.approachShot) hole.approachShot={clubId:"",distanceYards:null,greenOn:null};
    const section=createCompactSection("GREEN","compact-green-section");
    const row=document.createElement("div"); row.className="compact-three-grid";
    row.appendChild(createCompactClubField(hole,"approach"));
    const distanceField=document.createElement("div"); distanceField.className="compact-field"; distanceField.appendChild(createLabel("残りyd"));
    const distance=document.createElement("input"); distance.type="number"; distance.inputMode="numeric"; distance.min="0"; distance.max="500"; distance.step="1"; distance.placeholder="-"; distance.value=hole.approachShot.distanceYards??"";
    distance.addEventListener("input",e=>{hole.approachShot.distanceYards=e.target.value===""?null:Number(e.target.value);saveDraftRound();}); distanceField.appendChild(distance); row.appendChild(distanceField);
    const girField=document.createElement("div"); girField.className="compact-field"; girField.appendChild(createLabel("GIR"));
    const gir=document.createElement("button"); gir.type="button"; gir.className="compact-gir-button";
    const update=()=>{gir.textContent=hole.approachShot.greenOn===true?"ON":hole.approachShot.greenOn===false?"MISS":"—";gir.classList.toggle("selected",hole.approachShot.greenOn===true);gir.classList.toggle("miss",hole.approachShot.greenOn===false);}; update();
    gir.addEventListener("click",()=>{hole.approachShot.greenOn=hole.approachShot.greenOn===null?true:hole.approachShot.greenOn===true?false:null;saveDraftRound();update();}); girField.appendChild(gir); row.appendChild(girField);
    section.appendChild(row); return section;
}

function createCompactPuttingSection(hole) {
    const section=createCompactSection("PUTTING","compact-putting-section");
    const row=document.createElement("div"); row.className="compact-two-grid";
    const field=document.createElement("div"); field.className="compact-field";
    const unit=roundState.round.distanceUnit, unitLabel=unit==="yard"?"yd":"歩"; field.appendChild(createLabel(`1st距離 (${unitLabel})`));
    const input=document.createElement("input"); input.type="number"; input.inputMode="decimal"; input.min="0"; input.step=unit==="yard"?"0.1":"1"; input.placeholder="-"; input.value=hole.greenDistance.value??"";
    input.addEventListener("input",e=>{hole.greenDistance.value=e.target.value===""?null:Number(e.target.value);hole.greenDistance.unit=unit;saveDraftRound();}); field.appendChild(input); row.appendChild(field); section.appendChild(row); return section;
}

function createCompactPenaltyArea(hole) {
    const section=createCompactSection("OTHER","compact-other-section");
    const row=document.createElement("div"); row.className="compact-penalty-grid";
    const enabled=roundState.round.enabledInputs;
    if(enabled.ob) row.appendChild(createCompactCounter("OB",hole.ob,v=>hole.ob=v));
    if(enabled.onePenalty) row.appendChild(createCompactCounter("1ペナ",hole.onePenalty,v=>hole.onePenalty=v));
    if(enabled.bunker) row.appendChild(createCompactCounter("Bunker",hole.bunker,v=>hole.bunker=v));
    section.appendChild(row); return section;
}

function createCompactCounter(labelText,currentValue,onChange){
    const item=document.createElement("div"); item.className="compact-counter-item";
    const label=document.createElement("span"); label.textContent=labelText;
    const control=document.createElement("div"); control.className="compact-mini-counter";
    const minus=document.createElement("button");minus.type="button";minus.textContent="−";
    const value=document.createElement("strong");value.textContent=String(Number(currentValue||0));
    const plus=document.createElement("button");plus.type="button";plus.textContent="＋";
    minus.addEventListener("click",()=>{const v=Math.max(0,Number(value.textContent)-1);value.textContent=String(v);onChange(v);saveDraftRound();});
    plus.addEventListener("click",()=>{const v=Number(value.textContent)+1;value.textContent=String(v);onChange(v);saveDraftRound();});
    control.append(minus,value,plus); item.append(label,control); return item;
}

function createCompactMemoInput(hole){
    const section=createCompactSection("MEMO","compact-memo-section");
    const input=document.createElement("input"); input.type="text"; input.placeholder="このホールのメモ"; input.value=hole.memo||""; input.addEventListener("input",e=>{hole.memo=e.target.value;saveDraftRound();}); section.appendChild(input); return section;
}


// ============================================
// PAR入力
// ============================================

function createParInput(hole) {

    const group =
        createFormGroup();

    const label =
        createLabel("PAR");

    const select =
        document.createElement("select");

    select.id = "parInput";

    const emptyOption =
        document.createElement("option");

    emptyOption.value = "";

    emptyOption.textContent =
        "PARを選択";

    select.appendChild(
        emptyOption
    );

    [3, 4, 5, 6].forEach(
        par => {

            const option =
                document.createElement("option");

            option.value =
                String(par);

            option.textContent =
                `Par ${par}`;

            select.appendChild(
                option
            );

        }
    );

    select.value =
        hole.par
            ? String(hole.par)
            : "";

    select.addEventListener(
        "change",
        event => {

            hole.par =
                event.target.value
                    ? Number(
                        event.target.value
                    )
                    : null;

            hole.teeShot.direction = "";

            recalculateStoredParSummary();

            calculateTotals();

            renderCurrentHole();

        }
    );

    group.appendChild(label);

    group.appendChild(select);

    return group;

}


function recalculateStoredParSummary() {

    const holes =
        roundState.round.holes;

    const outPars =
        holes
            .filter(
                hole =>
                    hole.hole >= 1 &&
                    hole.hole <= 9
            )
            .map(
                hole => hole.par
            );

    const inPars =
        holes
            .filter(
                hole =>
                    hole.hole >= 10 &&
                    hole.hole <= 18
            )
            .map(
                hole => hole.par
            );

    roundState.round.outPar =
        outPars.every(
            par => par !== null
        )
            ? outPars.reduce(
                (sum, par) =>
                    sum + Number(par),
                0
            )
            : null;

    roundState.round.inPar =
        inPars.every(
            par => par !== null
        )
            ? inPars.reduce(
                (sum, par) =>
                    sum + Number(par),
                0
            )
            : null;

    roundState.round.totalPar =
        roundState.round.outPar !== null &&
        roundState.round.inPar !== null
            ? roundState.round.outPar +
              roundState.round.inPar
            : null;

    renderStoredParSummary();

}


// ============================================
// 数値入力
// ============================================

function createNumberInputGroup(
    field,
    labelText,
    value,
    min,
    max
) {

    const group =
        createFormGroup();

    const label =
        createLabel(labelText);

    const input =
        document.createElement("input");

    input.type = "number";

    input.inputMode = "numeric";

    input.min = String(min);

    input.max = String(max);

    input.placeholder = "未入力";

    input.value =
        value ?? "";

    input.addEventListener(
        "input",
        event => {

            const hole =
                getCurrentHoleData();

            const inputValue =
                event.target.value;

            hole[field] =
                inputValue === ""
                    ? null
                    : Number(inputValue);

            calculateTotals();

            saveDraftRound();

        }
    );

    group.appendChild(label);

    group.appendChild(input);

    return group;

}


// ============================================
// グリーンオン距離
// ============================================

function createGreenDistanceInput(hole) {

    const group =
        createFormGroup();

    const unit =
        roundState.round.distanceUnit;

    const unitLabel =
        unit === "yard"
            ? "ヤード"
            : "歩";

    const label =
        createLabel(
            `${INPUT_LABELS.greenDistance}（${unitLabel}）`
        );

    const input =
        document.createElement("input");

    input.type = "number";

    input.inputMode = "decimal";

    input.min = "0";

    input.step =
        unit === "yard"
            ? "0.1"
            : "1";

    input.placeholder =
        `${unitLabel}で入力`;

    input.value =
        hole.greenDistance.value ?? "";

    input.addEventListener(
        "input",
        event => {

            hole.greenDistance.value =
                event.target.value === ""
                    ? null
                    : Number(
                        event.target.value
                    );

            hole.greenDistance.unit =
                unit;

            saveDraftRound();

        }
    );

    group.appendChild(label);

    group.appendChild(input);

    return group;

}


// ============================================
// クラブ選択
// ============================================

function createClubSelect(hole) {

    const group =
        createFormGroup();

    const label =
        createLabel(
            INPUT_LABELS.teeClub
        );

    const select =
        document.createElement("select");

    const emptyOption =
        document.createElement("option");

    emptyOption.value = "";

    emptyOption.textContent =
        roundState.selectedClubIds.length > 0
            ? "クラブを選択"
            : "マイクラブが未登録です";

    select.appendChild(
        emptyOption
    );

    roundState.selectedClubIds.forEach(
        clubId => {

            const option =
                document.createElement("option");

            option.value =
                normalizeClubId(clubId);

            option.textContent =
                getClubDisplayName(clubId);

            select.appendChild(
                option
            );

        }
    );

    select.value =
        normalizeClubId(
            hole.teeShot.clubId
        );

    select.addEventListener(
        "change",
        event => {

            hole.teeShot.clubId =
                event.target.value;

            saveDraftRound();

        }
    );

    group.appendChild(label);

    group.appendChild(select);

    if (
        roundState.selectedClubIds.length === 0
    ) {

        const note =
            document.createElement("p");

        note.textContent =
            "設定画面の「マイクラブ」から使用クラブを登録してください。";

        note.style.fontSize = "13px";

        note.style.color = "#777";

        group.appendChild(note);

    }

    return group;

}


// ============================================
// ティーショット方向
// ============================================

function createDirectionInput(hole) {

    const group =
        createFormGroup();

    const label =
        createLabel(
            INPUT_LABELS.direction
        );

    group.appendChild(label);

    if (!hole.par) {

        const message =
            document.createElement("p");

        message.textContent =
            "先にPARを選択してください。";

        message.style.color = "#777";

        group.appendChild(message);

        return group;

    }

    const buttonArea =
        document.createElement("div");

    buttonArea.className =
        "direction-buttons";

    const directions =
        getDirectionOptions(hole.par);

    directions.forEach(
        direction => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "direction-button";

            button.textContent =
                direction.label;

            if (
                hole.teeShot.direction ===
                direction.value
            ) {

                button.classList.add(
                    "selected"
                );

            }

            button.addEventListener(
                "click",
                () => {

                    hole.teeShot.direction =
                        direction.value;

                    renderCurrentHole();

                }
            );

            buttonArea.appendChild(
                button
            );

        }
    );

    group.appendChild(
        buttonArea
    );

    return group;

}


function getDirectionOptions(par) {

    if (Number(par) === 3) {

        return [

            {
                value: "left",
                label: "← 左"
            },

            {
                value: "short",
                label: "↓ 手前"
            },

            {
                value: "green",
                label: "● グリーンオン"
            },

            {
                value: "over",
                label: "↑ オーバー"
            },

            {
                value: "right",
                label: "右 →"
            }

        ];

    }

    return [

        {
            value: "left",
            label: "← 左"
        },

        {
            value: "short",
            label: "↓ 手前"
        },

        {
            value: "fairway",
            label: "● FWキープ"
        },

        {
            value: "right",
            label: "右 →"
        }

    ];

}


// ============================================
// ティーショット曲がり方向
// ============================================
function createCurveInput(hole) {
    const group = createFormGroup();
    group.appendChild(createLabel(INPUT_LABELS.curve));
    const buttonArea = document.createElement("div");
    buttonArea.className = "direction-buttons curve-buttons";
    [
        { value: "left", label: "↙ 左曲がり" },
        { value: "straight", label: "↑ まっすぐ" },
        { value: "right", label: "右曲がり ↘" }
    ].forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "direction-button";
        button.textContent = item.label;
        if (hole.teeShot.curve === item.value) button.classList.add("selected");
        button.addEventListener("click", () => {
            hole.teeShot.curve = hole.teeShot.curve === item.value ? "" : item.value;
            saveDraftRound();
            renderCurrentHole();
        });
        buttonArea.appendChild(button);
    });
    group.appendChild(buttonArea);
    const note=document.createElement("p");
    note.className="input-help-text";
    note.textContent="着弾方向とは別に球筋の曲がりを記録します。";
    group.appendChild(note);
    return group;
}

// ============================================
// グリーンを狙ったショット
// ============================================
function createApproachShotInput(hole) {
    if (!hole.approachShot) hole.approachShot = { clubId: "", distanceYards: null, greenOn: null };
    const group = createFormGroup();
    group.classList.add("approach-shot-group");
    group.appendChild(createLabel(INPUT_LABELS.approachShot));

    const clubLabel=document.createElement("span"); clubLabel.className="sub-input-label"; clubLabel.textContent="番手"; group.appendChild(clubLabel);
    const select=document.createElement("select");
    const empty=document.createElement("option"); empty.value=""; empty.textContent=roundState.selectedClubIds.length?"クラブを選択":"マイクラブが未登録です"; select.appendChild(empty);
    roundState.selectedClubIds.filter(id=>normalizeClubId(id)!=="putter").forEach(clubId=>{const opt=document.createElement("option");opt.value=normalizeClubId(clubId);opt.textContent=getClubDisplayName(clubId);select.appendChild(opt);});
    select.value=normalizeClubId(hole.approachShot.clubId||"");
    select.addEventListener("change",e=>{hole.approachShot.clubId=e.target.value;saveDraftRound();});
    group.appendChild(select);

    const distanceLabel=document.createElement("span"); distanceLabel.className="sub-input-label"; distanceLabel.textContent="残りヤード"; group.appendChild(distanceLabel);
    const distance=document.createElement("input"); distance.type="number"; distance.inputMode="numeric"; distance.min="0"; distance.max="500"; distance.step="1"; distance.placeholder="例：145"; distance.value=hole.approachShot.distanceYards??"";
    distance.addEventListener("input",e=>{hole.approachShot.distanceYards=e.target.value===""?null:Number(e.target.value);saveDraftRound();});
    group.appendChild(distance);

    const onLabel=document.createElement("span"); onLabel.className="sub-input-label"; onLabel.textContent="結果"; group.appendChild(onLabel);
    const buttons=document.createElement("div"); buttons.className="direction-buttons green-on-buttons";
    [{value:true,label:"✓ グリーンオン"},{value:false,label:"× グリーンオンせず"}].forEach(item=>{const b=document.createElement("button");b.type="button";b.className="direction-button";b.textContent=item.label;if(hole.approachShot.greenOn===item.value)b.classList.add("selected");b.addEventListener("click",()=>{hole.approachShot.greenOn=hole.approachShot.greenOn===item.value?null:item.value;saveDraftRound();renderCurrentHole();});buttons.appendChild(b);});
    group.appendChild(buttons);
    return group;
}

// ============================================
// ペナルティ・バンカー
// ============================================

function createPenaltyArea(hole) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "penalty-area";

    const enabled =
        roundState.round.enabledInputs;

    if (enabled.ob) {

        wrapper.appendChild(
            createCounter(
                "OB数",
                hole.ob,
                newValue => {

                    hole.ob = newValue;

                }
            )
        );

    }

    if (enabled.onePenalty) {

        wrapper.appendChild(
            createCounter(
                "1ペナ数",
                hole.onePenalty,
                newValue => {

                    hole.onePenalty =
                        newValue;

                }
            )
        );

    }

    if (enabled.bunker) {

        wrapper.appendChild(
            createCounter(
                "バンカー",
                hole.bunker,
                newValue => {

                    hole.bunker =
                        newValue;

                }
            )
        );

    }

    return wrapper;

}


function createCounter(
    labelText,
    currentValue,
    onChange
) {

    const group =
        createFormGroup();

    const label =
        createLabel(labelText);

    const counter =
        document.createElement("div");

    counter.className =
        "counter-control";

    const minusButton =
        document.createElement("button");

    minusButton.type = "button";

    minusButton.textContent = "−";

    const valueElement =
        document.createElement("span");

    valueElement.textContent =
        String(currentValue || 0);

    const plusButton =
        document.createElement("button");

    plusButton.type = "button";

    plusButton.textContent = "＋";


    minusButton.addEventListener(
        "click",
        () => {

            const newValue =
                Math.max(
                    0,
                    Number(
                        valueElement.textContent
                    ) - 1
                );

            valueElement.textContent =
                String(newValue);

            onChange(newValue);

            saveDraftRound();

        }
    );


    plusButton.addEventListener(
        "click",
        () => {

            const newValue =
                Number(
                    valueElement.textContent
                ) + 1;

            valueElement.textContent =
                String(newValue);

            onChange(newValue);

            saveDraftRound();

        }
    );


    counter.appendChild(
        minusButton
    );

    counter.appendChild(
        valueElement
    );

    counter.appendChild(
        plusButton
    );

    group.appendChild(label);

    group.appendChild(counter);

    return group;

}


// ============================================
// メモ
// ============================================

function createMemoInput(hole) {

    const group =
        createFormGroup();

    const label =
        createLabel(
            INPUT_LABELS.memo
        );

    const textarea =
        document.createElement("textarea");

    textarea.rows = 3;

    textarea.placeholder =
        "このホールのメモ";

    textarea.value =
        hole.memo || "";

    textarea.addEventListener(
        "input",
        event => {

            hole.memo =
                event.target.value;

            saveDraftRound();

        }
    );

    group.appendChild(label);

    group.appendChild(textarea);

    return group;

}


// ============================================
// 進捗表示
// ============================================

function createHoleProgress() {

    const container =
        document.createElement("div");

    container.className =
        "hole-progress";

    roundState.round.holes.forEach(
        hole => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.textContent =
                String(hole.hole);

            button.className =
                "hole-progress-button";

            if (
                hole.hole ===
                roundState.currentHole
            ) {

                button.classList.add(
                    "current"
                );

            }

            if (hole.score !== null) {

                button.classList.add(
                    "completed"
                );

            }

            button.addEventListener(
                "click",
                () => {

                    roundState.currentHole =
                        hole.hole;

                    renderCurrentHole();

                }
            );

            container.appendChild(
                button
            );

        }
    );

    return container;

}


// ============================================
// ホール移動
// ============================================

function goToPreviousHole() {

    if (
        roundState.currentHole <= 1
    ) {

        return;

    }

    roundState.currentHole--;

    renderCurrentHole();

}


function goToNextHole() {

    if (
        roundState.currentHole >= 18
    ) {

        return;

    }

    roundState.currentHole++;

    renderCurrentHole();

}


function updateNavigationButtons() {

    const previous =
        document.getElementById("prevHole");

    const next =
        document.getElementById("nextHole");

    if (previous) {

        previous.disabled =
            roundState.currentHole === 1;

    }

    if (next) {

        next.disabled =
            roundState.currentHole === 18;

    }

}


// ============================================
// 集計
// ============================================

function calculateTotals() {

    const holes =
        roundState.round.holes;

    roundState.round.out =
        calculateHoleRangeTotal(
            holes,
            1,
            9
        );

    roundState.round.in =
        calculateHoleRangeTotal(
            holes,
            10,
            18
        );

    roundState.round.total =
        roundState.round.out +
        roundState.round.in;

    if (typeof updateParSummaryElements === "function") {
        updateParSummaryElements(
            roundState.round.outPar,
            roundState.round.inPar,
            roundState.round.totalPar
        );
    }

}


function calculateHoleRangeTotal(
    holes,
    start,
    end
) {

    return holes

        .filter(
            hole =>
                hole.hole >= start &&
                hole.hole <= end
        )

        .reduce(
            (sum, hole) =>
                sum +
                Number(
                    hole.score || 0
                ),
            0
        );

}


// ============================================
// ラウンド保存
// ============================================

function finishRound() {

    handleRoundInfoChange();

    calculateTotals();

    const validation =
        validateRound();

    if (!validation.isValid) {

        showRoundMessage(
            validation.message,
            true
        );

        return;

    }

    const completedRound = {

        ...roundState.round,

        status: "completed",

        completedAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()

    };

    try {

        // 未登録コースで18ホールのPARが揃っている場合は、
        // 通常入力からの保存でもゴルフ場管理へ自動登録する。
        if (typeof ensureCourseFromRound === "function") {

            const registeredCourse = ensureCourseFromRound(
                completedRound,
                { source: "normal-round-save" }
            );

            if (registeredCourse) {
                completedRound.courseId = registeredCourse.id;
                completedRound.coursePrefecture =
                    completedRound.coursePrefecture || registeredCourse.prefecture || "";
                completedRound.courseLayoutName =
                    completedRound.courseLayoutName || registeredCourse.courseName || "";
            }

        }

        if (roundState.editMode) {

            const savedRounds =
                typeof load === "function" &&
                typeof STORAGE !== "undefined" &&
                STORAGE.ROUNDS
                    ? load(STORAGE.ROUNDS)
                    : JSON.parse(
                        localStorage.getItem("scorecraft_rounds") || "[]"
                    );

            const index = Array.isArray(savedRounds)
                ? savedRounds.findIndex(
                    item => item && item.id === roundState.originalRoundId
                )
                : -1;

            if (index === -1) {

                throw new Error("更新対象のラウンドが見つかりません。");

            }

            completedRound.id = roundState.originalRoundId;
            completedRound.completedAt =
                savedRounds[index].completedAt || completedRound.completedAt;
            completedRound.createdAt =
                savedRounds[index].createdAt || completedRound.createdAt;

            savedRounds[index] = completedRound;

            localStorage.setItem(
                "scorecraft_rounds",
                JSON.stringify(savedRounds)
            );

        }
        else if (
            typeof add === "function" &&
            typeof STORAGE !== "undefined" &&
            STORAGE.ROUNDS
        ) {

            add(
                STORAGE.ROUNDS,
                completedRound
            );

        }
        else {

            const savedRounds =
                JSON.parse(
                    localStorage.getItem(
                        "scorecraft_rounds"
                    ) || "[]"
                );

            savedRounds.push(
                completedRound
            );

            localStorage.setItem(
                "scorecraft_rounds",
                JSON.stringify(savedRounds)
            );

        }

    }
    catch (error) {

        console.error(
            "ラウンド保存に失敗しました。",
            error
        );

        showRoundMessage(
            "ラウンドを保存できませんでした。",
            true
        );

        return;

    }

    clearDraftRound();

    let autoBackupResult = null;
    if (typeof runScoreCraftAutoBackup === "function") {
        try {
            autoBackupResult = runScoreCraftAutoBackup(
                roundState.editMode ? "round-update" : "round-save",
                { download: true }
            );
        } catch (error) {
            console.error("自動バックアップに失敗しました。", error);
        }
    }

    const backupSuffix = autoBackupResult && !autoBackupResult.skipped
        ? (autoBackupResult.downloaded ? " バックアップも作成しました。" : " 端末内バックアップを更新しました。")
        : "";

    showRoundMessage(
        (roundState.editMode
            ? `スコア ${completedRound.total} に更新しました。`
            : `お疲れさまでした！スコア ${completedRound.total} を保存しました。`) + backupSuffix
    );

    window.setTimeout(
        () => {

            location.href = roundState.editMode
                ? `history.html?id=${encodeURIComponent(completedRound.id)}`
                : "index.html";

        },
        1800
    );

}


function validateRound() {

    if (
        !roundState.round.courseName
    ) {

        return {

            isValid: false,

            message:
                "ゴルフ場を検索して選択してください。"

        };

    }

    if (!roundState.round.date) {

        return {

            isValid: false,

            message:
                "ラウンド日を入力してください。"

        };

    }

    const scoreCount =
        roundState.round.holes.filter(
            hole =>
                hole.score !== null &&
                hole.score !== ""
        ).length;

    if (scoreCount === 0) {

        return {

            isValid: false,

            message:
                "少なくとも1ホールのスコアを入力してください。"

        };

    }

    return {

        isValid: true,

        message: ""

    };

}


function initializeRoundResetButton() {
    const button=document.getElementById("resetRoundButton");
    if(button) button.addEventListener("click",resetRoundInputs);
}
function resetRoundInputs() {
    if(!roundState.round || !Array.isArray(roundState.round.holes))return;
    if(!window.confirm("現在入力している18ホール分の内容をすべて消去しますか？\nコース・日付・PARは残ります。"))return;
    roundState.round.holes=roundState.round.holes.map((hole,index)=>{const par=hole?.par??null;const fresh=createEmptyHole(index+1);fresh.par=par;return fresh;});
    roundState.currentHole=1; roundState.round.currentHole=1; calculateTotals(); saveDraftRound(); renderCurrentHole();
    const message=document.getElementById("message"); if(message)message.textContent="入力内容をリセットしました。";
}

// ============================================
// 下書き保存・復元
// ============================================

function saveDraftRound() {

    if (!roundState.round) {

        return;

    }

    roundState.round.currentHole =
        roundState.currentHole;

    roundState.round.updatedAt =
        new Date().toISOString();

    try {

        localStorage.setItem(
            ROUND_DRAFT_KEY,
            JSON.stringify(
                roundState.round
            )
        );

    }
    catch (error) {

        console.error(
            "下書き保存に失敗しました。",
            error
        );

    }

}


function loadDraftRound() {

    try {

        const raw =
            localStorage.getItem(
                ROUND_DRAFT_KEY
            );

        if (!raw) {

            return null;

        }

        const draft =
            JSON.parse(raw);

        if (
            !draft ||
            !Array.isArray(draft.holes) ||
            draft.holes.length !== 18
        ) {

            return null;

        }

        roundState.currentHole =
            Number(
                draft.currentHole || 1
            );

        return draft;

    }
    catch (error) {

        console.error(
            "下書きの読込に失敗しました。",
            error
        );

        return null;

    }

}


function clearDraftRound() {

    localStorage.removeItem(
        ROUND_DRAFT_KEY
    );

}


// ============================================
// マイクラブ取得
// ============================================

function getSelectedClubIds() {

    let selected = [];

    if (
        typeof getMyClubs ===
        "function"
    ) {

        selected =
            getMyClubs();

    }
    else if (
        typeof load === "function" &&
        typeof STORAGE !== "undefined" &&
        STORAGE.CLUBS
    ) {

        selected =
            load(STORAGE.CLUBS);

    }
    else {

        try {

            selected =
                JSON.parse(
                    localStorage.getItem(
                        "scorecraft_clubs"
                    ) || "[]"
                );

        }
        catch {

            selected = [];

        }

    }

    if (!Array.isArray(selected)) {

        return [];

    }

    return selected;

}


function normalizeClubId(value) {

    if (!value) {

        return "";

    }

    if (
        typeof value === "object"
    ) {

        value =
            value.id ||
            value.name ||
            "";

    }

    const text =
        String(value);

    const entry =
        Object.entries(
            CLUB_NAME_MAP
        ).find(
            ([id, name]) =>
                id === text ||
                name === text
        );

    return entry
        ? entry[0]
        : text;

}


function getClubDisplayName(value) {

    if (
        value &&
        typeof value === "object"
    ) {

        return (
            value.name ||
            CLUB_NAME_MAP[value.id] ||
            value.id ||
            ""
        );

    }

    const id =
        normalizeClubId(value);

    return (
        CLUB_NAME_MAP[id] ||
        String(value)
    );

}


// ============================================
// 共通DOM関数
// ============================================

function createFormGroup() {

    const group =
        document.createElement("div");

    group.className =
        "form-group";

    return group;

}


function createLabel(text) {

    const label =
        document.createElement("label");

    label.textContent =
        text;

    return label;

}


function getCurrentHoleData() {

    return roundState.round.holes[
        roundState.currentHole - 1
    ];

}


function getFirstIncompleteHole() {

    if (
        roundState.round &&
        Number(
            roundState.round.currentHole
        ) >= 1 &&
        Number(
            roundState.round.currentHole
        ) <= 18
    ) {

        return Number(
            roundState.round.currentHole
        );

    }

    const incomplete =
        roundState.round.holes.find(
            hole =>
                hole.score === null ||
                hole.score === ""
        );

    return incomplete
        ? incomplete.hole
        : 1;

}


function getTodayValue() {

    if (
        typeof getToday === "function"
    ) {

        try {

            return getToday();

        }
        catch {

            // 代替処理を使用
        }

    }

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function createSafeId() {

    if (
        typeof createId ===
        "function"
    ) {

        try {

            return createId();

        }
        catch {

            // 代替IDを使用
        }

    }

    return (
        "round-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );

}


function showRoundMessage(
    text,
    isError = false
) {

    if (
        typeof showMessage === "function"
    ) {

        try {

            showMessage(
                text,
                isError
                    ? "#d32f2f"
                    : undefined
            );

            return;

        }
        catch {

            // 下の表示処理を使用
        }

    }

    const message =
        document.getElementById(
            "message"
        );

    if (!message) {

        return;

    }

    message.textContent =
        text;

    message.style.color =
        isError
            ? "#d32f2f"
            : "";

}
