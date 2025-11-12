import {Box, Grid} from "@mui/material";
import Rules from "../rule/Rules";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css";
import Link from "next/link";
import RecordPost from "../modal/RecordPost";
import * as React from "react";
import {rule2consoles, useLocale} from "../../lib/pik5";
import ModalKeyword from "../modal/ModalKeyword";
import {useState} from "react";
import Difficulties from "../rule/Difficulties";

export default function DifficultyList({param}){

    const {t} = useLocale()
    const difficultyList = [1, 2, 3]

    return (
        <>
            <Box style={{marginTop:"20px"}}>
                <div className="cell-box" style={{width:"14em"}}>難易度別トップ記録</div>
                <Grid container>
                    {
                        difficultyList.map((difficulty, index) => (
                            <Difficulties key={index} users={param.users} difficulty={difficulty} consoles={param.consoles} stage={param.stage} rule={param.rule} year={param.year}/>
                        ))
                    }
                </Grid>
            </Box>
        </>
    )
}