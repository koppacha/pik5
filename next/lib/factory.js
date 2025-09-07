import {be, ce, db, dc, dd, eg, ex, ne, ss} from "./const";
import {currentYear} from "./pik5";

/*
 * 定数を加工して利用する関数はこちらへ（循環処理対策）
 */

// パラメータからURLを生成する関数
export function stageUrlOutput(stage, consoles, rule, year, parent){

    // 数値変換
    const s = Number(stage)
    const c = Number(consoles)
    const r = Number(rule)
    const y = Number(year)

    // 期間限定
    if(r >= 100 || s >= 1000) return stage

    // parentが読み込めない場合（新着順一覧など）
    if(parent === undefined && [90, 91].includes(r)) return stage

    // すべてデフォルトならパラメータは付与しない
    if(c === 0 && y === currentYear() && (r === parent || parent === undefined)) return stage

    // ルール差し替え判定テーブル
    const map = {
        20: [[eg, 21], [ne, 22]],
        30: [[ce, 31], [be, 32], [db, 33], [ss, 36]],
        40: [[dc, 41], [dd, 42], [ex, 43]]
    }
    for(const [arr, newRule] of map[r] ?? []){
        if(arr.includes(s)) return `${stage}/${consoles}/${newRule}/${year}`
    }
    return `${stage}/${consoles}/${rule}/${year}`
}