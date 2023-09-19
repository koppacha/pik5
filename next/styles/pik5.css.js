import {Box, Grid, MenuItem, Select, Typography, Button, AppBar, Container, Paper} from "@mui/material";
import styled, {createGlobalStyle, css} from "styled-components";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useTheme} from "next-themes";
import DialogContent from "@mui/material/DialogContent";

// 汎用のカラースキーム
const colors = {
    dark: {
        front: "#e1e1e1",
        back: "#212121",
        subTitle: "#b6b6b6",
        subBack: "#3f454b",
        hoverBack: "#2d3748",
        border: "#c7d8da",
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
export const SeriesTheme = (series) => {
    switch (series) {
        case 1: // ピクミン1
            return '#6eb8ec'
        case 2: // ピクミン2
            return '#e86363'
        case 3: // ピクミン3/DX
            return '#39d961'
        case 4: // ピクミン4
            return '#e3cf37'
        case 5: // 期間限定
            return '#7c37e3'
        case 6: // 本編RTA
            return '#e337ad'
        case 7: // ピクミンキーワード
            return '#37cfe3'
        case 8: // Discord
            return '#3796e3'
        case 9: // その他
            return '#ababab'
        default:
            return '#ffffff'
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
const rankColor = (rank, team, target = 0) => {
    const {theme} = useTheme()
    const t = Number(team)
    const r = Number(rank)
    if(t === 0 || target === 0){
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
    } else {
        const teamColor = ['',
            '#19acff', '#ff3919', '#eeeeee', '#b419ff',
            '#ff63f2', '#e3e3e3', '#f3524c', '#8ba9ff',
            '#e0e0e0', '#010101', '#45aee6', '#e6d745',
            '#e6456c', '#e6b945', '#45e675', '#dce645',
            '#457de6', '#e69345', '#e64575', '#455ae6']

        return teamColor[t]
    }
}

// スマホとPCのブレイクポイントを定義（TODO:MUIv4で使えない場合は専用クラスを使う）
const sp = (first, ...interpolations) => css`
  @media (max-width: 600px) {
    ${css(first, ...interpolations)}
  }
`
const pc = (first, ...interpolations) => css`
  @media (min-width: 601px) {
    ${css(first, ...interpolations)}
  }
`
export const GlobalStyle = createGlobalStyle`

  body {
    color: ${colors.light.front};
    background-color: ${colors.light.back};
    font-family: "M PLUS 1 CODE", sans-serif;

    ${sp`font-size: 0.8em`}
    
    [data-theme='dark'] & {
      color: ${colors.dark.front};
      background-color: ${colors.dark.back};
    }
  }

  .title {
    font-size: 3.5em;
    font-family: "M PLUS 1 CODE", sans-serif;
    
    ${sp`font-size: 2em`}
  }

  .mini-title {
    font-size: 2.5em;

    ${sp`font-size: 1.3em`}
  }

  .subtitle {
    color: ${colors.light.subTitle};

    [data-theme='dark'] & {
      color: ${colors.dark.subTitle};
    }
  }
  .hidden {
    display: none;
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
    div, input, label {
      color: ${colors.light.front};
    }
    
    [data-theme='dark'] & {
      color: ${colors.dark.front};
      div, input, label {
        color: ${colors.dark.front};
      }

    }
  }
  .sp-hidden {
      display: none;
  }
  .markdown-content {
    font-size: 1.0em;
    color: #9fb5bd;

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

    strong {
      font-size: 1.1em;
      color: #f7fafc;
    }
  }
`
export const OffsetContainer = styled(Container)`

  max-width: 1200px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 0;
  
  ${pc`margin-top: 80px;`}
`
export const CustomMenuButton = styled(Button).attrs(props => ({$series: props.series}))`
  color: #d2d8e0;
  background-color: transparent;
  font-size: 0.9em;
  border-radius: 0;
  height: 64px;
  padding: 0 18px;
  border-bottom: 4px solid #000;
  
  ${sp`font-size: 0.7em;`}

  &:hover {
    border-bottom: 4px solid ${props => SeriesTheme(props.$series)};
    background-color: #2d4448;
  }
`
export const RecordPostButton = styled(Box).attrs(props => ({$series: props.series}))`
  border-radius: 4px;
  padding: 12px;
  margin: 6px;
  cursor: pointer;
`
export const AuthButton = styled(Button)`
  background-color: #cfd2de;
  color: #1a293b;
  font-weight: bold;
  border-radius: 8px;
  padding: 4px 12px;
  &:hover {
    background-color: #1a293b;
    color: #cfd2de;
  }
`
export const StyledSelect = styled(Select)`
    max-width: 200px;
    border: 1px solid ${colors.light.front};
    svg {
      color: ${colors.light.front};
      font-size: 14px;
    }
    ${sp`font-size: 1em;`}
  
    [data-theme="dark"] & {
      border: 1px solid ${colors.dark.front};
      color: ${colors.dark.front};
      svg {
        color: ${colors.dark.front};
      }
    }
`
export const ThinAppBar = styled(AppBar)`
    background-color: #111;

    ${sp`display: none;`}
`
export const HeaderPopMenu = styled(Paper)`
  color: ${colors.dark.front};
  margin: 0 auto;
  width: 90vw;
  box-shadow: none;
  background-color: transparent;
`
export const StyledMenuItem = styled(MenuItem)`
  font-family: "M PLUS 1 CODE", sans-serif;
  border-left: 10px solid #f7fafc;
  background-color: #3a3a3a;
  
  &:hover {
    color: #111;
    background-color: #fff;
  }
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
export const RuleWrapper = styled(Grid)`
  margin-bottom: 20px;
  
  ${sp`margin-bottom: 30px;`}
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
  
  ${sp`font-size: 0.7em;`}
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
  line-height: 80px;
  font-size: 1.3em;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};

  ${sp`
    font-size: 1.1em;
    line-height: 2.5em;
  `}
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
export const UserType = styled(Typography).attrs(props => ({$length: props.length}))`
    line-height :80px;
    font-size :1.25em;
    text-shadow: ${shadow};
    font-family: "M PLUS 1 CODE", sans-serif;

    ${sp`
        font-size: 1em;
        line-height :40px;
    `}

    ${function (props) {
        if (props.$length > 12) {
            return css`font-size: 1em;`
        }
    }}
`
export const RankType = styled(Typography)`
    font-size: 2em;
    line-height :2em;
    font-weight: 200;
    font-family: "Kulim Park","cursive";
    text-shadow: ${shadow};

    ${sp`font-size: 1.2em;`}

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
  
  ${sp`font-size: 0.5em;`}

  [data-theme="dark"] & {
    color: ${colors.dark.subTitle};
  }
`
export const RecordContainer = styled(Grid).attrs(props => ({$rank: props.rank, $team: props.team}))`
  
    border-left: 10px solid ${props => rankColor(props.$rank, props.$team, 1)};
    border-bottom: 1px solid ${props => rankColor(props.$rank, props.$team, 1)};
    background-color: ${props => rankColor(props.$rank, props.$team, 0)};
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 10px;
    text-align: center;
    box-shadow: -3px 1px 4px ${props => rankColor(props.$rank, props.$team, 1)};
`
export const BattleRecordContainer = styled(RecordContainer)`
  border-left: 1px solid;
  box-shadow: 0 0 4px;
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
  min-height: 5.5em;
  font-size: 0.8em;
  
  ${sp`font-size: 0.8em;`}

  [data-theme='dark'] & {
    background-color: ${colors.dark.subBack};
  }
`
export const PageHeader = styled(Box)`
  margin-bottom: 20px;
`
export const MobileFooterMenu = styled(Grid)`

  ${pc`display: none;`}
  
  position: fixed;
  width: 100vw;
  height: 70px;
  bottom: 0;
  background-color: #111;
  opacity: 0.85;
`
export const MobileFooterItem = styled(Grid)`
  justify-items: center;
  text-align: center;
  padding-top: 5px;
`

export const MobileMenuBox = styled(Box)`
  width: 60vw;
  color: ${colors.light.front};
  background-color: ${colors.light.back};

  [data-theme='dark'] & {
    color: ${colors.dark.front};
    background-color: ${colors.dark.back};
  }
`
export const StyledDialogContent = styled(DialogContent)`
  color: ${colors.light.front};
  background-color: ${colors.light.back};
  
  [data-theme='dark'] & {
    color: ${colors.dark.front};
    background-color: ${colors.dark.back};
  }
  div:before {
    color: ${colors.light.front};
    border-bottom: solid 1px ${colors.light.front};

    [data-theme='dark'] & {
      color: ${colors.dark.front};
      border-bottom: solid 1px ${colors.dark.front};
    }
  }
  div {
    margin-bottom: 10px;
  }
  
  div, input, svg, label {
    color: ${colors.light.front};

    [data-theme='dark'] & {
      color: ${colors.dark.front};
    }
  }
`