import useSWR from 'swr'
import Grid from '@mui/material/Grid'
import CardItem from './Card'

const fetcher = url => fetch(url).then(res => res.json())

export default function Field({users}) {
    const { data: cards } = useSWR('/api/server/field-cards', fetcher)
    if (!cards) return <p>カードがありません</p>

    return (
        <Grid container spacing={2}>
            {Object.values(cards.data).map(c => (
                <Grid item key={c.id} xs={6} sm={4} md={3}>
                    <CardItem card={c} users={users} region="field" />
                </Grid>
            ))}
        </Grid>
    )
}