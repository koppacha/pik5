import styled from 'styled-components'
import {useState} from 'react'
import useSWR from 'swr'
import {Alert, Button, Table, TableBody, TableCell, TableHead, TableRow} from '@mui/material'
import SeoHead from '../../components/SeoHead'

const HistoryTable = styled(Table)`
    .MuiTableCell-root { color: var(--color-text-base); }
`

export default function LoginHistory() {
    const [page, setPage] = useState(1)
    const {data, error} = useSWR(`/api/login-history?page=${page}`, async url => {
        const response = await fetch(url)
        if (!response.ok) throw new Error('ログイン履歴を取得できません。ログイン状態をご確認ください。')
        return response.json()
    })
    return <>
        <SeoHead title="ログイン履歴" noindex />
        <h1>ログイン履歴</h1>
        <p>ご自身のログイン履歴を表示します。成功履歴は90日、失敗履歴は30日保持します。</p>
        {error && <Alert severity="error">{error.message}</Alert>}
        <HistoryTable><TableHead><TableRow><TableCell>日時（日本時間）</TableCell><TableCell>結果</TableCell><TableCell>接続元IP</TableCell><TableCell>ブラウザ</TableCell></TableRow></TableHead>
            <TableBody>{data?.map(row => <TableRow key={row.id}><TableCell>{row.created_at}</TableCell><TableCell>{{success: '成功', failure: '失敗', limited: '制限', error: '内部障害'}[row.outcome]}</TableCell><TableCell>{row.ip || '取得不可'}</TableCell><TableCell>{row.user_agent}</TableCell></TableRow>)}</TableBody>
        </HistoryTable>
        {!data?.length && !error && <p>表示できる履歴はありません。</p>}
        <Button disabled={page === 1} onClick={() => setPage(page - 1)}>前へ</Button>
        <Button disabled={!data || data.length < 20} onClick={() => setPage(page + 1)}>次へ</Button>
    </>
}
