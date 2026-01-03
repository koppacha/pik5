import { useState, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../api/auth/[...nextauth]'

// 既存の NowLoading を使う前提（パスは実プロジェクトに合わせてください）
import NowLoading from '../../components/NowLoading'

export default function AuthConfigPage() {
    const { data: session, status, update } = useSession()

    const [currentPassword, setCurrentPassword] = useState('')
    const [name, setName] = useState(session?.user?.name ?? '')
    const [newPassword, setNewPassword] = useState('')
    const [newPassword2, setNewPassword2] = useState('')

    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)

    const [email, setEmail] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [otp, setOtp] = useState('')
    const [emailBusy, setEmailBusy] = useState(false)
    const [emailMsg, setEmailMsg] = useState(null)
    const [emailErr, setEmailErr] = useState(null)

    const canSubmit = useMemo(() => {
        if (!currentPassword) return false
        const wantName = typeof name === 'string' && name.trim().length > 0 && name.trim() !== (session?.user?.name ?? '')
        const wantPw = newPassword.length > 0 || newPassword2.length > 0
        return wantName || wantPw
    }, [currentPassword, name, session?.user?.name, newPassword.length, newPassword2.length])

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
        setEmailBusy(true)
        setEmailMsg(null)
        setEmailErr(null)
        try {
            const res = await fetch('/api/auth/email/request-otp', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email })
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
                body: JSON.stringify({ email, otp })
            })
            const data = await res.json().catch(() => null)
            if (!res.ok || !data?.ok) {
                setEmailErr(data?.message ?? '認証に失敗しました')
                return
            }
            setEmailMsg('メールアドレスを登録しました')
            setOtpSent(false)
            setOtp('')
        } catch (e) {
            setEmailErr('通信に失敗しました')
        } finally {
            setEmailBusy(false)
        }
    }

    if (status === 'loading') return <NowLoading />

    return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
            <h1>アカウント設定</h1>

            <div style={{ marginBottom: 16 }}>
                <div>ログインID: <b>{session?.user?.userId}</b></div>
                <div>スクリーンネーム: <b>{session?.user?.name}</b></div>
            </div>

            {submitting && <NowLoading />}

            {!submitting && (
                <form onSubmit={onSubmit}>
                    {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}
                    {message && <div style={{ color: 'seagreen', marginBottom: 12 }}>{message}</div>}

                    <div style={{ marginBottom: 12 }}>
                        <label>現行パスワード（必須）</label><br />
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            style={{ width: '100%' }}
                            autoComplete="current-password"
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label>新しいスクリーンネーム</label><br />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label>新しいパスワード</label><br />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ width: '100%' }}
                            autoComplete="new-password"
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label>新しいパスワード（確認）</label><br />
                        <input
                            type="password"
                            value={newPassword2}
                            onChange={(e) => setNewPassword2(e.target.value)}
                            style={{ width: '100%' }}
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" disabled={!canSubmit}>
                        変更
                    </button>

                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
                        ※ userId（ログインID）は仕様上変更できません
                    </div>
                </form>
            )}
            <h2>メールアドレス登録（パスワードリセット用）</h2>
            {emailBusy && <NowLoading />}

            {emailErr && <div style={{color:'crimson'}}>{emailErr}</div>}
            {emailMsg && <div style={{color:'seagreen'}}>{emailMsg}</div>}

            <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email" />

            <button type="button" onClick={requestOtp} disabled={emailBusy || !email}>
                送信
            </button>

            {otpSent && (
                <>
                    <div style={{marginTop: 8}}>
                        <input value={otp} onChange={(e)=>setOtp(e.target.value)} placeholder="6桁コード" />
                        <button type="button" onClick={verifyOtp} disabled={emailBusy || otp.length !== 6}>
                            認証
                        </button>
                        <button type="button" onClick={requestOtp} disabled={emailBusy}>
                            もう一度送信
                        </button>
                    </div>
                </>
            )}
        </div>
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