import {useRouter} from "next/router";
import {ja} from "../locale/ja";
import {en} from "../locale/en";
import {useTheme} from "next-themes";

// 指定値から指定値までの数列を作成する関数
export const range = (start, end) => [...Array((end - start) + 1)].map((_, i) => start + i);

// Fetcher本体
export function fetcher(url){
    return fetch(url).then((r)=>r.json())
}
// 翻訳データ読み込み（現在の言語はt、現在の言語でない方はrに格納される）
export const useLocale = () => {
    const { locale } = useRouter()
    const t = (locale === "en") ? en : ja
    const r = (locale !== "en") ? en : ja
    return { locale, t, r }
}
