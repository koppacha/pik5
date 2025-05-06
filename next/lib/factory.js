import {eg, ne} from "./const";
import {currentYear} from "./pik5";

/*
 * 定数を加工して利用する関数はこちらへ（循環処理対策）
 */

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
        // ピクミン2総合が指定されている場合はタマゴあり・なしに強制置換
        if(Number(rule) === 20 && eg.includes(Number(stage))){
            return `${stage}/${consoles}/21/${year}`
        }
        if(Number(rule) === 20 && ne.includes(Number(stage))){
            return `${stage}/${consoles}/22/${year}`
        }
        return `${stage}/${consoles}/${rule}/${year}`
    }
    // 期間限定と例外
    return stage
}