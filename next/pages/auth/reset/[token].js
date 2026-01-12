import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {useLocale} from "../../../lib/pik5";

export default function ResetTokenPage() {

    const {t} = useLocale()

    const router = useRouter()
    const token = useMemo(() => {
        const t = router.query.token
        return Array.isArray(t) ? t[0] : t
    }, [router.query.token])

    const [valid, setValid] = useState(null)
    const [busy, setBusy] = useState(false)
    const [pw, setPw] = useState('')
    const [pw2, setPw2] = useState('')
    const [err, setErr] = useState(null)

    useEffect(() => {
        if (!token) return
            ;(async () => {
            const res = await fetch('/api/auth/password-reset/verify', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ token })
            })
            const data = await res.json().catch(() => null)
            setValid(Boolean(data?.ok))
        })()
    }, [token])

    const onSubmit = async (e) => {
        e.preventDefault()
        setErr(null)
        if (pw.length < 8) return setErr('パスワードは8文字以上にしてください')
        if (pw !== pw2) return setErr('確認用パスワードが一致しません')

        setBusy(true)
        try {
            const res = await fetch('/api/auth/password-reset/confirm', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ token, newPassword: pw })
            })
            const data = await res.json().catch(() => null)
            if (!res.ok || !data?.ok) {
                setErr(data?.message ?? '失敗しました')
                return
            }
            router.push('/auth/login')
        } finally {
            setBusy(false)
        }
    }

    if (valid === null) {
        return (
            <Container maxWidth="sm" sx={{ py: 6 }}>
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Stack spacing={2} alignItems="center">
                        <CircularProgress />
                        <Typography variant="body1">リンクを確認しています…</Typography>
                        <Typography variant="body2" color="text.secondary">
                            しばらくお待ちください。
                        </Typography>
                    </Stack>
                </Paper>
            </Container>
        )
    }

    if (!valid) {
        return (
            <Container maxWidth="sm" sx={{ py: 6 }}>
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Typography variant="h5" component="h1">リンクが無効です</Typography>
                        <Alert severity="error">
                            パスワードリセットのリンクが無効、または期限切れの可能性があります。
                        </Alert>
                        <Typography variant="body2" color="text.secondary">
                            もう一度、パスワードリセットをやり直してください。
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button variant="outlined" onClick={() => router.push('/auth/login')}>{t.g.login}</Button>
                            <Button variant="contained" onClick={() => router.push('/auth/reset')}>{t.g.passwordReset}</Button>
                        </Box>
                    </Stack>
                </Paper>
            </Container>
        )
    }

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Paper elevation={2} sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                    <Box>
                        <Typography variant="h5" component="h1" gutterBottom>
                            {t.g.newPassword}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            8文字以上の新しいパスワードを入力してください。
                        </Typography>
                    </Box>

                    {err && <Alert severity="error">{err}</Alert>}

                    <Box component="form" onSubmit={onSubmit} noValidate>
                        <Stack spacing={2}>
                            <TextField
                                label={t.g.newPassword}
                                type="password"
                                value={pw}
                                onChange={(e) => setPw(e.target.value)}
                                fullWidth
                                autoComplete="new-password"
                                disabled={busy}
                                helperText="8文字以上"
                            />
                            <TextField
                                label={t.g.confirmPassword}
                                type="password"
                                value={pw2}
                                onChange={(e) => setPw2(e.target.value)}
                                fullWidth
                                autoComplete="new-password"
                                disabled={busy}
                            />

                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Button
                                    type="button"
                                    variant="text"
                                    onClick={() => router.push('/auth/login')}
                                    disabled={busy}
                                >
                                    {t.g.cancel}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={busy}
                                    startIcon={busy ? <CircularProgress size={18} /> : null}
                                >
                                    {busy ? '送信中…' : '送信'}
                                </Button>
                            </Box>
                        </Stack>
                    </Box>

                    <Alert severity="info" sx={{ mt: 1 }}>
                        このページは一度のみ有効な場合があります。うまくいかない場合は、リンクを再発行してください。
                    </Alert>
                </Stack>
            </Paper>
        </Container>
    )
}