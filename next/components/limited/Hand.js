'use client';
import { useSession } from 'next-auth/react';
import useSWR from 'swr'
import Grid from '@mui/material/Grid'
import CardItem from './Card'

const fetcher = url => fetch(url).then(res => res.json())

export default function Hand() {
    const { data: session } = useSession();
    const { data: cards } = useSWR(
        session ? `/api/server/hand?userId=${encodeURIComponent(session.user.userId)}` : null,
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
            <Grid container
                wrap="wrap"
                justifyContent="center"
                columnGap={2}
                rowGap={2}
                sx={{ m: 0 }}
            >
                {Object.values(cards.data).map(c => (
                    <Grid item
                          key={c.id}
                          style={{
                              flex: '0 0 300px',
                              width: '300px',
                          }}
                    >
                        <CardItem card={c} region="hand" session={session} />
                    </Grid>
                ))}
            </Grid>
        </>
    )
}