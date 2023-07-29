/*
 * 汎用の定数置き場
 */

import {range} from "./pik5";

// ステージリスト

// 有効な操作方法ID、ステージID、ルールID
export const available = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 40, 41, 42, 43]

// ピクミン1
export const p1 = range(101, 105)

// タマゴなし
export const ne = [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227]

// タマゴあり
export const eg = [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230]

// 本編地下
export const du = range(231, 244)

// ソロバトル
export const bt = range(245, 254)

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

// ダンドリチャレンジ
export const dc = range(401, 412)

// ダンドリバトル
export const dd = range(413, 418)

// 葉っぱ仙人
export const ex = range(419, 428)

// 本編RTA
export const sp = [101, 102, 201, 202, 203, 204, 301, 302, 303, 311, 312, 313]

// カウントダウン系ステージの初期時間
export const timeStageList = [
    {stage:338, time:720}, {stage:341, time:840},
    {stage:343, time:780}, {stage:345, time:420},
    {stage:346, time:900}, {stage:347, time:780},
    {stage:348, time:600}, {stage:349, time:900},
    {stage:350, time:720}]