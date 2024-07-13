import {useRouter} from "next/router";
import {ja} from "../locale/ja";
import {en} from "../locale/en";
import {useTheme} from "next-themes";

// 指定値から指定値までの数列を作成する関数
export const range = (start, end) => [...Array((end - start) + 1)].map((_, i) => start + i);

// Fetcher本体
export async function fetcher(url){
    const res = await fetch(url)
    if(!res.ok){
        res.status(500).end()
    }
    return res.json()
}
// 翻訳データ読み込み（SSRでは使用不可）（現在の言語はt、現在の言語でない方はrに格納される）
export const useLocale = () => {
    const { locale } = useRouter()
    const t = (locale === "en") ? en : ja
    const r = (locale !== "en") ? en : ja
    return { locale, t, r }
}
// 秒数を時間に変換
export function sec2time(sec){
    const hh = ~~(sec / 3600)
    const mm = ("00"+ ~~(~~(sec / 60) % 60)).slice(-2)
    const ss = ("00"+ ~~(sec % 60)).slice(-2)
    return (hh ? hh + ":" : "") + mm + ":" + ss
}
// "h:mm:ss"形式の文字列を秒数に変換する関数
export const convertToSeconds = (timeString) => {

    // Stepsが効かない端末ではhoursを強制的に補完する
    const hour = (timeString.match(/:/g) || []).length < 2 ? "00:" : ""

    const [hours, minutes, seconds] = (hour + timeString).split(':');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}
// 日付をフォーマットする関数
export function dateFormat(date){

    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if(diff > (1000 * 60 * 60 * 12)) {
        // 12時間以上前なら日付で表示
        const y = date.getFullYear()
        const mo = ('0' + (date.getMonth() + 1)).slice(-2)
        const d = ('0' + date.getDate()).slice(-2)
        return y + '/' + mo + '/' + d
    } else {
        // 12時間以内なら時間で表示
        const h = ('0' + date.getHours()).slice(-2)
        const mi = ('0' + date.getMinutes()).slice(-2)
        const s = ('0' + date.getSeconds()).slice(-2)
        return h + ':' + mi + ':' + s
    }
}
// 今年の西暦を取得する関数
export const currentYear = () => {
    const now = new Date()
    return now.getFullYear()
}

// URLから特定のパラメータを取り出す関数
export const ag2getParameterByName = function(name, url){
    let queryString = url.split('?');
    if(queryString.length >= 2){
        let paras = queryString[1].split('&');
        for(let i = 0; i < paras.length; i++){
            let eachPara = paras[i].split('=');
            if(eachPara[0] === name) return eachPara[1];
        }
    }
    return null;
}

