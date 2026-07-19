// ============================================
// ScoreCraft
// storage.js
// LocalStorage管理
// ============================================

// 保存キー
const STORAGE = {

    ROUNDS: "scorecraft_rounds",

    CLUBS: "scorecraft_clubs",

    CONFIG: "scorecraft_config",

    COURSES: "scorecraft_custom_courses"

};


// ============================================
// データ取得
// ============================================

function load(key) {

    const data = localStorage.getItem(key);

    if (!data) {

        return [];

    }

    try {

        return JSON.parse(data);

    }

    catch (error) {

        console.error(error);

        return [];

    }

}


// ============================================
// データ保存
// ============================================

function save(key, data) {

    localStorage.setItem(

        key,

        JSON.stringify(data)

    );

}


// ============================================
// データ追加
// ============================================

function add(key, item) {

    const data = load(key);

    data.push(item);

    save(key, data);

}


// ============================================
// データ更新
// ============================================

function update(key, id, newItem) {

    const data = load(key);

    const index = data.findIndex(

        item => item.id === id

    );

    if (index === -1) {

        return false;

    }

    data[index] = newItem;

    save(key, data);

    return true;

}


// ============================================
// データ削除
// ============================================

function remove(key, id) {

    const data = load(key);

    const filtered = data.filter(

        item => item.id !== id

    );

    save(key, filtered);

}


// ============================================
// 全削除
// ============================================

function clear(key) {

    localStorage.removeItem(key);

}

//==========================================
// マイクラブ保存
//==========================================

const CLUB_KEY = "scorecraft_clubs";

function saveMyClubs(clubs){

    localStorage.setItem(

        CLUB_KEY,

        JSON.stringify(clubs)

    );

}



//==========================================
// マイクラブ取得
//==========================================

function getMyClubs(){

    const data =
        localStorage.getItem(CLUB_KEY);

    if(!data){

        return [];

    }

    try{

        return JSON.parse(data);

    }

    catch{

        return [];

    }

}