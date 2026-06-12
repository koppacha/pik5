import {Box, Grid} from "@mui/material";
import Rules from "../rule/Rules";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css";
import Link from "next/link";
import RecordPost from "../modal/RecordPost";
import * as React from "react";
import {useLocale} from "../../lib/pik5";
import ModalKeyword from "../modal/ModalKeyword";
import {useState} from "react";
import {additionalStageRules, seriesNavigationRules} from "../../lib/const";
import {SPECIAL_STAGES_RULE} from "./SpecialStages";

export default function RuleList({param, displayedRule, onConventionalRuleClick, onAdditionalRuleClick}){

    const {t} = useLocale()
    const isSpecialCategory = Number(param.rule) === 91
    const additionalRules = isSpecialCategory
        ? seriesNavigationRules[Number(param.info?.series)] ?? []
        : additionalStageRules(param.info)
    const specialStagesRule = (
        <Grid className="rule-wrapper" item>
            <Box
                className={`rule-box ${displayedRule === SPECIAL_STAGES_RULE ? "active" : "not-active"}`}
                onClick={isSpecialCategory
                    ? event => onConventionalRuleClick?.(event, SPECIAL_STAGES_RULE)
                    : () => onAdditionalRuleClick(SPECIAL_STAGES_RULE)}
            >
                {t.g.specialStages}
            </Box>
        </Grid>
    )

    return (
        <>
            <Box style={{margin:"0px 0"}}>
                <Grid container style={{
                    marginTop:"8px",
                }}>
                    {
                        // 通常ステージの場合はステージに含まれるルールをすべて表示
                        (param.rule < 100 && Number(param.info?.series) >= 1 && Number(param.info?.series) <= 4) ?
                            <>
                                {!isSpecialCategory && <Rules
                                    props={param}
                                    displayedRule={displayedRule}
                                    onRuleClick={onConventionalRuleClick}
                                />}
                                {isSpecialCategory && specialStagesRule}
                                <Grid
                                    item
                                    aria-hidden="true"
                                    style={{paddingRight: "0.4em", fontSize: "1.4em", color: "var(--color-text-base)", alignContent: "center"}}
                                >
                                    |
                                </Grid>
                                {additionalRules.map(rule => (
                                    <Grid className="rule-wrapper" item key={rule}>
                                        <Box
                                            className={`rule-box ${Number(displayedRule) === rule ? "active" : "not-active"}`}
                                            onClick={() => onAdditionalRuleClick(rule)}
                                        >
                                            {t.rule[rule]}
                                        </Box>
                                    </Grid>
                                ))}
                                {!isSpecialCategory && specialStagesRule}
                            </>

                            // 特殊ステージの場合は総合ランキングへのリンクを表示
                            : (param.rule > 150901) ?
                                <Grid className="rule-wrapper" item>
                                    <Box className={"rule-box active"}
                                             component={Link}
                                             href={'/limited/'+param.rule}>
                                        {t.limited[param.rule]}
                                    </Box>
                                </Grid>

                                // 上記どちらも当てはまらない場合はルールボックスを表示しない
                                :
                                <></>
                    }
                </Grid>
            </Box>
        </>
    )
}
