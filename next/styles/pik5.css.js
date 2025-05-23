import {
    Box,
    Grid,
    MenuItem,
    Select,
    Typography,
    Button,
    AppBar,
    Container,
    Paper,
    ListItem,
    ListItemButton
} from "@mui/material";
import styled, {createGlobalStyle, css} from "styled-components";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useTheme} from "next-themes";
import DialogContent from "@mui/material/DialogContent";
import {rankColor} from "../lib/pik5";
import TextField from "@mui/material/TextField";

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
        back: "#e7e7e7",
        subTitle: "#464646",
        subBack: "#9b9b9b",
        hoverBack: "#2d3748",
        border: "#444444",
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
    font-size: 2.25em;
    color: ${colors.light.subTitle};

    ${sp`font-size: 1.3em`}

    [data-theme='dark'] & {
      color: ${colors.dark.subTitle};
    }
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
      ${sp`display: none`}
  }
  
  .pc-hidden {
      ${pc`display: none`}
  }

  .mini-content {
      color: ${colors.light.subTitle};
      font-size: 0.8em;

      [data-theme='dark'] & {
          color: ${colors.dark.subTitle};
      }
  }
  
  .markdown-content {
    
    /* Markdownをオーバライドするスタイル */
    code {
      font-family: "M PLUS 1 CODE", sans-serif;
    }

    h2, h3, h4, h5, h6 {
      margin-top: 1em;
    }

    li {
      margin-top: 0.33em;
      margin-left: 3em;
    }

    ul, ol {
      padding: 0.5em 0;
    }

    strong {
      font-size: 1.1em;
      color: #f7fafc;
    }

    table {
      table-layout: fixed;
      border-collapse: collapse;
    }

    td, th {
      padding: 8px;
      border: 1px solid #4a5568;
    }
    a {
      text-decoration: underline;
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
  font-family: "M PLUS 1 CODE", sans-serif;
  color: #d2d8e0;
  background-color: transparent;
  font-size: 0.9em;
  border-radius: 0;
  height: 64px;
  padding: 0 18px;
  border-bottom: 4px solid #000;
  max-width: 210px;
  
  ${sp`font-size: 0.7em;`}

  &:hover {
    border-bottom: 4px solid ${props => SeriesTheme(props.$series)};
    background-color: #2d4448;
  }
`
export const AuthButton = styled(Button)`
    font-family: "M PLUS 1 CODE", sans-serif;
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
export const CustomButton = styled(Button)`
    font-family: "M PLUS 1 CODE", sans-serif;
    color: ${colors.light.back};
    background-color: ${colors.light.front};
    font-size: 0.9em;
    border-radius: 8px;
    height: 32px;
    line-height: 32px;
    padding: 0 18px;
    max-width: 210px;
    margin: 0.5em;
    
    [data-theme="dark"] & {
        color: ${colors.dark.back};
        background-color: ${colors.dark.front};
    }
`
export const StyledSelect = styled(Select)`
    max-width: 200px;
    max-height: 42px;
    margin-right: 10px;
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
export const StyledTextField = styled(TextField)`
    min-width: 200px;
    margin-right: 10px;
    border: 1px solid ${colors.light.front};
    border-radius: 4px;
    input {
        color: ${colors.light.front};
        padding: 6px;
    }
    label {
        color: ${colors.light.front};
    }
    svg {
      color: ${colors.light.front};
      font-size: 14px;
    }
    ${sp`font-size: 1em;`}
  
    [data-theme="dark"] & {
      border: 1px solid ${colors.dark.front};
      color: ${colors.dark.front};
      input {
          color: ${colors.dark.front};
      }
      label {
        color: ${colors.dark.front};
      }
      svg {
        color: ${colors.dark.front};
      }
    }
`
export const ThinAppBar = styled(AppBar)`
    background-color: #111;
  
    ${sp`display: none;`}
`
export const LeftAppBar = styled(Box)`
  @media(max-width: 1400px) {
    width: 1400px;
    overflow-x: scroll;
    white-space: nowrap;
  }
`
export const HeaderPopMenu = styled(Paper)`
  color: ${colors.dark.front};
  margin: 0 auto;
  width: 100vw;
  box-shadow: none;
  background-color: transparent;
`
export const StyledMenuItem = styled(MenuItem)`
  font-family: "M PLUS 1 CODE", sans-serif;
  border-left: 10px solid #f7fafc;
  background-color: #3a3a3a;
  overflow-x: hidden;
  
  &:hover {
    color: #111;
    background-color: #fff;
  }
`
export const InfoBox = styled(Box)`
  border :1px solid ${colors.light.border};
  padding :1em;
  margin :1em;
  font-size: 0.9em;
  border-radius :8px;
  a {
      text-decoration: underline;
  }
  [data-theme='dark'] & {
    border :1px solid ${colors.dark.border};
  }
`
export const RuleWrapper = styled(Grid)`
  margin-bottom: 10px;
  min-width: 1200px;
  overflow: scroll;
  white-space: nowrap;
  
  ${sp`margin-bottom: 15px;`}
`

export const RuleBox = styled(Grid)`
  border-radius: 4px;
  padding: 12px 6px;
  margin-right: 6px;
  cursor: pointer;
  background-color: ${colors.light.subBack};

  [data-theme="dark"] & {
    background-color: ${colors.dark.subBack};
  }
`
export const CellBox = styled(Box)`
  margin :4px;
  padding :4px;
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
  margin-bottom: 10px;
`
export const TopBox = styled(Box)`
  border: 1px solid ${colors.light.border};
  border-radius: 6px;
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
  display: flex;
  justify-content: space-between;
  
  span {
    display: inline-block;
  }
  
  [data-theme="dark"] & {
    background-color: ${colors.dark.border};
    color : ${colors.dark.back};
  }
`
export const TopBoxContent = styled(Box)`
  padding :8px;
`
export const TopBoxContentList = styled(Box)`
  font-size: 0.9em;
  padding-top :4px;
  padding-bottom :12px;
  border-bottom: 1px solid #777;
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
export const RecordGridWrapper = styled(Grid)`
  display: grid;
  place-items: center;
  width: 100%;
  border-right: 1px solid #777;
`
export const TeamScoreType = styled(Typography)`
  font-size: 800%;
  letter-spacing: 10px;
  line-height: 85%;
  font-family:"Proza Libre","cursive";

  ${sp`
    font-size: 500%;
  `}
`
export const TeamRpsType = styled(Typography)`
  font-size: 333%;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};
  color: ${colors.light.subTitle};

  ${sp`
    font-size: 222%;
  `}
  [data-theme='dark'] & {
      color: ${colors.dark.subTitle};
  }
`
export const ScoreType = styled(Typography)`
  font-size: 1.3em;
  font-family:"Proza Libre","cursive";
  text-shadow: ${shadow};

  ${sp`
    font-size: 0.9em;
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
    font-size :1.25em;
    text-shadow: ${shadow};
    font-family: "M PLUS 1 CODE", sans-serif;

    ${sp`
        font-size: 0.9em;
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
export const StageListWrapper = styled(Box).attrs(props => ({$count: props.count}))`

  margin-bottom: 2em;
  width: 100%;
  
  ${
    function (props) {
        // ステージ数が17個以上なら1200px以下表示時オーバーフロー領域をスクロール表示する
        if (props.$count > 16) {
            return css` 
                @media (max-width: 1200px) {
                    overflow: scroll;
                    white-space: nowrap;
                }
            `
        }
    }
  }
`
export const RenderStagesWrapper = styled(Box)`
  width: 100%;
  overflow-x: scroll;
  margin: 0;
`
export const StageListBox = styled(Box)`
  background-color: ${colors.light.subBack};
  border-radius: 6px;
  padding: 6px;
  margin: 2px;
  min-height: 5.5em;
  font-size: 0.8em;
  white-space: break-spaces;
  
  ${sp`font-size: 0.8em;`}

  [data-theme='dark'] & {
    background-color: ${colors.dark.subBack};
  }
`
export const MarkerTableCell = styled(Grid)`
  max-width: 92px;
  margin-right: 12px;
  font-size: 0.8em;
  text-align: center;
  min-height: 47px;
  line-height: 47px;
  border-bottom: 1px dotted #333;
  align-content: flex-start;
`
export const UserInfoBox = styled(StageListBox)`
  padding: 8px;
  min-height: 2em;
  span {
    color: #9d9d9d;
  }
`
export const UserInfoTotalBox = styled(StageListBox).attrs(props => ({$series: props.series}))`
  padding: 12px;
  margin-right: 6px;
  min-height: 2em;
  border-left: 6px solid ${props => SeriesTheme(props.$series)};
`
export const PageHeader = styled(Box)`
  margin-bottom: 20px;
  margin-top: 80px;
`
export const MobileFooterMenu = styled(Grid)`

  ${pc`display: none;`}
  
  position: fixed;
  width: 100vw;
  height: 62px;
  bottom: 0;
  background-color: #111;
  opacity: 0.9;
  padding-top: 6px;
  
  svg {
    font-size: 20px;
  }
  p {
    font-size: 0.85em;
  }
`
export const MobileFooterItem = styled(Grid)`
  justify-items: center;
  text-align: center;
  padding-top: 5px;
    
    [data-theme='light'] & {
        color: ${colors.light.back};
    }

`

export const MobileMenuBox = styled(Box)`
  width: 60vw;
  height: 100%;
  color: ${colors.light.front};
  background-color: ${colors.light.back};
  overflow-y: scroll;

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
  
  div, input, svg, label, p {
    color: ${colors.light.front};

    [data-theme='dark'] & {
      color: ${colors.dark.front};
    }
  }
`
export const SearchResultTag = styled(Typography).attrs(props => ({$color: props.color}))`
  font-size: 0.7em;
  border-radius: 4px;
  padding: 2px;
  margin: 2px;
  background-color: ${props => props.$color};
  color: #000;
`
export const SearchResultItem = styled(ListItem).attrs(props => ({$index: props.index}))`
  width: 100%;
  border-bottom: 1px solid #000;
  
  ${function (props) {
    if (props.$index === 0) {
        return css`
          background-color: #1a293b;
          color: #cfd2de;
        `
    }
}}
  
  &:hover {
    background-color: #1a293b;
    color: #cfd2de;
  }
  
  svg {
    margin-right: 0.5em;
  }
`
export const RankCell = styled(Grid).attrs(props => ({$rank: props.rank, $series: props.series}))`
  width: ${props => props.$series < 10 ? "7px" : "14px"};
  height: ${props => props.$series < 10 ? "7px" : "14px"};
  margin-right: 1px;
  margin-bottom: 1px;
  border-radius: 2px;
`
export const EventContainer = styled(Box)`
  width: 100%;
  margin-bottom: 0.75em;
  display: flex;
  align-items: stretch;
`
export const EventDate = styled(Box).attrs(props => ({$week: props.week}))`
  text-align: center;
  border-radius: 4px;
  padding: 4px 8px;
  width: 80px;
  height: 100%;
  background-color: ${colors.light.subBack};

  [data-theme="dark"] & {
    background-color: ${colors.dark.subBack};
  }

  .month {
    font-size: 0.8em;
    vertical-align: top;
  }

  .date {
    font-size: 1.5em;
  }

  .week {
    font-size: 0.8em;
    color: #8c8c8c;
  }
`
export const EventContent = styled(Box)`
  font-size: 0.9em;
  padding: 0 8px;
  width: 100%;
  color: ${colors.light.subTitle};

  [data-theme="dark"] & {
    color: ${colors.dark.subTitle};
  }
  
  a {
    text-decoration: underline;
  }
  strong {
    font-size: 1.2em;

    color: ${colors.light.front};

    [data-theme="dark"] & {
      color: ${colors.dark.front};
    }

  }
`
export const CompareIcon = styled(Typography)`
    margin-right: 4px;
    padding :0 4px;
    background-color :#eee;
    border-radius :4px;
    color :#111;
    font-size: 1em;
    display: inline-block;
`

export const CustomListItemButton = styled(ListItemButton)`
    text-align: right;
`