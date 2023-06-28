import * as React from "react";
import Record from "../../components/record/Record";
import {Box, Grid, Typography} from "@mui/material";
import {useLocale} from "../../lib/pik5";
import RecordPost from "../../components/modal/RecordPost";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import Rules from "../../components/rule/Rules";
import BreadCrumb from "../../components/BreadCrumb";
import ModalKeyword from "../../components/modal/ModalKeyword";
import {useState} from "react";
import {RuleBox} from "../../styles/pik5.css";
import Link from "next/link";

// サーバーサイドの処理
export async function getServerSideProps(context){

    const query = context.query.stage
    const stage = query[0]

    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${stage}`)
    const info = await stage_res.json()

    const rule  = query[2] || info.parent
    const console = query[1] || 0
    const year  = query[3] || 2023

    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/record/${stage}/${console}/${rule}/${year}`)

    const data = await res.json()

    return {
        props: {
            data, stage, rule, console, year, info
        }
    }
}
export default function Stage(param){

    const {t, r} = useLocale()

    // ボーダーライン出力用変数
    const borders = [param.info.border1, param.info.border2, param.info.border3, param.info.border4]
    let i = borders.length - 1
    const [open, setOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)

    // 呼び出すレギュレーション本文
    let uniqueId = param.rule

    // タマゴあり・タマゴなしの場合はピクミン２の通常ルールを表示する
    if(param.rule === 21 || param.rule === 22){
        uniqueId = 20
    }

        const handleClose = () => setOpen(false)
    const handleEditOpen = () => {
        setOpen(false)
        setEditOpen(true)
    }
    const handleOpen = () => setOpen(true)

    return (
        <>
            #{param.stage}<br/>
            <BreadCrumb info={param.info} rule={param.rule}/>
            <Typography variant="" className="title">{ t.stage[param.stage] }</Typography><br/>
            <Typography variant="" className="subtitle">{r.stage[param.stage]}</Typography>

            <Grid container>
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
            </Grid>
            <Box style={{margin:"20px 0"}}>
                <Grid container style={{
                    marginTop:"30px"
                }}>
                    <Rules props={param}/>
                    <RecordPost
                        info={param.info}/>
                    <Grid item style={{
                        marginBottom:"20px",
                    }}>
                        <RuleBox className={"active"}
                                 onClick={handleOpen}
                                 component={Link}
                                 href="#">
                            {t.g.rule}
                        </RuleBox>
                    </Grid>
                </Grid>
            </Box>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={handleEditOpen}/>
                {
                    // 記録を出力（ボーダー設定がある通常ランキング）
                    Object.values(param.data).map(function (post){
                            const border = borders[i]
                            const star = "★"
                            if(post.score < border){
                                i--;
                                return (
                                    <>
                                        <Box style={{
                                            color:"#e81fc1",
                                            borderBottom:"2px dotted #e81fc1",
                                            textAlign:"center",
                                            margin:"8px 0"
                                        }}>
                                            {star.repeat(i + 2)} {t.border[2][i + 1]} {border.toLocaleString()} pts.
                                        </Box>
                                        <Record data={post}/>
                                    </>
                                )
                            } else {
                                return (
                                    <Record data={post}/>
                                )
                            }
                        }
                    )
                }
        </>
    )
}
