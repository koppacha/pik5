import {useState, useEffect, useMemo} from 'react'
import Typography from '@mui/material/Typography'

export default function Timer({ startTime, endTime }) {
    // endTime をどの型で渡されても（Date / string / number）安全にタイムスタンプ化
    const endTs = useMemo(() => {
        if (endTime instanceof Date) {
            const t = endTime.getTime()
            return Number.isFinite(t) ? t : null
        }
        if (typeof endTime === 'string' || typeof endTime === 'number') {
            const t = new Date(endTime).getTime()
            return Number.isFinite(t) ? t : null
        }
        return null
    }, [endTime])

    // 現在時刻を1秒ごとに更新
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])

    // endTime が不正なら即フォールバック
    if (endTs === null) {
        return <Typography variant="h6" align="center">残り時間：不明</Typography>
    }

    const remain = endTs - now
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