import {useEffect, useRef, useState} from 'react'
import {useSession} from 'next-auth/react'
import Link from 'next/link'
import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField} from '@mui/material'
import Compressor from 'compressorjs'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faGlobe} from '@fortawesome/free-solid-svg-icons'
import {timeStageList} from '../../lib/const'
import {worldRecordScore, worldRecordPlatforms, worldRecordPlatformNames, parseWorldRecordTime} from '../../lib/worldRecordScore'
import useWorldRecordPermissions from '../../hooks/useWorldRecordPermissions'

export default function WorldRecordReport({info, rule, onReported}) {
    const {data: session} = useSession()
    const permissions = useWorldRecordPermissions()
    const [open, setOpen] = useState(false)
    const [holder, setHolder] = useState('')
    const [score, setScore] = useState('')
    const [platform, setPlatform] = useState(4)
    const [image, setImage] = useState(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [compressing, setCompressing] = useState(false)
    const submitting = useRef(false)
    const imageVersion = useRef(0)
    const countdown = Number(rule) !== 48 && timeStageList.find(item => item.stage === Number(info.stage_id))
    const time = Boolean(countdown) || Number(rule) === 33 || (Number(rule) === 48 && info.score_type === 'time')
    const platforms = worldRecordPlatforms(info.stage_id, rule)
    const blocked = Boolean(session) && !permissions.canReport
    useEffect(() => {
        imageVersion.current++
        setHolder('')
        setScore(time ? '00:00:00' : '')
        setPlatform(4)
        setImage(null)
        setError('')
        setCompressing(false)
    }, [open, info.stage_id, rule, time])
    if (![31, 32, 33, 34, 36, 48].includes(Number(rule))) return null

    function selectImage(event) {
        const file = event.target.files?.[0]
        const version = ++imageVersion.current
        setImage(null)
        if (!file) { setCompressing(false); return }
        setCompressing(true)
        new Compressor(file, {
            quality: 0.6, retainExif: true, convertSize: 1000000,
            success(result) {
                if (version !== imageVersion.current) return
                setCompressing(false)
                if (result.size > 5 * 1024 * 1024) { setError('画像は5MB以下にしてください'); return }
                setError('')
                setImage(result)
            },
            error() { if (version === imageVersion.current) { setCompressing(false); setError('画像を読み込めません') } },
        })
    }
    async function submit(event) {
        event.preventDefault()
        if (submitting.current || compressing || !permissions.canReport) return
        submitting.current = true
        setBusy(true)
        setError('')
        try {
            const value = time ? parseWorldRecordTime(score) : Number(score)
            if (!Number.isFinite(value) || value <= 0) throw new Error(time ? '時間を時:分:秒で入力してください' : '記録を入力してください')
            const body = new FormData()
            body.append('stage_id', info.stage_code || String(info.stage_id))
            body.append('rule', rule)
            body.append('holder_name', holder.trim())
            body.append('score', worldRecordScore(value, rule, countdown))
            body.append('platform', platform)
            if (image) body.append('file', image, image.name || 'evidence.jpg')
            const response = await fetch('/api/world-records', {method: 'POST', body})
            const result = await response.json()
            if (!response.ok) throw new Error(Object.values(result.errors || {}).flat().join(' / ') || result.message || '報告できませんでした')
            await onReported?.()
            setOpen(false)
        } catch (failure) { setError(failure.message) }
        finally { setBusy(false); submitting.current = false }
    }
    return <>
        <Button variant="contained" className="rule-box record-post-button" disabled={blocked} onClick={() => { void permissions.refresh(); setOpen(true) }}><span><FontAwesomeIcon icon={faGlobe} /> 世界記録報告</span></Button>
        <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm" PaperProps={{style: {backgroundColor: '#fff', color: '#222'}}}>
            <DialogTitle>世界記録報告</DialogTitle>
            {!session ? <DialogContent><Link href="/auth/login">ログインしてください</Link></DialogContent> : <Box component="form" onSubmit={submit}>
                <DialogContent>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField label="投稿者名" value={session.user.name || session.user.userId || ''} disabled fullWidth margin="normal" />
                    <TextField label="プラットフォーム" select value={platform} onChange={event => setPlatform(Number(event.target.value))} disabled={busy || blocked || platforms.length === 1} fullWidth margin="normal">
                        {platforms.map(id => <MenuItem key={id} value={id}>{worldRecordPlatformNames[id]}</MenuItem>)}
                    </TextField>
                    <TextField label="世界記録保持者名" value={holder} onChange={event => setHolder(event.target.value)} inputProps={{maxLength: 100}} required fullWidth margin="normal" disabled={busy || blocked} />
                    <TextField label={time ? 'タイム' : '記録'} type={time ? 'text' : 'number'} value={score} onChange={event => setScore(event.target.value)} inputProps={time ? {inputMode: 'numeric'} : {min: 1, max: 999999, step: 1}} helperText={time && '時:分:秒（例 00:02:30）'} required fullWidth margin="normal" disabled={busy || blocked} />
                    <TextField label="証拠画像" type="file" inputProps={{accept: 'image/jpeg,image/png,image/gif,image/webp'}} InputLabelProps={{shrink: true}} onChange={selectImage} fullWidth margin="normal" disabled={busy || blocked} />
                </DialogContent>
                <DialogActions><Button onClick={() => setOpen(false)} disabled={busy}>閉じる</Button><Button type="submit" variant="contained" disabled={busy || compressing || blocked}>{busy ? '送信中…' : '報告する'}</Button></DialogActions>
            </Box>}
        </Dialog>
    </>
}
