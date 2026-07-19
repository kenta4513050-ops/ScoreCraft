// ============================================
// ScoreCraft
// courseDatabase.js
// ゴルフ場・コース情報
// ============================================

"use strict";


// ============================================
// ゴルフ場データ
// ============================================
//
// 現段階では、動作確認用のサンプルコースを
// 登録しています。
//
// 実在するゴルフ場のデータではありません。
//
// 今後、以下の形式でゴルフ場を追加できます。
//
// {
//     id: "一意のID",
//     name: "ゴルフ場名",
//     prefecture: "都道府県",
//     courseName: "コース名",
//     holes: [
//         { hole: 1, par: 4 },
//         ...
//         { hole: 18, par: 5 }
//     ]
// }
// ============================================

const BUILT_IN_COURSES = [];



// ============================================
// ゴルフ場一覧取得
// ============================================

const CUSTOM_COURSES_KEY = "scorecraft_custom_courses";

function getCustomCourses() {
    try {
        const value = JSON.parse(localStorage.getItem(CUSTOM_COURSES_KEY) || "[]");
        return Array.isArray(value) ? value.filter(isValidCourse).map(cloneCourse) : [];
    } catch {
        return [];
    }
}

function saveCustomCourses(courses) {
    localStorage.setItem(CUSTOM_COURSES_KEY, JSON.stringify(courses.filter(isValidCourse)));
}

function getCourseDatabase() {
    return [...BUILT_IN_COURSES, ...getCustomCourses()].map(cloneCourse);
}


// ============================================
// IDからゴルフ場取得
// ============================================

function getCourseById(courseId) {

    const course =
        getCourseDatabase().find(
            item => item.id === courseId
        );

    return course
        ? cloneCourse(course)
        : null;

}


// ============================================
// ゴルフ場名検索
// ============================================

function searchCourses(keyword) {

    const normalizedKeyword =
        String(keyword || "")
            .trim()
            .toLowerCase();

    if (!normalizedKeyword) {

        return getCourseDatabase();

    }

    return getCourseDatabase()

        .filter(course => {

            const searchTarget = [

                course.name,
                course.prefecture,
                course.courseName

            ]
                .join(" ")
                .toLowerCase();

            return searchTarget.includes(
                normalizedKeyword
            );

        })

        .map(
            course => cloneCourse(course)
        );

}


// ============================================
// ホールのPAR取得
// ============================================

function getCourseHolePar(
    courseId,
    holeNumber
) {

    const course =
        getCourseDatabase().find(
            item => item.id === courseId
        );

    if (!course) {

        return null;

    }

    const hole =
        course.holes.find(
            item =>
                item.hole === Number(holeNumber)
        );

    return hole
        ? hole.par
        : null;

}


// ============================================
// コースの合計PAR取得
// ============================================

function getCourseTotalPar(courseId) {

    const course =
        getCourseDatabase().find(
            item => item.id === courseId
        );

    if (!course) {

        return null;

    }

    return course.holes.reduce(
        (total, hole) =>
            total + Number(hole.par || 0),
        0
    );

}


// ============================================
// OUTの合計PAR取得
// ============================================

function getCourseOutPar(courseId) {

    const course =
        getCourseDatabase().find(
            item => item.id === courseId
        );

    if (!course) {

        return null;

    }

    return course.holes

        .filter(
            hole =>
                hole.hole >= 1 &&
                hole.hole <= 9
        )

        .reduce(
            (total, hole) =>
                total + Number(hole.par || 0),
            0
        );

}


// ============================================
// INの合計PAR取得
// ============================================

function getCourseInPar(courseId) {

    const course =
        getCourseDatabase().find(
            item => item.id === courseId
        );

    if (!course) {

        return null;

    }

    return course.holes

        .filter(
            hole =>
                hole.hole >= 10 &&
                hole.hole <= 18
        )

        .reduce(
            (total, hole) =>
                total + Number(hole.par || 0),
            0
        );

}


// ============================================
// ゴルフ場表示名取得
// ============================================

function getCourseDisplayName(course) {

    if (!course) {

        return "";

    }

    const courseLabel =
        course.courseName
            ? ` - ${course.courseName}`
            : "";

    return (
        `${course.name}${courseLabel}` +
        `（${course.prefecture}）`
    );

}


// ============================================
// データ複製
// ============================================
//
// 元データが入力画面側から変更されないように
// 新しいオブジェクトとして返します。
// ============================================


function isValidCourse(course) {
    return Boolean(course && course.id && course.name && Array.isArray(course.holes) && course.holes.length === 18);
}

function createCourseId() {
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function upsertCustomCourse(course) {
    const courses = getCustomCourses();
    const normalized = cloneCourse(course);
    normalized.isCustom = true;
    const index = courses.findIndex(item => item.id === normalized.id);
    if (index >= 0) courses[index] = normalized; else courses.push(normalized);
    saveCustomCourses(courses);
    return cloneCourse(normalized);
}

function deleteCustomCourse(courseId) {
    const courses = getCustomCourses();
    const next = courses.filter(item => item.id !== courseId);
    if (next.length === courses.length) return false;
    saveCustomCourses(next);
    return true;
}

function isCustomCourse(courseId) {
    return getCustomCourses().some(item => item.id === courseId);
}

function cloneCourse(course) {

    return {

        ...course,

        holes: course.holes.map(
            hole => ({
                ...hole
            })
        )

    };

}