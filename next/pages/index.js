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
            <WrapTopBox item xs={12}>
                <TopBox>
                    <TopBoxHeader>
                        お知らせ
                    </TopBoxHeader>
                    <TopBoxContent>
                        あ<br/>
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>
            <WrapTopBox item xs={12}>
                <TopBox style={{border:"none"}}>
                    <TopBoxHeader>
                        クイックアクセス
                    </TopBoxHeader>
                    <TopBoxContent>
                        <Grid container style={{margin:"20px 0"}}>
                            {
                                totals.map(n =>
                                    (
                                        <Grid item>
                                            <RuleBox
                                                component={Link}
                                                href={"/total/"+n}
                                            >{t.rule[n]}</RuleBox>
                                        </Grid>
                                    )
                                )
                            }
                        </Grid>
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>
            <WrapTopBox item xs={12}>
                <TopBox style={{border:"none"}}>
                    <TopBoxHeader>
                        ピクチャレ大会へようこそ
                    </TopBoxHeader>
                    <TopBoxContent>
                        <Grid container style={{margin:"20px 0"}}>
                            <Grid item>
                                <RuleBox component={Link} href={"/"}>ピクチャレ大会とは</RuleBox>
                            </Grid>
                            <Grid item>
                                <RuleBox component={Link} href={"/"}>アカウント作成</RuleBox>
                            </Grid>
                            <Grid item>
                                <RuleBox component={Link} href={"/"}>ログイン</RuleBox>
                            </Grid>
                            <Grid item>
                                <RuleBox component={Link} href={"/"}>ルール集・利用規約</RuleBox>
                            </Grid>
                        </Grid>
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>
            <WrapTopBox item xs={12}>
                <TopBox>
                    <TopBoxHeader>
                        今月のトレンド
                    </TopBoxHeader>
                    <TopBoxContent>
                        あ<br/>
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>
            <WrapTopBox item xs={12}>
                <TopBox>
                    <TopBoxHeader>
                        ポストレース
                    </TopBoxHeader>
                    <TopBoxContent>
                        あ
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>
            <WrapTopBox item xs={12}>
                <TopBox>
                    <TopBoxHeader>
                        新着記録
                    </TopBoxHeader>
                    <TopBoxContent>
                        あ
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>

        </Grid>
    </>
  )
}
