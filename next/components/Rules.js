import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";

export default function Rules(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    // 取得対象が総合ランキングの場合はparentを置換する
    const parent = (props.info.parent < 10) ? props.info.stage_id : props.info.parent
    const rules = [parent]

    // ステージによってルール配列を操作
    if(props.info.series === 1){
        // ピクミン１＝Wii・NGC、全回収タイムアタック
        rules.push(11)
    }
    if(parent === 21){
        // ピクミン２：タマゴムシ縛り
        rules.push(23, 26, 27, 28)
    }
    if(parent === 22){
        if(props.info.stage_id !== 216 && props.info.stage_id !== 223){
            // スプレー縛り（食神のかまど、ひみつの花園は除外）
            rules.push(24, 26, 27, 28)
        } else {
            // 食神のかまど、ひみつの花園
            rules.push(26, 27, 28)
        }
    }
    if(props.info.series === 3 && parent !== 35){
        rules.push(34)
    }


    return (
        <Grid container>
            {
                rules.map(val =>
                    <Grid item>
                        <Box sx={{
                            border:"1px solid #fff",
                            borderRadius:"4px",
                            padding:"12px",
                            margin: "6px",
                            backgroundColor:(Number(props.rule) === val)? "#fff" : "",
                            color:(Number(props.rule) === val)? "#000" : "",
                        }}
                             component={Link}
                             href={'/'+props.info.type+'/'+props.info.stage_id+'/'+props.console+'/'+val+'/'+props.year}>
                            {t.rule[val]}
                        </Box>
                    </Grid>
                )
            }
        </Grid>
    )
}