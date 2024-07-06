import {Box, Grid} from "@mui/material";
import Rules from "../rule/Rules";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css";
import Link from "next/link";
import RecordPost from "../modal/RecordPost";
import * as React from "react";
import {useLocale} from "../../lib/pik5";
import ModalKeyword from "../modal/ModalKeyword";
import {useState} from "react";

export default function RuleList({param}){

    const {t} = useLocale()

    return (
        <>
            <Box style={{margin:"0px 0"}}>
                <Grid container style={{
                    marginTop:"8px",
                    marginBottom:"12px"
                }}>
                    {
                        // 通常ステージの場合はステージに含まれるルールをすべて表示
                        (param.rule < 90) ?
                            <Rules props={param}/>

                            // 特殊ステージの場合は総合ランキングへのリンクを表示
                            : (param.rule > 150901) ?
                                <RuleWrapper item>
                                    <RuleBox className={"active"}
                                             component={Link}
                                             href={'/limited/'+param.rule}>
                                        {t.limited[param.rule]}
                                    </RuleBox>
                                </RuleWrapper>

                                // 上記どちらも当てはまらない場合はルールボックスを表示しない
                                :
                                <></>
                    }
                </Grid>
            </Box>
        </>
    )
}