import { styled } from '@mui/material/styles'
import Box from '@mui/material/Box'
import {SeriesTheme} from "@/styles/pik5.css";

/**
 * 横罫線（高さ 4px・角丸）に rps 比率で 4 色グラデーションを適用する。
 *
 * props
 *  - rps   : 合計値
 *  - rps1–4: セグメント値（省略可, falsy ⇒ 0）
 *
 * 4 色は左から順に「青・赤・緑・黄」。
 * 各セグメントの割合 = rpsX / rps （rps <= 0 の場合は全 0）
 */

const COLORS = ['#6eb8ec', '#e86363', '#39d961', '#e3cf37']

/**
 * props からグラデーション CSS を生成
 * 各セグメント境界で 5% 幅のクロスフェードを行う
 */
const buildGradient = ({
  rps = 0,
  rps1 = 0,
  rps2 = 0,
  rps3 = 0,
  rps4 = 0,
  color = 'ccc',
}) => {
  // '#ccc' 形式に正規化
  const base = color.startsWith('#') ? color : `#${color}`
  const total = (rps1 + rps2 + rps3 + rps4) || 0
  if (!total) {
    // 合計が 0 または falsy の場合は単色バー
    return `linear-gradient(to right, ${base} 0%, ${base} 100%)`
  }
  // ---- 通常のグラデーション計算 ----

  const segs = [rps1, rps2, rps3, rps4]
  const ratios = segs.map((v) => Math.max(0, v) / total)

  const BLEND = 8 // % 幅
  const HALF = BLEND / 2

  let acc = 0            // 累積比率 (0–1)
  const stops = []

  // 最初の色を 0% に固定
  stops.push(`${COLORS[0]} 0%`)

  ratios.forEach((ratio, idx) => {
    if (ratio <= 0) return

    const startPct = acc * 100          // セグメント開始位置
    acc += ratio
    const endPct = acc * 100            // セグメント終了位置

    // 前回の色の終了処理 & ブレンド
    if (idx > 0) {
      const blendStart = Math.max(startPct - HALF, 0)
      const blendEnd = Math.min(startPct + HALF, 100)

      // 前の色をブレンド開始まで伸ばす
      stops.push(`${COLORS[idx - 1]} ${blendStart}%`)
      // 前の色と新しい色のクロスフェード領域
      stops.push(`${COLORS[idx - 1]} ${blendStart}%`, `${COLORS[idx]} ${blendEnd}%`)
    }

    // 新しい色の本体を終了位置まで
    stops.push(`${COLORS[idx]} ${endPct}%`)
  })

  // 最終色を 100% まで維持
  const lastIdx = ratios.reduce((prev, val, i) => (val > 0 ? i : prev), 0)
  stops.push(`${COLORS[lastIdx]} 100%`)

  return `linear-gradient(75deg, ${stops.join(', ')})`
}

const GradientLine = styled(Box, {
  // rps, rps1–4, color を DOM に渡さない
  shouldForwardProp: (prop) =>
    !['rps', 'rps1', 'rps2', 'rps3', 'rps4', 'color'].includes(prop),
})((props) => ({
  width: '68%',
  marginLeft: 'auto',
  marginRight: 'auto',
  height: 2,
  marginTop: 2,
  marginBottom: 8,
  borderRadius: 2,
  backgroundImage: buildGradient(props),
  boxShadow: '0 1px 4px rgba(0, 0, 0, 1)',
}))

export default GradientLine