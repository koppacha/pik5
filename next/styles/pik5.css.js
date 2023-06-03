import {Box, MenuItem, Select} from "@mui/material";
import styled, {createGlobalStyle} from "styled-components";
import Link from "next/link";

export const GlobalStyle = createGlobalStyle`
  :root {
    --fg: #000;
    --bg: #fff;
    font-family: "M PLUS 1 CODE", sans-serif;

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
      border :1px solid #fff;
      padding :2em;
      margin :2em;
      border-radius :8px;
    }
  }

  [data-theme="dark"] {
    --fg: #fff;
    --bg: #000;
  }
`
export const StyledSelect = styled(Select)`
    color: #fff;
    border: 1px solid #fff;
    svg {
    color: #fff;
    }
`
export const StyledMenuItem = styled(MenuItem)`
  font-family: "M PLUS 1 CODE", sans-serif;
`

export const InfoBox = styled(Box)`
  border :1px solid #fff;
  padding :2em;
  margin :2em;
  border-radius :8px;
`
export const RuleBox = styled(Box)`
  border :1px solid #fff;
  border-radius :4px;
  padding :12px;
  margin-right :6px;
`
