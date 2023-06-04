import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import Link from "next/link";
import Stage_id from "./stage/[...stage]";
import Navigation from "../components/Layouts/Navigation";
import {Box, Grid, Typography} from "@mui/material";
import React from "react";
import styled from "styled-components";
import {InfoBox, RuleBox} from "../styles/pik5.css";
import {useLocale} from "../plugin/pik5";
import {
    faArrowTrendUp,
    faBullhorn,
    faCertificate,
    faChartColumn,
    faFlag,
    faTrophy
} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import NewRecords from "../components/NewRecords";
import PostCountRanking from "../components/PostCountRanking";

const WrapTopBox = styled(Grid)`
  padding :10px;
`
const TopBox = styled(Box)`
  border :1px solid #fff;
  border-radius :4px;
  height :100%;
`
const TopBoxHeader = styled(Box)`
  background-color :#fff;
  color :#000;
  padding :4px;
  border-radius: 4px;
`
const TopBoxContent = styled(Box)`
  padding :8px;
`
const QuickLink = styled(Link)`
  width :100%;
  padding: 10px 0;
  line-height: 2em;
`

export default function Home() {

    const {t} = useLocale()

    const totals = [1, 2, 3, 10, 20, 30, 40]

  return (
    <>
        <Typography variant="" className="title">新ピクチャレ大会</Typography><br/>
        <Typography variant="" className="subtitle">Pikmin Series Leaderboards</Typography><br/>
        <InfoBox>
            ピクチャレ大会へようこそ。このサイトは、任天堂のゲームソフト『ピクミン』シリーズをやり込む人のための、ハイスコアを競い合うランキングサイトです。
            腕前関係なくどなたでも参加することができます。
        </InfoBox>
        <Grid container>
            <WrapTopBox item xs={2}>
                <TopBox>
                    <TopBoxHeader>
                        <FontAwesomeIcon icon={faBullhorn} /> クイックアクセス
                    </TopBoxHeader>
                    <TopBoxContent>
                        {
                            totals.map(n =>
                                (
                                    <>
                                        <QuickLink
                                            href={"/total/"+n}
                                        >{t.rule[n]}</QuickLink><br/>
                                    </>
                                )
                            )
                        }

                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>
            <Grid item xs={10}>
                <Grid container>
                    <WrapTopBox item xs={6}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faBullhorn} /> お知らせ
                            </TopBoxHeader>
                            <TopBoxContent>
                                あ<br/>
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
                                <FontAwesomeIcon icon={faArrowTrendUp} /> 今月のトレンド
                            </TopBoxHeader>
                            <TopBoxContent>
                                あ<br/>
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
    </>
  )
}
