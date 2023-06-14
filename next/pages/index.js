import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import Link from "next/link";
import Stage_id from "./stage/[...stage]";
import Navigation from "../components/Layouts/Navigation";
import {Box, Grid, Typography} from "@mui/material";
import React, {useState} from "react";
import styled from "styled-components";
import {CellBox, InfoBox, RuleBox, TopBox, TopBoxContent, TopBoxHeader, WrapTopBox} from "../styles/pik5.css";
import {useLocale} from "../plugin/pik5";
import {
    faArrowTrendUp,
    faBullhorn,
    faCertificate,
    faChartColumn, faCheckToSlot,
    faFlag,
    faTrophy
} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import NewRecords from "../components/NewRecords";
import PostCountRanking from "../components/PostCountRanking";
import TrendRanking from "../components/TrendRanking";
import ModalDialogImage from "../components/ModalDialogImage";
import ModalLogin from "../components/ModalLogin";
import {useAuth} from "../hooks/auth";

export default function Home() {

    const {t} = useLocale()
    const [loginOpen, setLoginOpen] = useState(false)
    const { user } = useAuth({ middleware: 'guest' })

    const loginHandleClose = () => {
        setLoginOpen(false)
    }
    const loginHandleOpen = () => {
        setLoginOpen(true)
    }

    // クイックアクセス
    const quickLinks = [
        ["ログイン", "/login"],
        ["アカウント作成", "/register"],
        ["ピクミン1", "/total/10"],
        ["ピクミン2", "/total/20"],
        ["ピクミン3", "/total/30"],
        ["ピクミン4", "/total/40"],
        ["キーワード", "/keyword"],
        ["本編RTA", "/speedrun"],
        ["期間限定", "/limited"],
        ["全総合", "/total/1"],
        ["通常総合", "/total/2"],
        ["特殊総合", "/total/3"],
    ]

  return (
    <>
        ver.3.00<br/>
        <Typography variant="" className="title">新ピクチャレ大会</Typography><br/>
        <Typography variant="" className="subtitle">Pikmin Series Leaderboards</Typography><br/>
        <InfoBox>
            ピクチャレ大会へようこそ。このサイトは、任天堂のゲームソフト『ピクミン』シリーズをやり込む人のためのハイスコアを競い合うランキングサイトです。
            腕前関係なくどなたでも参加することができます。
        </InfoBox>
        <Grid container>
            <WrapTopBox item xs={12}>
                <Grid container>
                    {
                        quickLinks.map(i =>
                            (
                                <Grid item xs={2} component={Link} href={i[1]}>
                                    <CellBox style={{padding:"10px 0"}}>
                                        {i[0]}
                                    </CellBox>
                                </Grid>
                            )
                        )
                    }
                </Grid>
            </WrapTopBox>
            <Grid item xs={12}>
                <Grid container>
                    <WrapTopBox item xs={6}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faCheckToSlot} /> 日替わり投票
                            </TopBoxHeader>
                            <TopBoxContent>
                                <Box onClick={loginHandleOpen}>Login</Box><br/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={6}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faTrophy} /> イベント開催情報
                            </TopBoxHeader>
                            <TopBoxContent>
                                あ<br/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>

                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faChartColumn} /> 各種統計
                            </TopBoxHeader>
                            <TopBoxContent>
                                あ<br/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faArrowTrendUp} /> 最近のトレンド
                            </TopBoxHeader>
                            <TopBoxContent>
                                <TrendRanking/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faFlag} /> 2023年投稿数ランキング
                            </TopBoxHeader>
                            <TopBoxContent>
                                <PostCountRanking/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faCertificate} /> 新着記録
                            </TopBoxHeader>
                            <TopBoxContent>
                                <NewRecords/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                </Grid>
            </Grid>
        </Grid>
        <ModalLogin open={loginOpen} handleClose={loginHandleClose}/>
    </>
  )
}
