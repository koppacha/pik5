import {Box, Grid, MenuItem, Select} from "@mui/material";
import styled, {createGlobalStyle} from "styled-components";
import {useTheme} from "next-themes";
import Styled from "styled-components";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

// 複数のスタイルドコンポーネントにまたがって使うスタイル
function b(){

    const {theme} = useTheme()

    if(theme === "dark") {
        return {
            color: "#fff",
            background: "#000",
        }
    } else {
        return {
            color: "#000",
            back: "#fff",
        }
    }
}

export const GlobalStyle = createGlobalStyle`

  body {
    color: #282828;
    background-color: #e0e0e0;
    font-family: "M PLUS 1 CODE", sans-serif;

    [data-theme="dark"] & {
      color: #e1e1e1;
      background-color: #111111;
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

  .pikmin1 {
    color: #000;
    background-color: #ec9d6e;
  }

  .pikmin2 {
    color: #000;
    background-color: #e86363;
  }

  .pikmin3 {
    color: #000;
    background-color: #39d961;
  }

  .pikmin4 {
    color: #000;
    background-color: #e3cf37;
  }

  .info-box {
    border: 1px solid #000;
    padding: 2em;
    margin: 2em;
    border-radius: 8px;
  }

  .active {
    color: #cecece;
    background-color: #383838;

    [data-theme="dark"] & {
      color: #000;
      background-color: #e3e3e3;
    }
  }
`
export const StyledSelect = styled(Select)`
    color: ${b.color};
    border: 1px solid ${b.color};
    svg {
    color: ${b.color};
    }
`
export const StyledMenuItem = styled(MenuItem)`
  font-family: "M PLUS 1 CODE", sans-serif;
`

export const InfoBox = styled(Box)`
  border :1px solid ${b.color};
  padding :2em;
  margin :2em;
  border-radius :8px;
`
export const RuleBox = styled(Box)`
  border :1px solid ${b.color};
  border-radius :4px;
  padding :12px;
  margin-right :6px;
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
  border :1px solid ${b.color};
  border-radius :4px;
  padding :12px;
  margin :6px;
`
export const StairIcon = Styled(FontAwesomeIcon)`
    font-size :0.8em;
    color :#777;
    margin :0 0.5em;
`
export const WrapTopBox = styled(Grid)`
  padding :10px;
`
export const TopBox = styled(Box)`
  border: 1px solid #777;
  border-radius: 4px;
  height: 100%;
`
export const TopBoxHeader = styled(Box)`
  background-color :${b.color};
  color :#000;
  padding :4px;
  border-radius: 4px;
`
export const TopBoxContent = styled(Box)`
  padding :8px;
`
export const StyledGrid = styled(Grid)`
  border-bottom: 1px solid ${b.color};
  border-right: 1px solid ${b.color};
  padding :8px;
  margin :0;
  font-size: 0.7em;
  text-align: center;
`