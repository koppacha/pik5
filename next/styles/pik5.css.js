import {Box, Grid, MenuItem, Select, Typography, Button} from "@mui/material";
import styled, {createGlobalStyle} from "styled-components";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useTheme} from "next-themes";

export const GlobalStyle = createGlobalStyle`

  body {
    color: #282828;
    background-color: #e0e0e0;
    font-family: "M PLUS 1 CODE", sans-serif;

    [data-theme="dark"] & {
      color: #e1e1e1;
      background-color: #212121;
    }
  }

  .title {
    font-size: 3.5em;
  }

  .mini-title {
    font-size: 2.5em;
  }

  .subtitle {
    color: #777;
  }

  .active {
    background-color: #212121 !important;
    color: #eaeaea !important;

    [data-theme="dark"] & {
      background-color: #eaeaea !important;
      color: #212121 !important;
    }
  }

  .info-box {
    border: 1px solid #000;
    padding: 2em;
    margin: 2em;
    border-radius: 8px;
  }

  .form-helper-text {
    color: #1a202c;

    [data-theme="dark"] & {
      color: #e2e8f0;
    }
  }

  .markdown-content {
    font-size: 1.0em;

    code {
      font-family: "M PLUS 1 CODE", sans-serif;
    }

    li {
      margin: 0 3em;
    }

    　ul, ol {
      padding: 0.75em 0;
    }
  }
`
// シリーズ別テーマカラー
const theme = (series) => {
    switch (series) {
        case 1:
            return '#6eb8ec'
        case 2:
            return '#e86363'
        case 3:
            return '#39d961'
        case 4:
            return '#e3cf37'
        case 7: // 期間限定
            return '#7c37e3'
        case 9: // その他
            return '#e1e1e1'
        default:
            return '#333333'
    }
}

// 文字影
const shadow = () => {
    const {theme} = useTheme()
    const shadowColor = theme === "dark" ? "#000" : "#dadada"
    return `2px  2px 2px ${shadowColor}, -2px  2px 2px ${shadowColor},
            2px -2px 2px ${shadowColor}, -2px -2px 2px ${shadowColor},
            2px    0 2px ${shadowColor},    0  2px 2px ${shadowColor},
            -2px   0 2px ${shadowColor},    0 -2px 2px ${shadowColor}
            `
}

// ボーダーカラーと背景色（罫線色、ダークテーマ時背景、ライトテーマ時背景の順）
const rankColor = (rank, target = 0) => {
    const {theme} = useTheme()
    const r = Number(rank)
    switch (true) {
        case r === 1: // 1位
            return target ? '#f6f24e' : theme === "dark" ? '#656565' : '#eaeaea'
        case r === 2: // 2位
            return target ? '#42f35d' : theme === "dark" ? '#4b4b4b' : '#dedede'
        case r === 3: // 3位
            return target ? '#23abf1' : theme === "dark" ? '#2a2a2a' : '#d5d5d5'
        case r < 11: // 4～10位
            return target ? '#c7c7c7' : theme === "dark" ? '#181818' : '#b7b7b7'
        case r < 21: // 11～20位
            return target ? '#9a9a9a' : theme === "dark" ? '#181818' : '#b7b7b7'
        default: // 21位～
            return target ? '#3f3d3d' : theme === "dark" ? '#181818' : '#b7b7b7'
    }
}

export const CustomMenuButton = styled(Button).attrs(props => ({$series: props.series}))`
  color: #fff;
  background-color:transparent;
  font-size :0.9em;
  border-radius:0;
  height: 64px;
  padding: 0 18px;
  border-bottom :4px solid #000;
  &:hover {
    border-bottom :4px solid ${props => theme(props.$series)};
    background-color: #2d3748;
  }
`
export const RecordPostButton = styled(Box).attrs(props => ({$series: props.series}))`
  border-radius: 4px;
  padding: 12px;
  margin: 6px;
  svg {
    color: ${props => theme(props.$series)};
  }
`

export const StyledSelect = styled(Select)`
    border: 1px solid #181818;
    svg {
      color: #181818;
    }
    [data-theme="dark"] & {
      border: 1px solid #e1e1e1;
      color: #e1e1e1;
      svg {
        color: #e1e1e1;
      }
    }
`
export const StyledMenuItem = styled(MenuItem)`
  font-family: "M PLUS 1 CODE", sans-serif;
`

export const InfoBox = styled(Box)`
  border :1px solid #181818;
  padding :2em;
  margin :2em;
  border-radius :8px;
`
export const RuleBox = styled(Box)`
  border-radius: 4px;
  padding: 12px;
  margin-right: 6px;
  background-color: #a1a1a1;

  [data-theme="dark"] & {
    background-color: #3d3d3d;
  }
`
export const CellBox = styled(Box)`
  margin :4px;
  padding :2px;
  background-color :#999;
  border-radius :8px;
  text-align :center;

  [data-theme="dark"] & {
    background-color: #333;
  }
`
export const TotalBox = styled(Box)`
  border :1px solid #181818;
  border-radius :4px;
  padding :12px;
  margin :6px;
`
export const StairIcon = styled(FontAwesomeIcon)`
    font-size :0.8em;
    color :#777;
    margin :0 0.5em;
`
export const WrapTopBox = styled(Grid)`
  padding :10px;
`
export const TopBox = styled(Box)`
  border: 1px solid #444;
  border-radius: 4px;
  height: 100%;
`
export const TopBoxHeader = styled(Box)`
  background-color :#181818;
  color :#f1f1f1;
  padding :4px;
  border-radius: 4px;
  
  [data-theme="dark"] & {
    background-color: #f1f1f1;
    color :#181818;
  }
`
export const TopBoxContent = styled(Box)`
  padding :8px;
`
export const StyledGrid = styled(Grid)`
  border-bottom: 1px solid #181818;
  border-right: 1px solid #181818;
  padding :8px;
  margin :0;
  font-size: 0.7em;
  text-align: center;
`
export const ScoreType = styled(Typography)`
  line-height: 3em;
  font-size: 1.3em;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};
`
export const ScoreTail = styled(Typography)`
  color: #999;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};
`
export const CompareType = styled(Typography)`
  color :#4ce600;
  font-size :0.8em;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};
`
export const UserType = styled(Typography)`
    line-height :3em;
    font-size :1.25em;
    text-shadow: ${shadow};
`
export const RankType = styled(Typography)`
    font-size: 2em;
    font-weight: 200;
    font-family: "Kulim Park","cursive";
    text-shadow: ${shadow};
`
export const RankEdge = styled(Typography)`
    color: #999;
    text-shadow: ${shadow};
`
export const RankPointType = styled(Typography)`
    color: #555;
    font-size: 0.7em;
`
export const RecordContainer = styled(Grid).attrs(props => ({$rank: props.rank}))`
    border-left: 10px solid ${props => rankColor(props.$rank, 1)};
    border-bottom: 1px solid ${props => rankColor(props.$rank, 1)};
    background-color: ${props => rankColor(props.$rank, 0)};
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 10px;
    text-align: center;
    box-shadow: -3px 1px 4px ${props => rankColor(props.$rank, 1)};
`