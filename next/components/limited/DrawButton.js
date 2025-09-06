import { mutate } from 'swr'
import Button from '@mui/material/Button'
import useSWR from 'swr'

const fetcher = url => fetch(url).then(res => res.json())

export default function DrawButton({ session }) {
    if(!session) return null
    const { data: player } = useSWR(`/api/server/players/me?userId=${session.user.id}`, fetcher)

    const handleDraw = async () => {
        await fetch('/api/server/draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user.id })
        })
        mutate(`/api/server/players/me?userId=${session.user.id}`)
        mutate('/api/server/hand?userId=' + session.user.id)
    }
    const disabled = !session || !player || player.draw_points < 3

    return (
        <Button
            variant="contained"
            disabled={disabled}
            onClick={handleDraw}
        >ドロー</Button>
    )
}