import Button from '@mui/material/Button'
import { mutate } from 'swr'

export default function DrawButton({ session }) {
    if(!session) return null

    const handleDraw = async () => {
        const url = `/api/server/draw?userId=${encodeURIComponent(session.user.id)}`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // ボディにも userId を入れて冗長に送る（プロキシ環境での取りこぼし対策）
            body: JSON.stringify({ userId: session.user.id })
        })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            console.error('draw failed', res.status, text)
            return
        }
        mutate(`/api/server/players/me?userId=${session.user.id}`)
        mutate('/api/server/hand?userId=' + session.user.id)
    }
    const disabled = !session

    return (
        <Button
            variant="contained"
            disabled={disabled}
            onClick={handleDraw}
        >ドロー</Button>
    )
}