// 深いマージを行う 参照： https://qiita.com/riversun/items/60307d58f9b2f461082a
export function mergeDeeply(target, source, opts) {
    const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);
    const isConcatArray = opts && opts.concatArray;
    let result = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        for (const [sourceKey, sourceValue] of Object.entries(source)) {
            const targetValue = target[sourceKey];
            if (isConcatArray && Array.isArray(sourceValue) && Array.isArray(targetValue)) {
                result[sourceKey] = targetValue.concat(...sourceValue);
            }
            else if (isObject(sourceValue) && target.hasOwnProperty(sourceKey)) {
                result[sourceKey] = mergeDeeply(targetValue, sourceValue, opts);
            }
            else {
                Object.assign(result, {[sourceKey]: sourceValue});
            }
        }
    }
    return result;
}
// オブジェクトを数値範囲で切り出す関数
export function sliceObject(obj, start, end) {
    const result = {};
    for (const key in obj) {
        const keyAsNumber = parseInt(key, 10); // キーを数値に変換
        if (!isNaN(keyAsNumber) && keyAsNumber >= start && keyAsNumber <= end) {
            result[key] = obj[key];
        }
    }
    return result;
}
// 特定ユーザーのIDを入力してユーザー名を返す
export function id2name(users, target){
    const result = users.find(function(user){
        return user.userId === target
    })
    return result.name
}
// ボーダーカラーと背景色（罫線色、ダークテーマ時背景、ライトテーマ時背景の順）
export const rankColor = (rank, team = 0, target = 0) => {
    const t = Number(team)
    const r = Number(rank)
    if(!t || target === 0){
        switch (true) {
            case !r: // false
                return target ? '#2d2d2d' : '#b7b7b7'
            case r === 1: // 1位
                return target ? '#f6f24e' : '#eaeaea'
            case r === 2: // 2位
                return target ? '#42f35d' : '#dedede'
            case r === 3: // 3位
                return target ? '#23abf1' : '#d5d5d5'
            case r < 11: // 4～10位
                return target ? '#c7c7c7' : '#b7b7b7'
            case r < 21: // 11～20位
                return target ? '#9a9a9a' : '#b7b7b7'
            default: // 21位～
                return target ? '#3f3d3d' : '#b7b7b7'
        }
    } else {
        const teamColor = ['',
            '#19acff', '#ff3919', '#eeeeee', '#b419ff',
            '#ff63f2', '#e3e3e3', '#f3524c', '#8ba9ff',
            '#e0e0e0', '#010101', '#45aee6', '#e6d745',
            '#e6456c', '#e6b945', '#45e675', '#dce645',
            '#457de6', '#e69345', '#e64575', '#455ae6']
        return teamColor[t]
    }
}
// パラメータからURLを生成する関数
export function stageUrlOutput(stage, consoles, rule, year, parent){
    // 期間限定以外
    if(rule > 0 && rule < 100){
        // parentを読み込めない場合（新着順一覧など）
        if(parent === undefined){
            if([10, 20, 21, 22, 30, 31, 32, 33, 36, 40, 41, 42, 43, 91].includes(rule)){
                return stage
            }
        }
        // すべてのパラメータがデフォルトならパラメータは付与しない
        if(Number(consoles) === 0 && Number(year) === currentYear() && Number(rule) === parent){
            return stage
        }
        return `${stage}/${consoles}/${rule}/${year}`
    }
    // 期間限定と例外
    return stage
}

// ルールIDを対象操作方法配列に変換
export function rule2consoles(rule){
    const ruleNum = Number(rule ?? 0)
    if(!ruleNum) return [1, 2, 3, 4, 5, 6, 7]

    // ピクミン1・2はNGC、Wii、Switch
    if(ruleNum < 30) return [1, 2, 7]

    // ピクミン4はジャイロあり・なし
    if(ruleNum > 39 && ruleNum < 50) return [3, 4]

    // ピクミン3ソロビンゴはWii、ジャイロあり、ジャイロなし、Wii Uタッチペン、おすそわけ
    if(ruleNum === 35) return [2, 3, 4, 5, 6]

    // ピクミン3サイドストーリーはジャイロあり、ジャイロなし
    if(ruleNum === 36) return [3, 4]

    // 上記以外のピクミン3はWii、ジャイロあり、ジャイロなし、Wii Uタッチペン
    if(ruleNum > 29 && ruleNum < 35) return [2, 3, 4, 5]

    return [1, 2, 3, 4, 5, 6, 7]
}

// 記録オブジェクトに対してスクリーンネームを追加する関数
export function addName2posts(posts, users){
    return posts ? Object.values(posts).map(post => {
        const user = users.find(user => user.userId === post.user_id)
        return {
            ...post,
            user_name: user ? user.name : ""
        }
    }) : []
}
// キャッシュ再作成をNext.js APIに指示する関数
export const purgeCache = async (page, id, token) => {
    const res = await fetch(`/api/revalidate?page=${page}&id=${id}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    })
    if(res.ok){
        window.location.reload()
    }
}
// キャッシュ時間を取得（hh:mm:ss）
export const formattedDate = () => {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    return `${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}`;
}