import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {styled} from "@mui/material/styles";
import {useLocale} from "../../lib/pik5";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css";
import {stageUrlOutput} from "../../lib/factory";

export default function Totals(props){

    const { series, consoles, info, year } = props.props

    const {t} = useLocale()

    const totals = []

    switch(info.series) {
        case 1:
            totals.push(10, 11)
            break
        case 2:
            totals.push(20, 21, 22, 23, 24, 25, 26, 27, 28, 29)
            break
        case 3:
            totals.push(30, 31, 32, 33, 36, 34, 35)
            break
        case 4:
            totals.push(40, 41, 42, 43, 44, 45, 46, 47)
            break
        default:
            totals.push(1, 2, 3) // TODO: 期間限定を解禁したら4以降を追加する
    }

    return (
        <Box style={{overflowX: 'auto', whiteSpace: 'nowrap'}}>
            <Grid container className="rule-wrapper" wrap="nowrap">
            {
                totals.map(val =>
                    <Grid item key={val} className={`rule-box ${(Number(series) === val)&&"active"}`}
                         component={Link}
                         href={'/total/'+stageUrlOutput(val, consoles, val, year, val)}>
                        {(info.series === 4) ? t.ru[val] : t.rule[val]}
                    </Grid>
                )
            }
            </Grid>
        </Box>
    )
}