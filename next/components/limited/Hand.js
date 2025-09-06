'use client';
import { useSession } from 'next-auth/react';
import useSWR from 'swr'
import Grid from '@mui/material/Grid'
import CardItem from './Card'

const fetcher = url => fetch(url).then(res => res.json())

export default function Hand() {
    const { data: session } = useSession();
    const { data: cards } = useSWR(
        session ? `/api/server/hand?userId=${encodeURIComponent(session.user.id)}` : null,
        fetcher
    );
    if (!session) return null;
    if (cards === undefined) return null;
    if (Array.isArray(cards) && cards.length === 0) {
      return <p>手札がありません</p>;
    }

    return (
        <>
        手札<br/>
            <Grid container spacing={2}>
                {Object.values(cards.data).map(c => (
                    <Grid item key={c.id} xs={4}>
                        <CardItem card={c} region="hand" session={session} />
                    </Grid>
                ))}
            </Grid>
        </>
    )
}