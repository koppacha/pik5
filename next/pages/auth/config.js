import { useEffect, useMemo, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../api/auth/[...nextauth]'

import {
    Alert,
    Backdrop,
    Box,
    Button,
    CircularProgress,
    Container,
    Divider,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import {maskEmailAddress, useLocale} from "../../lib/pik5";

function isValidEmailSimple(rawEmail) {
    const email = String(rawEmail || '').trim()
    // 最低限: aaa@bbb.ccc 形式（空白なし、@ が1つ、ドメインに . がある）
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function AuthConfigPage() {

    const {t} = useLocale()

    const { data: session, status, update } = useSession()

    const [currentPassword, setCurrentPassword] = useState('')
    const [name, setName] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [newPassword2, setNewPassword2] = useState('')

    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (typeof session?.user?.name === 'string') {
            setName(session.user.name)
        }
    }, [session?.user?.name])

    const [email, setEmail] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [otp, setOtp] = useState('')
    const [emailBusy, setEmailBusy] = useState(false)
    const [emailMsg, setEmailMsg] = useState(null)
    const [emailErr, setEmailErr] = useState(null)

    // 「もう一度送信」は、少なくとも一度「送信」を押した後に活性化する
    const [otpSendAttempted, setOtpSendAttempted] = useState(false)

    // 認証が成功した直後にUIへ反映するために保持（ページ再読み込み後は session 側の値が必要）
    const [verifiedEmail, setVerifiedEmail] = useState(null)

    const canSubmit = useMemo(() => {
        if (!currentPassword) return false
        const wantName = typeof name === 'string' && name.trim().length > 0 && name.trim() !== (session?.user?.name ?? '')
        const wantPw = newPassword.length > 0 || newPassword2.length > 0
        return wantName || wantPw
    }, [currentPassword, name, session?.user?.name, newPassword.length, newPassword2.length])

    const maskedEmail = useMemo(() => {
        const src = verifiedEmail ?? session?.user?.email
        return src ? maskEmailAddress(src) : null
    }, [verifiedEmail, session?.user?.email])

    const trimmedEmail = useMemo(() => String(email || '').trim(), [email])

    const emailValid = useMemo(() => {
        if (!trimmedEmail) return false
        return isValidEmailSimple(trimmedEmail)
    }, [trimmedEmail])

    const onSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setMessage(null)

        const trimmedName = (name ?? '').trim()
        const wantName = trimmedName.length > 0 && trimmedName !== (session?.user?.name ?? '')
        const wantPw = newPassword.length > 0 || newPassword2.length > 0

        if (!currentPassword) {
            setError('現行パスワードを入力してください')
            return
        }
        if (!wantName && !wantPw) {
            setError('変更したい項目がありません')
            return
        }
        if (wantPw) {
            if (newPassword !== newPassword2) {
                setError('新しいパスワード（確認）が一致しません')
                return
            }
            if (newPassword.length < 8) {
                setError('新しいパスワードは8文字以上にしてください')
                return
            }
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/auth/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword,
                    name: wantName ? trimmedName : undefined,
                    newPassword: wantPw ? newPassword : undefined
                })
            })

            const data = await res.json().catch(() => null)

            if (!res.ok || !data?.ok) {
                setError(data?.message ?? '更新に失敗しました')
                return
            }

            const changedName = Boolean(data.changed?.name)
            const changedPassword = Boolean(data.changed?.password)

            if (changedName) {
                // NextAuth の update() payload 形状は環境で揺れるので、最低限 name だけ流す
                await update({ name: data.name })
            }

            setMessage('更新しました')

            // パスワードを変えた場合は、既存セッションの継続よりも再ログインを推奨
            if (changedPassword) {
                setMessage('パスワードを変更しました。再ログインしてください。')
                await signOut({ callbackUrl: '/auth/login' })
                return
            }

            setCurrentPassword('')
            setNewPassword('')
            setNewPassword2('')
        } catch (e) {
            setError('通信に失敗しました')
        } finally {
            setSubmitting(false)
        }
    }
    const requestOtp = async () => {
        // 押下済みとして扱う（成功/失敗に関わらず）
        setOtpSendAttempted(true)

        if (!emailValid) {
            setEmailErr('メールアドレスの形式が正しくありません')
            return
        }

        setEmailBusy(true)
        setEmailMsg(null)
        setEmailErr(null)
        try {
            const res = await fetch('/api/auth/email/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmedEmail })
            })
            const data = await res.json().catch(() => null)
            if (!res.ok || !data?.ok) {
                setEmailErr(data?.message ?? '送信に失敗しました')
                return
            }
            setOtpSent(true)
            setEmailMsg('認証コードを送信しました')
        } catch (e) {
            setEmailErr('通信に失敗しました')
        } finally {
            setEmailBusy(false)
        }
    }
    const verifyOtp = async () => {
        setEmailBusy(true)
        setEmailMsg(null)
        setEmailErr(null)
        try {
            const res = await fetch('/api/auth/email/verify-otp', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email: trimmedEmail, otp })
            })
            const data = await res.json().catch(() => null)
            if (!res.ok || !data?.ok) {
                setEmailErr(data?.message ?? '認証に失敗しました')
                return
            }
            setEmailMsg('メールアドレスを登録しました')
            setVerifiedEmail(trimmedEmail)
            setOtpSent(false)
            setOtp('')
        } catch (e) {
            setEmailErr('通信に失敗しました')
        } finally {
            setEmailBusy(false)
        }
    }

    if (status === 'loading') {
        return (
            <Container maxWidth="sm" sx={{ py: 6 }}>
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
                    <CircularProgress />
                </Stack>
            </Container>
        )
    }

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Backdrop
                open={Boolean(submitting || emailBusy)}
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            >
                <CircularProgress color="inherit" />
            </Backdrop>

            <Stack spacing={3}>
                <Typography variant="h4" component="h1">
                    {t.g.config}
                </Typography>

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                            {t.g.userId}
                        </Typography>
                        <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                            {session?.user?.userId}
                        </Typography>

                        <Divider sx={{ my: 1.5 }} />

                        <Typography variant="body2" color="text.secondary">
                            {t.g.userName}
                        </Typography>
                        <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                            {session?.user?.name}
                        </Typography>

                        <Divider sx={{ my: 1.5 }} />

                        <Typography variant="body2" color="text.secondary">
                            {t.g.email}
                        </Typography>
                        <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                            {maskedEmail ?? '登録なし'}
                        </Typography>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        {`${t.g.userName} / ${t.g.password} ${t.g.change}`}
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    {message && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {message}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={onSubmit}>
                        <Stack spacing={2}>
                            <TextField
                                label={t.g.currentPassword}
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                fullWidth
                                autoComplete="current-password"
                            />

                            <TextField
                                label={t.g.newUserName}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                fullWidth
                            />

                            <TextField
                                label={t.g.newPassword}
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                fullWidth
                                autoComplete="new-password"
                            />

                            <TextField
                                label={t.g.confirmPassword}
                                type="password"
                                value={newPassword2}
                                onChange={(e) => setNewPassword2(e.target.value)}
                                fullWidth
                                autoComplete="new-password"
                            />

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={!canSubmit}
                                    fullWidth
                                >
                                    {t.g.change}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outlined"
                                    size="large"
                                    onClick={() => signOut({ callbackUrl: '/auth/login' })}
                                    fullWidth
                                >
                                    {t.g.logout}
                                </Button>
                            </Stack>

                            <Typography variant="caption" color="text.secondary">
                                ※ userId（ログインID）は仕様上変更できません
                            </Typography>
                        </Stack>
                    </Box>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        {t.g.registerEmail}
                    </Typography>

                    {emailErr && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {emailErr}
                        </Alert>
                    )}
                    {emailMsg && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {emailMsg}
                        </Alert>
                    )}

                    <Stack spacing={2}>
                        <TextField
                            label={t.g.email}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            fullWidth
                            autoComplete="email"
                            error={Boolean(trimmedEmail) && !emailValid}
                            helperText={Boolean(trimmedEmail) && !emailValid ? '例: aaa@bbb.ccc の形式で入力してください' : ' '}
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                            <Button
                                type="button"
                                onClick={requestOtp}
                                disabled={emailBusy || !emailValid}
                                variant="contained"
                                size="large"
                                fullWidth
                            >
                                {t.g.submit}
                            </Button>

                            <Button
                                type="button"
                                onClick={requestOtp}
                                disabled={emailBusy || !otpSendAttempted || !emailValid}
                                variant="outlined"
                                size="large"
                                fullWidth
                            >
                                {t.g.resend}
                            </Button>
                        </Stack>

                        {otpSent && (
                            <Stack spacing={2}>
                                <TextField
                                    label="6桁コード"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    fullWidth
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                                />

                                <Button
                                    type="button"
                                    onClick={verifyOtp}
                                    disabled={emailBusy || otp.length !== 6}
                                    variant="contained"
                                    size="large"
                                    fullWidth
                                >
                                    {t.g.authentication}
                                </Button>
                            </Stack>
                        )}
                    </Stack>
                </Paper>
            </Stack>
        </Container>
    )
}

export async function getServerSideProps(context) {
    const session = await getServerSession(context.req, context.res, authOptions)
    if (!session) {
        return {
            redirect: {
                destination: '/auth/login',
                permanent: false
            }
        }
    }
    return { props: {} }
}