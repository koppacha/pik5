import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {styled} from "@mui/material/styles";
import {useLocale} from "../../lib/pik5";
import {RuleBox} from "../../styles/pik5.css";

export default function Totals(props){

    const { series, console, info, year } = props.props

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
            totals.push(40, 41, 42, 43)
            break
        default:
            totals.push(1, 2, 3) // TODO: 期間限定を解禁したら4以降を追加する
    }

    return (
        <>
        {
            totals.map(val =>
                <Grid item key={val} style={{
                    marginBottom:"30px"
                }}>
                    <RuleBox className={(Number(series) === val)&&"active"}
                         component={Link}
                         href={'/total/'+val+'/'+console+'/'+val+'/'+year}>
                        {t.rule[val]}
                    </RuleBox>
                </Grid>
            )
        }
        </>
    )
}