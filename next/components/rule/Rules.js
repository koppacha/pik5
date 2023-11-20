import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useLocale} from "../../lib/pik5";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css"

export default function Rules(props){

    const { info, rule, consoles:console, year } = props.props
    
    const {t} = useLocale()
    
    // 取得対象が総合ランキングの場合はparentを置換する
    const parent = (info?.parent < 10) ? info?.stage_id : info?.parent
    const rules = [parent]

    // ステージによってルール配列を操作
    if(info?.series === 1){
        // ピクミン１＝Wii・NGC、全回収タイムアタック
        rules.push(11)
    }
    if(parent === 21){
        // ピクミン２：タマゴムシ縛り
        rules.push(23, 26, 27, 28)
    }
    if(parent === 22){
        if(![209, 214, 216, 223].includes(info.stage_id)){
            // スプレー縛り（花園を荒らすもの、ショイグモの巣、食神のかまど、ひみつの花園は除外）
            rules.push(24, 26, 27, 28)
        } else {
            // スプレーもタマゴも無いステージ
            rules.push(26, 27, 28)
        }
    }
    if(info?.series === 3 && parent !== 35){
        rules.push(34)
    }
    // 通常ルールの場合とそれ以外で表示名を分岐する
    const normalRankings = [10, 21, 22, 31, 32, 33, 36, 41, 42, 43]

    return (
        <>
        {
            rules.map(function(val){

                const screenName = (normalRankings.includes(val)) ? t.rule[0] : t.rule[val]

                return (
                    <RuleWrapper item key={val}>
                        <RuleBox className={(Number(rule) === val)&&"active"}
                                 component={Link}
                                 href={'/'+info?.type+'/'+info?.stage_id+'/'+console+'/'+val+'/'+year}>
                            {screenName}
                        </RuleBox>
                    </RuleWrapper>
                )
            })
        }
        </>
    )
}