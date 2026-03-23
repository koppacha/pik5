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
    const result = users?.find(function(user){
        return user.userId === target
    })
    return result?.name || "名無し"
}
// カード表示用に名前を短縮表示する
export function truncateSmart(str) {
    if (typeof str !== 'string') return ''

    // 含まれる文字がマルチバイト（全角）かどうかを判定
    const isMultiByte = /[^\x00-\x7F]/.test(str)

    if (isMultiByte) {
        // マルチバイト：7文字以上 → 先頭6文字 + …
        return str.length > 6 ? str.slice(0, 6) + '…' : str
    } else {
        // シングルバイト：14文字以上 → 先頭12文字 + …
        return str.length > 12 ? str.slice(0, 12) + '…' : str
    }
}

export const stageId2seriesId = (stageId) => {
    const id = Number(stageId)
    if (!Number.isFinite(id)) return null
    if (id < 100 || id >= 500) return null

    const seriesId = Math.floor(id / 100)
    return (seriesId >= 1 && seriesId <= 4) ? seriesId : null
}

export const isLimitedStageId = (stageId) => {
    const id = Number(stageId)
    return Number.isFinite(id) && id >= 1000 && id <= 9999
}

export const getPageThemeKind = (pathname = "", pageProps = {}, query = {}) => {
    if (pathname.startsWith("/limited")) return "limited"

    if (pathname === "/stage/[...stage]") {
        return isLimitedStageId(pageProps?.stage ?? query?.stage?.[0]) ? "limited" : "series"
    }

    if ([
        "/record/[record]",
        "/speedrun/[...run]",
        "/total/[...series]",
    ].includes(pathname)) return "series"
    return "other"
}

export const normalizeSeriesId = (series) => {
    const value = Number(series)
    if (!Number.isFinite(value)) return null
    if (value >= 1 && value <= 4) return value
    if (value >= 10 && value < 50) return Math.floor(value / 10)
    return null
}

export const resolvePageSeriesId = (pathname = "", pageProps = {}, query = {}) => {
    if (pathname === "/total/[...series]") {
        return normalizeSeriesId(pageProps?.series ?? query?.series?.[0])
    }

    if (pathname === "/stage/[...stage]" || pathname === "/speedrun/[...run]") {
        return stageId2seriesId(pageProps?.stage ?? query?.stage?.[0] ?? query?.run?.[0])
    }

    if (pathname === "/record/[record]") {
        return stageId2seriesId(pageProps?.data?.stage_id)
    }

    return null
}
// ボーダーカラーと背景色（罫線色、ダークテーマ時背景、ライトテーマ時背景の順）
export const rankColor = (rank, team = 0, target = 0) => {
    const t = Number(team)
    const r = Number(rank)
    if(!t || target === 0){
        switch (true) {
            case !r: // false
                return target ? 'var(--color-rank-default-border)' : 'var(--color-rank-default-bg)'
            case r === 1: // 1位
                return target ? 'var(--color-rank-1-border)' : 'var(--color-rank-1-bg)'
            case r === 2: // 2位
                return target ? 'var(--color-rank-2-border)' : 'var(--color-rank-2-bg)'
            case r === 3: // 3位
                return target ? 'var(--color-rank-3-border)' : 'var(--color-rank-3-bg)'
            case r < 11: // 4～10位
                return target ? 'var(--color-rank-4to10-border)' : 'var(--color-rank-4to10-bg)'
            case r < 21: // 11～20位
                return target ? 'var(--color-rank-11to20-border)' : 'var(--color-rank-11to20-bg)'
            default: // 21位～
                return target ? 'var(--color-rank-21plus-border)' : 'var(--color-rank-21plus-bg)'
        }
    } else {
        const teamColor = ['',
            'var(--series-theme-default)',
            'var(--color-team-1)', 'var(--color-team-2)', 'var(--color-team-3)', 'var(--color-team-4)',
            'var(--color-team-5)', 'var(--color-team-6)', 'var(--color-team-7)', 'var(--color-team-8)',
            'var(--color-team-9)', 'var(--color-team-10)', 'var(--color-team-11)', 'var(--color-team-12)',
            'var(--color-team-13)', 'var(--color-team-14)', 'var(--color-team-15)', 'var(--color-team-16)',
            'var(--color-team-17)', 'var(--color-team-18)', 'var(--color-team-19)', 'var(--color-team-20)']
        return teamColor[t]
    }
}

export const recordContainerBackgroundColor = (rank, theme = "light") => {
    if (theme !== "dark") return "#ffffff"

    const r = Number(rank)
    switch (true) {
        case !r:
            return "#656565"
        case r === 1:
            return "#656565"
        case r === 2:
            return "#4b4b4b"
        case r === 3:
            return "#2a2a2a"
        case r < 11:
            return "#181818"
        case r < 21:
            return "#181818"
        default:
            return "#181818"
    }
}

// ルールIDを対象操作方法配列に変換
export function rule2consoles(rule){
    const ruleNum = Number(rule) ?? 0
    if(!ruleNum) return [1, 2, 3, 4]

    // ピクミン1・2はNGC、Wii、Switch
    if(ruleNum < 30) return [1, 2, 4]

    // ピクミン4はSwitchのみ
    if(ruleNum > 39 && ruleNum < 50) return [4]

    // ピクミン3サイドストーリーはSwitchのみ
    if(ruleNum === 36) return [4]

    // 上記以外のピクミン3はWii、Wii U、Switch（3DX）
    if(ruleNum > 29 && ruleNum < 35) return [2, 3, 4]

    // 上記のどれにも当てはまらない
    return [1, 2, 3, 4]
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
export const purgeCache = async (page, id, console, rule, year, token) => {
    const res = await fetch(`/api/revalidate?page=${page}&id=${id}&console=${console}&rule=${rule}&year=${year}`, {
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
// メールアドレスのマスキング
export function maskEmailAddress(rawEmail) {
    const email = String(rawEmail || '').trim()
    const at = email.indexOf('@')
    if (at <= 0) return null

    const local = email.slice(0, at)
    const domainFull = email.slice(at + 1)

    const localKeep = local.slice(0, Math.min(3, local.length))
    const maskedLocal = localKeep + '******'

    const domainKeep = domainFull.slice(0, Math.min(2, domainFull.length))
    const maskedDomain = domainKeep + '****'

    return `${maskedLocal}@${maskedDomain}`
}
