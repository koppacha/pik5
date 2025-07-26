'use client';

import useSWR from 'swr'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'

const fetcher = url => fetch(url).then(res => res.json())

export default function Scoreboard() {

    const { data: players } = useSWR('/api/server/players', fetcher)
    if (players === undefined) return null

    // APIが { data: [...] } 形式の場合を考慮
    const raw = players.data ?? players
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object')
            ? Object.values(raw)
            : []
    if (list.length === 0) {
        return <Paper style={{ padding: 16 }}>参加者がいません</Paper>
    }
    return (
        <Paper>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>名前</TableCell>
                        <TableCell>ドローポイント</TableCell>
                        <TableCell>ランクポイント</TableCell>
                        <TableCell>所持カード枚数</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {list.map(p => (
                        <TableRow key={p.id}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{p.draw_points}</TableCell>
                            <TableCell>{p.rank_points}</TableCell>
                            <TableCell>{p.card_count}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Paper>
    )
}