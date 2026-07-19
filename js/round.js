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
    direction: "ティーショット方向",
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

    roundState.currentHole =
        getFirstIncompleteHole();

    normalizeRoundData();

    setRoundInformation();

    bindMainEvents();

    restoreSelectedCourseDisplay();

    applyEditModeDisplay();

    initializeEditModeSelector();

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
            teeClub: false,
            direction: false,
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
            teeClub: true,
            direction: true,
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
        teeClub: custom.teeClub ?? false,
        direction: custom.direction ?? false,
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

            direction: ""

        },

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
                    direction: ""
                };

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
            teeClub: true,
            direction: true,
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

}


function hideSelectedCourse() {

    const area =
        document.getElementById(
            "selectedCourseArea"
        );

    if (area) {

        area.hidden = true;

    }

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

    const area =
        document.getElementById("inputArea");

    if (!area) {

        return;

    }

    area.innerHTML = "";

    area.appendChild(
        createParInput(hole)
    );

    const enabled =
        roundState.round.enabledInputs;

    if (enabled.score) {

        area.appendChild(
            createNumberInputGroup(
                "score",
                INPUT_LABELS.score,
                hole.score,
                1,
                20
            )
        );

    }

    if (enabled.putt) {

        area.appendChild(
            createNumberInputGroup(
                "putts",
                INPUT_LABELS.putt,
                hole.putts,
                0,
                10
            )
        );

    }

    if (enabled.greenDistance) {

        area.appendChild(
            createGreenDistanceInput(hole)
        );

    }

    if (enabled.teeClub) {

        area.appendChild(
            createClubSelect(hole)
        );

    }

    if (enabled.direction) {

        area.appendChild(
            createDirectionInput(hole)
        );

    }

    if (
        enabled.ob ||
        enabled.onePenalty ||
        enabled.bunker
    ) {

        area.appendChild(
            createPenaltyArea(hole)
        );

    }

    if (enabled.memo) {

        area.appendChild(
            createMemoInput(hole)
        );

    }

    area.appendChild(
        createHoleProgress()
    );

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

    showRoundMessage(
        roundState.editMode
            ? `スコア ${completedRound.total} に更新しました。`
            : `お疲れさまでした！スコア ${completedRound.total} を保存しました。`
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
