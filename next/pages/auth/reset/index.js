import { useState } from 'react'

export default function ResetRequestPage() {
    const [email, setEmail] = useState('')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState(null)

    const onSubmit = async (e) => {
        e.preventDefault()
        setBusy(true)
        setMsg(null)
        try {
            await fetch('/api/auth/password-reset/request', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email })
            })
            // 推測防止のため常に同じ表示
            setMsg('メールアドレスが登録済みの場合、リセット手順を送信しました')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div style={{maxWidth: 520, margin: '0 auto', padding: 16}}>
            <h1>パスワードリセット</h1>
            <form onSubmit={onSubmit}>
                <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email" />
                <button type="submit" disabled={busy || !email}>送信</button>
            </form>
            {msg && <div style={{marginTop: 12}}>{msg}</div>}
        </div>
    )
}