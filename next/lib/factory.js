import {be, ce, db, dc, dd, eg, ex, ne, ss, timeStageList} from "./const";
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

const timeRules = [11, 29, 35, 43, 46, 47, 91]
const remainingTimeStages = [338, 341, 343, 345, 346, 347, 348, 349, 350]

function secondsToTime(value) {
    const sec = Math.max(0, Number(value) || 0)
    const hh = Math.floor(sec / 3600)
    const mm = String(Math.floor(sec / 60) % 60).padStart(2, "0")
    const ss = String(sec % 60).padStart(2, "0")

    return `${hh ? `${hh}:`:""}${mm}:${ss}`
}

export function score2str(score, rule, stage) {
    const numericScore = Number(score)
    const numericRule = Number(rule)
    const numericStage = Number(stage)

    if (remainingTimeStages.includes(numericStage)) {
        const stageTime = timeStageList.find(({stage: targetStage}) => targetStage === numericStage)
        const elapsedTime = Number(stageTime?.time ?? 0) - numericScore

        return secondsToTime(elapsedTime)
    }

    if (timeRules.includes(numericRule)) {
        return secondsToTime(numericScore)
    }

    return `${numericScore.toLocaleString()} pts.`
}
