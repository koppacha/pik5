import {useRouter} from "next/router";
import {ja} from "../locale/ja";
import {en} from "../locale/en";

// 指定値から指定値までの数列を作成する関数

export const range = (start, end) => [...Array((end - start) + 1)].map((_, i) => start + i);

// Fetcher本体
export function fetcher(url){
    return fetch(url).then((r)=>r.json())
}
export const useLocale = () => {
    const { locale } = useRouter()
    const t = (locale === "en") ? en : ja
    const r = (locale !== "en") ? ja : en
    return { locale, t, r }
}