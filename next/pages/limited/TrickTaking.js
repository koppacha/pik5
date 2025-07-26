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

    return (
        <Container maxWidth="md">
            <Box py={4}>
                <Typography variant="h4" align="center" gutterBottom>
                    オンラインカードゲーム大会
                </Typography>

                {tour && (
                    <Timer
                        startTime={new Date(tour.start)}
                        endTime={new Date(tour.end)}
                    />
                )}

                <Box my={2} display="flex" justifyContent="center" gap={2}>
                    <JoinButton session={session} />
                    <DrawButton session={session} />
                </Box>
                <Scoreboard />
                <Field users={users} />
                <Hand users={users} />
            </Box>
        </Container>
    )
}