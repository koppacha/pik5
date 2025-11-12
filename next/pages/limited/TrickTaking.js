import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import Container from '@mui/material/Container'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Timer from '../../components/limited/Timer'
import Scoreboard from '../../components/limited/ScoreBoard'
import Field from '../../components/limited/Field'
import Hand from '../../components/limited/Hand'
import DrawButton from '../../components/limited/DrawButton'
import JoinButton from '../../components/limited/JoinButton'
import prisma from "../../lib/prisma";
import NowLoading from "../../components/NowLoading";
import * as React from "react";
import Head from "next/head";
import {PageHeader, StairIcon} from "../../styles/pik5.css";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs, faXmark} from "@fortawesome/free-solid-svg-icons";

// APIフェッチャ
const fetcher = url => fetch(url).then(res => res.json())

export async function getStaticProps() {

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    // 閉鎖中
    return {
        notFound: true
    }

    return {
        props: {
            users
        }
    }
}

export default function Home({ users }) {
    const { data: session } = useSession()
    const { data: tour } = useSWR('/api/server/tournament', fetcher)

    if(!tour){
        return (
            <NowLoading/>
        )
    }

    return (
        <Container
            maxWidth={false}
            disableGutters
            sx={{
                width: '100vw',
                maxWidth: '100vw',
                px: 0,
                ml: 'calc(50% - 50vw)',
                mr: 'calc(50% - 50vw)',
        }}
        >
            <Box py={4} style={{paddingTop:"0"}}>
                <Head>
                    <title>第19回期間限定ランキング - ピクチャレ大会</title>
                </Head>
                <Box>
                    #251227<br/>
                    <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                    <StairIcon icon={faStairs}/>
                    期間限定ランキング<br/>
                    <Typography variant="" className="title">第19回期間限定ランキング</Typography><br/>
                    <Typography variant="" className="subtitle">The 19th Special Limited Ranking</Typography><br/>
                    <br/>
                    <Typography variant="span" style={{fontSize: "1em"}}>
                        トリックテイキング制<FontAwesomeIcon style={{padding: "0 0.5em"}} icon={faXmark}/>個人戦
                    </Typography>
                    <details className="info-box">
                        <summary><strong>ルール</strong></summary>
                        <br/>
                        ルール
                    </details>
                </Box>

                {tour && (
                    <Timer
                        startTime={new Date(tour.data.start)}
                        endTime={new Date(tour.data.end)}
                    />
                )}

                <Box my={2} display="flex" justifyContent="center" gap={2}>
                    <JoinButton session={session}/>
                    <DrawButton session={session}/>
                </Box>
                <Scoreboard users={users}/>
                <Field users={users}/>
                <Hand users={users}/>
            </Box>
        </Container>
    )
}