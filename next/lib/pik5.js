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