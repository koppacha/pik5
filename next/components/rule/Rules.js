import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useLocale} from "../../lib/pik5";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css"
import {stageRules} from "../../lib/const";

export default function Rules({props, displayedRule = null, onRuleClick = null}){

    const { info, rule, consoles:console, year } = props
    
    const {t} = useLocale()
    const rules = stageRules(info)

    // 通常ルールの場合とそれ以外で表示名を分岐する
    const normalRankings = [10, 21, 22, 31, 32, 33, 36, 41, 42, 43]

    return (
        <>
        {
            rules.map(function(val){

                const screenName = (normalRankings.includes(val)) ? t.rule[0] : t.rule[val]

                return (
                    <Grid className="rule-wrapper" item key={val}>
                        <Box className={`rule-box ${(Number(displayedRule) === val) ? "active" : "not-active"}`}
                                 component={Link}
                                 href={'/'+info?.type+'/'+info?.stage_id+'/'+console+'/'+val+'/'+year}
                                 onClick={(event) => onRuleClick?.(event, val, Number(displayedRule) === val)}>
                            {screenName}
                        </Box>
                    </Grid>
                )
            })
        }
        </>
    )
}
