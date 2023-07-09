/*
 * 汎用の定数置き場
 */

import {range} from "./pik5";

// ステージリスト

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

// ピクミン4
export const p4 = range(401, 405)

// 本編RTA
export const sp = [101, 102, 201, 202, 203, 204, 301, 302, 303, 311, 312, 313]