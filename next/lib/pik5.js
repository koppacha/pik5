import {useRouter} from "next/router";
import {ja} from "../locale/ja";
import {en} from "../locale/en";

// 指定値から指定値までの数列を作成する関数
export const range = (start, end) => [...Array((end - start) + 1)].map((_, i) => start + i);

// Fetcher本体
export function fetcher(url){
    return fetch(url).then((r)=>r.json())
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