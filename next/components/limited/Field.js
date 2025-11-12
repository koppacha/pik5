import useSWR from 'swr'
import Grid from '@mui/material/Grid'
import CardItem from './Card'

const fetcher = url => fetch(url).then(res => res.json())

export default function Field({users}) {
    const { data: cards } = useSWR('/api/server/field-cards', fetcher)
    if (!cards) return <Grid>カードがありません</Grid>

    return (
        <>
            フィールド領域<br/>
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
                        <CardItem card={c} users={users} region="field" />
                    </Grid>
                ))}
            </Grid>
        </>
    )
}