import React, { useState } from 'react'
import NextLink from 'next/link'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import {useLocale} from "../../../lib/pik5";
import Image from "next/image";

export default function ResetRequestPage() {

  const {t} = useLocale()

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setMsg(null)
    setErr(null)

    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      // 推測防止のため、登録有無に関わらず成功メッセージは固定
      if (!res.ok) {
        // API側の都合でエラーになっても、存在推測を避けるため表示は固定に寄せる
        setMsg('メールアドレスが登録済みの場合、リセット手順を送信しました')
        return
      }

      setMsg('メールアドレスが登録済みの場合、リセット手順を送信しました')
    } catch (e) {
      setErr('通信に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  const emailIsValid = /.+@.+\..+/.test(email)

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', py: 4 }}>
      <Box style={{zIndex:"-1",position:"fixed",top:"0",left:"0",width:"100%",height:"100vh"}}>
        <Image src="/img/bg29.jpg" fill style={{objectFit:"cover",overflow:"hidden"}} alt="background"/>
      </Box>
      <Container maxWidth="sm">
        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5" component="h1" fontWeight={700}>
                {t.g.passwordReset}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                登録済みのメールアドレスを入力してください。リセット手順を送信します。
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                もしメールが届かない場合、迷惑メールフォルダや受信設定をご確認ください。
              </Typography>
            </Box>

            <Box component="form" onSubmit={onSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  label={t.g.email}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  fullWidth
                  required
                  disabled={busy}
                  error={email.length > 0 && !emailIsValid}
                  helperText={
                    email.length === 0
                      ? '例: you@example.com'
                      : emailIsValid
                        ? ' '
                        : 'メールアドレスの形式をご確認ください'
                  }
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={busy || !emailIsValid}
                  fullWidth
                  sx={{ py: 1.2 }}
                >
                  {busy ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={18} color="inherit" />
                      送信中…
                    </Box>
                  ) : (
                    '送信'
                  )}
                </Button>

                {msg && <Alert severity="success">{msg}</Alert>}
                {err && <Alert severity="error">{err}</Alert>}
              </Stack>
            </Box>

            <Divider />

            <Stack spacing={1}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Link component={NextLink} href="/" underline="hover">
                  {t.g.top}
                </Link><br/>
                <Link component={NextLink} href="/auth/login" underline="hover">
                  {t.g.login}
                </Link><br/>
                <Link component={NextLink} href="/auth/register" underline="hover">
                  {t.g.unregistered}
                </Link>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}