import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {styled} from "@mui/material/styles";
import {useLocale} from "../plugin/pik5";

const RuleBox = styled(Box)`
  border :1px solid #fff;
  border-radius :4px;
  padding :12px;
  margin :6px;
`

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
        rules.push(20, 23, 26, 27, 28)
    }
    if(parent === 22){
        if(info.stage_id !== 216 && info.stage_id !== 223){
            // スプレー縛り（食神のかまど、ひみつの花園は除外）
            rules.push(20, 24, 26, 27, 28)
        } else {
            // 食神のかまど、ひみつの花園
            rules.push(20, 26, 27, 28)
        }
    }
    if(info.series === 3 && parent !== 35){
        rules.push(30, 34)
    }
    return (
        <>
        {
            rules.map(val =>
                <Grid item sx={{
                    marginBottom:"30px",
                }}>
                    <RuleBox sx={{
                        backgroundColor:(Number(rule) === val)? "#fff" : "",
                        color:(Number(rule) === val)? "#000" : "",
                    }}
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