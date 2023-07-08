import {Box, Grid, MenuItem, Select, Typography, Button} from "@mui/material";
import styled, {createGlobalStyle} from "styled-components";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useTheme} from "next-themes";

// 汎用のカラースキーム
const colors = {
    dark: {
        front: "#e1e1e1",
        back: "#212121",
        subTitle: "#b6b6b6",
        subBack: "#3f4b54",
        hoverBack: "#2d3748",
        border: "#a7d1d5",
        compare: "#4ce600",
    },
    light: {
        front: "#282828",
        back: "#e1dbd5",
        subTitle: "#464646",
        subBack: "#c2a37c",
        hoverBack: "#2d3748",
        border: "#d99062",
        compare: "#e63600",
    }
}

// シリーズ別テーマカラー（フロント用）
const SeriesTheme = (series) => {
    switch (series) {
        case 1: // ピクミン1
            return '#6eb8ec'
        case 2: // ピクミン2
            return '#e86363'
        case 3: // ピクミン3/DX
            return '#39d961'
        case 4: // ピクミン4
            return '#e3cf37'
        case 7: // 期間限定
            return '#7c37e3'
        case 9: // その他
            return '#e1e1e1'
        default:
            return '#8546b7'
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
export const GlobalStyle = createGlobalStyle`

  body {
    color: ${colors.light.front};
    background-color: ${colors.light.back};
    font-family: "M PLUS 1 CODE", sans-serif;

    [data-theme='dark'] & {
      color: ${colors.dark.front};
      background-color: ${colors.dark.back};
    }
  }
  .title {
    font-size: 3.5em;
  }
  .mini-title {
    font-size: 2.5em;
  }
  .subtitle {
    color: ${colors.light.subTitle};

    [data-theme='dark'] & {
      color: ${colors.dark.subTitle};
    }
  }
  .active {
    background-color: ${colors.light.front} !important;
    color: ${colors.light.back} !important;

    [data-theme='dark'] & {
      background-color: ${colors.dark.front} !important;
      color: ${colors.dark.back} !important;
    }
  }
  .info-box {
    border: 1px solid ${colors.light.back};
    padding: 2em;
    margin: 2em;
    border-radius: 8px;

    [data-theme='dark'] & {
      border: 1px solid ${colors.dark.back};
    }
  }
  .form-helper-text {
    color: ${colors.light.front};
    
    [data-theme='dark'] & {
      color: ${colors.dark.front};
    }
  }
  .markdown-content {
    font-size: 1.0em;

    /* ユーザー作成のMarkdownをオーバライドするスタイル */
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
export const CustomMenuButton = styled(Button).attrs(props => ({$series: props.series}))`
  color: #d2d8e0;
  background-color: transparent;
  font-size: 0.9em;
  border-radius: 0;
  height: 64px;
  padding: 0 18px;
  border-bottom: 4px solid #000;

  &:hover {
    border-bottom: 4px solid ${props => SeriesTheme(props.$series)};
    background-color: #2d4448;
  }
`
export const RecordPostButton = styled(Box).attrs(props => ({$series: props.series}))`
  border-radius: 4px;
  padding: 12px;
  margin: 6px;
  svg {
    color: ${props => SeriesTheme(props.$series)};
  }
`
export const StyledSelect = styled(Select)`
    border: 1px solid ${colors.light.front};
    svg {
      color: ${colors.light.front};
    }
    [data-theme="dark"] & {
      border: 1px solid ${colors.dark.front};
      color: ${colors.dark.front};
      svg {
        color: ${colors.dark.front};
      }
    }
`
export const StyledMenuItem = styled(MenuItem)`
  font-family: "M PLUS 1 CODE", sans-serif;
`
export const InfoBox = styled(Box)`
  border :1px solid ${colors.light.border};
  padding :2em;
  margin :2em;
  border-radius :8px;
  
  [data-theme='dark'] & {
    border :1px solid ${colors.dark.border};
  }
`
export const RuleBox = styled(Box)`
  border-radius: 4px;
  padding: 12px;
  margin-right: 6px;
  background-color: ${colors.light.subBack};

  [data-theme="dark"] & {
    background-color: ${colors.dark.subBack};
  }
`
export const CellBox = styled(Box)`
  margin :4px;
  padding :2px;
  background-color: ${colors.light.subBack};
  border-radius :8px;
  text-align :center;

  [data-theme="dark"] & {
    background-color: ${colors.dark.subBack};
  }
`
export const StairIcon = styled(FontAwesomeIcon)`
  font-size :0.8em;
  margin :0 0.5em;
`
export const WrapTopBox = styled(Grid)`
  padding :10px;
`
export const TopBox = styled(Box)`
  border: 1px solid ${colors.light.border};
  border-radius: 4px;
  height: 100%;

  [data-theme='dark'] & {
    border: 1px solid ${colors.dark.border};
  }
`
export const TopBoxHeader = styled(Box)`
  background-color: ${colors.light.border};
  color: ${colors.light.back};
  padding :4px;
  border-radius: 4px;
  
  [data-theme="dark"] & {
    background-color: ${colors.dark.border};
    color : ${colors.dark.back};
  }
`
export const TopBoxContent = styled(Box)`
  padding :8px;
`
export const StyledGrid = styled(Grid)`
  border-bottom: 1px solid ${colors.light.border};
  border-right: 1px solid ${colors.light.border};
  padding :8px;
  margin :0;
  font-size: 0.7em;
  text-align: center;

  [data-theme="dark"] & {
    border-bottom: 1px solid ${colors.dark.border};
    border-right: 1px solid ${colors.dark.border};
  }
`
export const ScoreType = styled(Typography)`
  line-height: 3em;
  font-size: 1.3em;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};
`
export const ScoreTail = styled(Typography)`
  color: ${colors.light.subTitle};
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};

  [data-theme='dark'] & {
    color: ${colors.dark.subTitle};
  }
`
export const CompareType = styled(Typography)`
  color: ${colors.light.compare};
  font-size :0.8em;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};
  
  [data-theme='dark'] & {
    color: ${colors.dark.compare};
  }
`
export const UserType = styled(Typography)`
    line-height :3em;
    font-size :1.25em;
    text-shadow: ${shadow};
    font-family: "M PLUS 1 CODE", sans-serif;
`
export const RankType = styled(Typography)`
    font-size: 2em;
    font-weight: 200;
    font-family: "Kulim Park","cursive";
    text-shadow: ${shadow};
`
export const RankEdge = styled(Typography)`
  color: ${colors.light.subTitle};
  text-shadow: ${shadow};
  [data-theme='dark'] & {
    color: ${colors.dark.subTitle};
  }
`
export const RankPointType = styled(Typography)`
  color: ${colors.light.subTitle};
  font-size: 0.7em;

  [data-theme="dark"] & {
    color: ${colors.dark.subTitle};
  }
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
export const AuthWindow = styled(Grid)`
  background-color: ${colors.light.back};
  opacity: 0.85;
  color: ${colors.light.front};
  padding: 60px;
  border-radius: 8px;
  
  [data-theme='dark'] & {
    color: ${colors.dark.front};
    background-color: ${colors.dark.back};
  }
`
export const StageListBox = styled(Box)`
  background-color: ${colors.light.subBack};
  border-radius: 6px;
  padding: 6px;
  margin: 2px;
  min-height: 6em;
  font-size: 0.8em;

  [data-theme='dark'] & {
    background-color: ${colors.dark.subBack};
  }
`
export const PageHeader = styled(Box)`
  margin-bottom: 20px;
`