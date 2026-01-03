import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function ResetTokenPage() {
    const router = useRouter()
    const token = router.query.token

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
        if (pw !== pw2) return setErr('確認用パスワードが一致しません')
        if (pw.length < 8) return setErr('8文字以上にしてください')

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

    if (valid === null) return <div style={{padding:16}}>確認中...</div>
    if (!valid) return <div style={{padding:16}}>リンクが無効か期限切れです</div>

    return (
        <div style={{maxWidth: 520, margin: '0 auto', padding: 16}}>
            <h1>新しいパスワード設定</h1>
            {err && <div style={{color:'crimson'}}>{err}</div>}
            <form onSubmit={onSubmit}>
                <input type="password" value={pw} onChange={(e)=>setPw(e.target.value)} placeholder="new password" />
                <input type="password" value={pw2} onChange={(e)=>setPw2(e.target.value)} placeholder="confirm" />
                <button type="submit" disabled={busy}>送信</button>
            </form>
        </div>
    )
}