/*
 * 汎用の定数置き場
 */

import {range} from "./pik5";

// 有効な操作方法ID、ステージID、ルールID
export const available = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47, 91]

// ユーザーページ等で選択可能なルールID
export const selectable = [10, 11, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47, 91]

// ルールIDから配列に変換する関数
export function rule2array(rule){
    const number = [1, 2, 3, 10, 11, 20, 21, 22, 23, 24, 25, 91, 30, 31, 32, 33, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47]
    const arrays    = [p0, p0, sr, p1, p1, p2, eg, ne, eg, ns, du, ot, p3, ce, be, db, sb, ss, p4, dc, dd, ex, dc, dd, ex, ni]
    const flg = number.indexOf(Number(rule))
    if(flg === -1){
        return []
    } else {
        return arrays[flg]
    }
}
// ルールを表示しないルールID
export const hideRuleNames = [10, 20, 21, 22, 25, 29, 30, 35, 40, 33, 36, 41, 42, 43, 91]

// 難易度を表示するルールID
export const displayDifficulty = [41, 42, 43, 44, 45, 46, 47]

// 昇順でソートするステージID（ソロバトル、ソロビンゴ、夜の探検）
export const reverseStages = [ ...range(245, 254), ...range(351, 362), ...range(429, 444)]

// 本編
export const st = [100, 200, 300, 400]

// ピクミン1
export const p1 = range(101, 105)

// ピクミン2
export const p2 = range(201, 230)

// タマゴなし
export const ne = [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227]

// タマゴあり
export const eg = [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230]

// スプレー縛り
export const ns = [203, 204, 208, 210, 211, 213, 215, 219, 221, 222, 224, 225, 227]

// 本編地下
export const du = range(231, 244)

// ソロバトル
export const bt = range(245, 254)

// ピクミン3/DX
export const p3 = range(301, 350)

// お宝をあつめろ！
export const ce = range(301, 315)

// 原生生物をたおせ！
export const be = range(316, 330)

// サイドストーリー
export const ss = range(331, 344)

// 巨大生物をたおせ！
export const db = range(345, 350)

// ソロビンゴ
export const sb = range(351, 362)

// ピクミン4
export const p4 = range(401, 428)

// ダンドリチャレンジ
export const dc = range(401, 412)

// ダンドリバトル
export const dd = range(413, 418)

// 葉っぱ仙人
export const ex = range(419, 428)

// 夜の探検
export const ni = range(429, 444)

// 本編RTA（Speedrun.com）
export const sp = [101, 102, 201, 202, 203, 204, 301, 302, 303, 311, 312, 313, 401, 402, 403, 404, 405]

// 期間限定総合・参加者企画
export const lm = [151101, 160306, 160319, 160423, 160430, 160806, 170101, 170211, 170325, 170429, 171013, 180101, 180901, 190209, 190321, 190802, 200723, 200918, 210829, 211105, 221008]

// その他
export const ot = [901, 902, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916]

// 通常総合
export const p0 = [].concat(p1, p2, p3, p4)

// 特殊総合
export const sr = [].concat(p1, eg, ns, du, p4)

// 全総合で集計対象のステージ数
export const stageCounts = 224;

// 昇段・昇級に必要なポイント（6級〜九段・理論値）
export const basePoints = [0, 50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 20000]

// カウントダウン系ステージの初期時間
export const timeStageList = [
    {stage:101, time:648, score:278},
    {stage:102, time:1134,score:569},
    {stage:103, time:972, score:482},
    {stage:104, time:1134,score:752},
    {stage:105, time:810, score:299},
    {stage:231, time:360, score:0},
    {stage:232, time:1920, score:0},
    {stage:233, time:1800, score:0},
    {stage:234, time:720, score:0},
    {stage:235, time:840, score:0},
    {stage:236, time:1200, score:0},
    {stage:237, time:1800, score:0},
    {stage:238, time:1320, score:0},
    {stage:239, time:1680, score:0},
    {stage:240, time:1680, score:0},
    {stage:241, time:1560, score:0},
    {stage:242, time:2040, score:0},
    {stage:243, time:1560, score:0},
    {stage:244, time:2520, score:0},
    {stage:338, time:720, score:0},
    {stage:341, time:840, score:0},
    {stage:343, time:780, score:0},
    {stage:345, time:420, score:0},
    {stage:346, time:900, score:0},
    {stage:347, time:780, score:0},
    {stage:348, time:600, score:0},
    {stage:349, time:900, score:0},
    {stage:350, time:720, score:0}]