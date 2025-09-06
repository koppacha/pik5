import {Box, Grid} from "@mui/material";
import Rules from "../rule/Rules";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css";
import Link from "next/link";
import RecordPost from "../modal/RecordPost";
import * as React from "react";
import {rule2consoles, useLocale} from "../../lib/pik5";
import ModalKeyword from "../modal/ModalKeyword";
import {useState} from "react";
import Consoles from "../rule/Consoles";

export default function ConsoleList({param}){

    const {t} = useLocale()
    const consoleList = rule2consoles(param.rule)

    // 操作方法が２つ未満の場合は何も表示しない
    if(consoleList.length < 2) return <></>

    return (
        <>
            <Box style={{marginTop:"20px"}}>
                <div className="cell-box" style={{width:"14em"}}>操作方法別トップ記録</div>
                <Grid container>
                    {
                        consoleList.map((console, index) => (
                            <Consoles users={param.users} console={console} stage={param.stage} rule={param.rule} year={param.year}/>
                        ))
                    }
                </Grid>
            </Box>
        </>
    )
}