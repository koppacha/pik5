/*
 * 汎用の定数置き場
 */

import {range} from "./pik5";

// 有効な操作方法ID、ステージID、ルールID
export const available = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47, 91]

// ユーザーページ等で選択可能なルールID
export const selectable = [10, 11, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47, 91]

// 全総合ランキング集計対象のルールID
export const totalRankingRules = [10, 11, 20, 21, 22, 23, 24, 25, 29, 30, 31, 32, 33, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47]

export const eventCategoriesWithStageList = [151, 161, 191, 211]

export const seriesNavigationRules = {
    1: [10, 11],
    2: [21, 22, 24, 25, 29],
    3: [31, 32, 33, 35, 36],
    4: [41, 42, 43, 47],
}

export function stageRules(info){
    const parent = Number(info?.parent < 10 ? info?.stage_id : info?.parent)
    if(!parent) return []

    const rules = [parent]

    if(Number(info?.series) === 1) rules.push(11)
    if(parent === 21) rules.push(23, 26, 27, 28)
    if(parent === 22){
        if(![209, 214, 216, 223].includes(Number(info?.stage_id))) rules.push(24)
        rules.push(26, 27, 28)
    }
    if(Number(info?.series) === 3 && parent !== 35) rules.push(34)
    if(parent === 41) rules.push(44)
    if(parent === 42) rules.push(45)
    if(parent === 43) rules.push(46)

    return [...new Set(rules)]
}

export function additionalStageRules(info){
    const rules = seriesNavigationRules[Number(info?.series)] ?? []
    const currentRules = stageRules(info)
    return rules.filter(rule => !currentRules.includes(rule))
}

