import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {styled} from "@mui/material/styles";

const RuleBox = styled(Box)`
  border :1px solid #fff;
  border-radius :4px;
  padding :12px;
  margin :6px;
`

export default function UserScoreTable(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    return (
        <>
            a
        </>
    )
}