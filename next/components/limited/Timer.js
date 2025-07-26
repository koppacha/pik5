import { useState, useEffect } from 'react'
import Typography from '@mui/material/Typography'

export default function Timer({ startTime, endTime }) {
    const [remain, setRemain] = useState(endTime.getTime() - Date.now())

    useEffect(() => {
        const id = setInterval(() => {
            setRemain(endTime.getTime() - Date.now())
        }, 1000)
        return () => clearInterval(id)
    }, [endTime])

    if (remain <= 0) return <Typography>大会終了</Typography>

    const hh = Math.floor(remain / 1000 / 3600)
    const mm = Math.floor((remain / 1000 % 3600) / 60)
    const ss = Math.floor(remain / 1000 % 60)
    const pad = n => String(n).padStart(2, '0')

    return (
        <Typography variant="h6" align="center">
            残り時間: {pad(hh)}:{pad(mm)}:{pad(ss)}
        </Typography>
    )
}