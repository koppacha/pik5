import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {styled} from "@mui/material/styles";

const TotalBox = styled(Box)`
  border :1px solid #fff;
  border-radius :4px;
  padding :12px;
  margin :6px;
`

export default function Totals(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const totals = []

    switch(props.info.series) {
        case 1:
            totals.push(10, 11)
            break
        case 2:
            totals.push(20, 21, 22, 23, 24, 25, 26, 27, 28, 29)
            break
        case 3:
            totals.push(30, 31, 32, 33, 34, 35)
            break
        case 4:
            totals.push(40)
            break
        default:
            totals.push(1, 2, 3, 4)
    }

    return (
        <>
        {
            totals.map(val =>
                <Grid item sx={{
                    marginBottom:"30px"
                }}>
                    <TotalBox sx={{
                        backgroundColor:(Number(props.series) === val) ? "#fff" : "",
                        color:(Number(props.series) === val) ? "#000" : "#fff",
                    }}
                         component={Link}
                         href={'/total/'+val+'/'+props.console+'/'+val+'/'+props.year}>
                        {t.rule[val]}
                    </TotalBox>
                </Grid>
            )
        }
        </>
    )
}