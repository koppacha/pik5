import {Box, Grid, MenuItem, Select} from "@mui/material";
import styled, {createGlobalStyle} from "styled-components";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

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
  .form-helper-text {
    color: #1a202c;

    [data-theme="dark"] & {
      color: #e2e8f0;
    }
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
  border :1px solid #777;
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