import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {styled} from "@mui/material/styles";
import {range} from "../plugin/pik5";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faMinus} from "@fortawesome/free-solid-svg-icons";

const StyledGrid = styled(Grid)`
  border-bottom: 1px solid #fff;
  border-right: 1px solid #fff;
  padding :8px;
  margin :0;
  font-size: 0.7em;
  text-align: center;
`

export default function UserScoreTable(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const ruleList = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29]
    const consoleList = [0, 1, 2]

    return (
        <>
            <Grid container justifyContent="space-between" sx={{
                marginTop:"20px"
            }}>
                <StyledGrid item xs={2}>
                ピクミン2
                </StyledGrid>
                {
                    ruleList.map(rule =>
                        (
                            <StyledGrid item xs={1}>
                                {t.rule[rule]}
                            </StyledGrid>
                        )
                    )
                }
            </Grid>
            <Grid container justifyContent="space-between" sx={{
                margin:"0"
            }}>
                <StyledGrid item xs={2}>
                    NGCコントローラー
                </StyledGrid>
                {
                    ruleList.map(rule =>
                        (
                            <StyledGrid item xs={1}>
                                700,245pts.<br/>
                                1位 /112
                            </StyledGrid>
                        )
                    )
                }
            </Grid>
        </>
    )
}