// ルールIDから配列に変換する関数
export function rule2array(rule){
    const number = [1, 2, 3, 10, 11, 20, 21, 22, 23, 24, 25, 29, 91, 30, 31, 32, 33, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47]
    const arrays    = [p0, p0, sr, p1, p1, p2, eg, ne, eg, ns, du, bt, ot, p3, ce, be, db, sb, ss, p4, dc, dd, ex, dc, dd, ex, ni]
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

// 新規登録者の証拠動画・画像提出要件
// video / image の値は 0: 不要, q: 全順位で必要, 自然数: その順位以上で必要
export const newUserEvidenceRequirements = {
    10: {video: 1, image: 10},
    11: {video: "q", image: 0},
    21: {video: 10, image: 30},
    22: {video: 10, image: 30},
    23: {video: 1, image: 10},
    24: {video: 1, image: 10},
    25: {video: "q", image: 0},
    26: {video: 1, image: 10},
    27: {video: "q", image: 0},
    28: {video: "q", image: 0},
    29: {video: "q", image: 0},
    31: {video: 1, image: 10},
    32: {video: 1, image: 10},
    33: {video: 1, image: 10},
    34: {video: 1, image: 10},
    35: {video: "q", image: 0},
    36: {video: 1, image: 10},
    41: {video: 1, image: 10},
    42: {video: 1, image: 10},
    43: {video: 1, image: 10},
    44: {video: 1, image: 10},
    45: {video: 1, image: 10},
    46: {video: 1, image: 10},
    47: {video: "q", image: 0},
    91: {
        video: "q",
        image: 0,
        stageOverrides: {
            901: {video: 0, image: "q"},
            902: {video: 0, image: "q"},
        },
    },
}

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

export const speedrunPlatformConsoleMap = {
    "4p9z06rn": 1,
    "v06dk3e4": 2,
    "8gejn93d": 3,
    "7m6ylw9p": 4,
    "3167lw9q": 5,
    "v06dr394": 12,
}

export const speedrunStageConfigs = {
    101: {
        consoles: {
            1: {gameId: "m1zyjx60", categoryId: "9kv9y02g", variables: {"var-onv29rml": "klr0dpjl"}},
            2: {gameId: "m1zyjx60", categoryId: "9kv9y02g", variables: {"var-onv29rml": "21dynz41"}},
            4: {gameId: "m1zyjx60", categoryId: "9kv9y02g", variables: {"var-onv29rml": "q8kkmnkq"}},
        },
    },
    102: {
        consoles: {
            1: {gameId: "m1zyjx60", categoryId: "zd3g682n", variables: {"var-jlz6mx82": "9qj74p3q"}},
            2: {gameId: "m1zyjx60", categoryId: "zd3g682n", variables: {"var-jlz6mx82": "jq65x8jl"}},
            4: {gameId: "m1zyjx60", categoryId: "zd3g682n", variables: {"var-jlz6mx82": "qoxj872q"}},
        },
    },
    201: {
        consoles: {
            1: {gameId: "pdv9zv1w", categoryId: "zd3x7ndn", variables: {"var-yn23w3jl": "qyz7vv41"}},
            2: {gameId: "pdv9zv1w", categoryId: "zd3x7ndn", variables: {"var-yn23w3jl": "ln8e440l"}},
            4: {gameId: "pdv9zv1w", categoryId: "zd3x7ndn", variables: {"var-yn23w3jl": "10v6oowl"}},
        },
    },
    202: {
        consoles: {
            1: {gameId: "pdv9zv1w", categoryId: "wdmggxdq", variables: {"var-6njy5y5n": "qj7266eq"}},
            2: {gameId: "pdv9zv1w", categoryId: "wdmggxdq", variables: {"var-6njy5y5n": "lmo2rrj1"}},
            4: {gameId: "pdv9zv1w", categoryId: "wdmggxdq", variables: {"var-6njy5y5n": "1w47vvoq"}},
        },
    },
    203: {
        consoles: {
            1: {gameId: "pdv9zv1w", categoryId: "jdrw35xk", variables: {"var-ylqomdm8": "9qj3noel"}},
        },
    },
    204: {
        consoles: {
            1: {gameId: "pdv9zv1w", categoryId: "jdrw35xk", variables: {"var-ylqomdm8": "jq6drw31"}},
        },
    },
    301: {
        consoles: {
            3: {gameId: "nd27e310", categoryId: "rklrvwkn"},
            4: {gameId: "76rxq246", categoryId: "jdzw1xgd"},
        },
    },
    302: {
        consoles: {
            3: {gameId: "nd27e310", categoryId: "9d8gjv7k"},
            4: {gameId: "76rxq246", categoryId: "02qvy6yd"},
        },
    },
    303: {
        consoles: {
            3: {gameId: "nd27e310", categoryId: "ndx47j2q"},
            4: {gameId: "76rxq246", categoryId: "82405zwd"},
        },
    },
    311: {
        consoles: {
            7: {gameId: "268e3x56", categoryId: "z276730d"},
        },
    },
    312: {
        consoles: {
            7: {gameId: "268e3x56", categoryId: "5dw845nd"},
        },
    },
    313: {
        consoles: {
            7: {gameId: "268e3x56", categoryId: "ndx9rovd"},
        },
    },
    401: {
        consoles: {
            4: {gameId: "m1zk9901", categoryId: "rkl8xe62"},
        },
    },
    402: {
        consoles: {
            4: {gameId: "m1zk9901", categoryId: "wk6gn0od"},
        },
    },
    403: {
        consoles: {
            4: {gameId: "m1zk9901", categoryId: "zd3mxpv2"},
        },
    },
    404: {
        consoles: {
            4: {gameId: "m1zk9901", categoryId: "n2y6oe7d"},
        },
    },
    405: {
        consoles: {
            4: {gameId: "m1zk9901", categoryId: "n2y69pmd"},
        },
    },
}

export function getSpeedrunConsoleIds(stage) {
    const config = speedrunStageConfigs[Number(stage)]
    return config ? Object.keys(config.consoles).map(Number) : []
}

export function getSpeedrunStageConfig(stage, consoleId = 0) {
    const config = speedrunStageConfigs[Number(stage)]
    if (!config) return null

    const consoles = getSpeedrunConsoleIds(stage)
    const selectedConsole = Number(consoleId) && config.consoles[Number(consoleId)]
        ? Number(consoleId)
        : consoles[0]

    return {
        stage: Number(stage),
        console: selectedConsole,
        ...config.consoles[selectedConsole],
    }
}

export function buildSpeedrunLeaderboardPath(stage, consoleId = 0) {
    const config = getSpeedrunStageConfig(stage, consoleId)
    if (!config) return null

    const params = new URLSearchParams(config.variables ?? {})
    return `${config.gameId}/category/${config.categoryId}${params.toString() ? `?${params.toString()}` : ""}`
}

export function speedrunStageSeries(stage) {
    return Math.floor(Number(stage) / 100)
}

// 期間限定総合・参加者企画
export const lm = [151101, 160306, 160319, 160423, 160430, 160806, 170101, 170211, 170325, 170429, 171013, 180101, 180901, 190209, 190321, 190802, 200723, 200918, 210829, 211105, 221008]

// イベントカテゴリ
export const ev = [151, 161, 211, 231, 241, 242, 261, 262, 251]

// その他
export const ot = [901, 902, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916]

// 通常総合
export const p0 = [].concat(p1, p2, p3, p4)

// 特殊総合
export const sr = [].concat(p1, eg, ns, du, p4)

// 全総合で集計対象のステージ数
export const stageCounts = {
    2026: 224,
    2025: 224,  // +16 夜の探索
    2024: 208,  // +28 ゲキカラダンドリ
    2023: 180,  // + 5 全回収タイムアタック, +28 ピクミン4通常
    2022: 147,
    2021: 147,  // +22 ソロバトル＆ソロビンゴ
    2020: 125,  // +13 スプレー縛り, +14 サイドストーリー
    2019: 98,
    2018: 98,   // +13 新チャレンジ（ムシなし）
    2017: 85,
    2016: 85,   // +14 本編地下
    2015: 71,
    2014: 71    // ピクミン1通常(2007), ピクミン2通常(2007), ピクミン3通常(2013)
}

// 通常総合
export const normalStageCounts = {
    2026: 113,
    2025: 113,
    2024: 113,
    2023: 113,  // +28 ピクミン4通常
    2022: 85,
    2021: 85,
    2020: 85,  // +14 サイドストーリー
    2019: 71,
    2018: 71,
    2017: 71,
    2016: 71,
    2015: 71,
    2014: 71
}

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
