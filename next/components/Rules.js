import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useLocale} from "../lib/pik5";
import {b, RuleBox} from "../styles/pik5.css"

export default function Rules(props){

    const { info, rule, console, year } = props.props
    
    const {t} = useLocale()
    
    // 取得対象が総合ランキングの場合はparentを置換する
    const parent = (info.parent < 10) ? info.stage_id : info.parent
    const rules = [parent]

    // ステージによってルール配列を操作
    if(info.series === 1){
        // ピクミン１＝Wii・NGC、全回収タイムアタック
        rules.push(11)
    }
    if(parent === 21){
        // ピクミン２：タマゴムシ縛り
        rules.push(23, 26, 27, 28)
    }
    if(parent === 22){
        if(info.stage_id !== 216 && info.stage_id !== 223){
            // スプレー縛り（食神のかまど、ひみつの花園は除外）
            rules.push(24, 26, 27, 28)
        } else {
            // 食神のかまど、ひみつの花園
            rules.push(26, 27, 28)
        }
    }
    if(info.series === 3 && parent !== 35){
        rules.push(34)
    }
    return (
        <>
        {
            rules.map(val =>
                <Grid item style={{
                    marginBottom:"20px",
                }}>
                    <RuleBox className={(Number(rule) === val)&&"active"}
                         component={Link}
                         href={'/'+info.type+'/'+info.stage_id+'/'+console+'/'+val+'/'+year}>
                        {t.rule[val]}
                    </RuleBox>
                </Grid>
            )
        }
        </>
    )
}