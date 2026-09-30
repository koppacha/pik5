import React, {useMemo, useState} from "react"
import useSWR from "swr"
import {useSession} from "next-auth/react"
import styled from "styled-components"
import {Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography} from "@mui/material"
import CasinoIcon from "@mui/icons-material/Casino"
import PersonAddIcon from "@mui/icons-material/PersonAdd"
import SeoHead from "../../components/SeoHead"
import {id2name, useLocale} from "../../lib/pik5"

const fetcher = url => fetch(url).then(async res => {
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || "読み込みに失敗しました")
    return data
})

const Page = styled.div`
  min-height: 100vh;
  padding: 20px;
  background: #101214;
  color: #f4f7fb;
`
const Panel = styled.section`
  max-width: 1120px;
  margin: 0 auto 14px;
  padding: 14px;
  border: 1px solid #2c333a;
  border-radius: 8px;
  background: #171b20;
`
const Match = styled.button`
  display: block;
  width: 100%;
  margin: 8px 0;
  padding: 12px;
  border: 1px solid ${props => props.$complete ? "#426b4b" : "#3f4851"};
  border-radius: 7px;
  background: #11161b;
  color: #f4f7fb;
  text-align: left;
  cursor: ${props => props.disabled ? "default" : "pointer"};
`
const GameLine = styled.div`
  margin-top: 5px;
  color: #b7c0ca;
  font-size: 0.88em;
`
const RankingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 12px;
  overflow-x: auto;
`
const RankingGroup = styled.div`
  min-width: 180px;
  padding: 9px;
  border: 1px solid #3f4851;
  border-radius: 7px;
  background: #11161b;
`
const PlayerCard = styled.div`
  margin-top: 7px;
  padding: 8px;
  border-radius: 5px;
  background: #242c34;
`
const ControlButton = styled(Button)`
  color: inherit;
  border-color: currentColor;

  &.Mui-disabled {
    color: currentColor;
    border-color: currentColor;
    opacity: 0.45;
  }
`
const ControlField = styled(TextField)`
  & .MuiInputBase-root,
  & .MuiInputLabel-root,
  & .MuiSvgIcon-root {
    color: inherit;
  }

  & .MuiOutlinedInput-notchedOutline {
    border-color: currentColor;
  }
`

function name(users, id) {
    return id2name(users, id) || id || "-"
}

export async function getServerSideProps() {
    const {default: prisma} = await import("../../lib/prisma")
    const users = await prisma.user.findMany({select: {userId: true, name: true}})
    return {props: {users}}
}

export default function SwissTournamentPage({users: registeredUsers}) {
    const {t} = useLocale()
    const {data: session} = useSession()
    const isAdmin = Number(session?.user?.role || 0) === 10
    const {data: tournaments, error, mutate: refreshTournaments} = useSWR("/api/swiss-tournaments", fetcher, {refreshInterval: 3000})
    const [tournamentId, setTournamentId] = useState("")
    const {data: state, mutate: refreshState} = useSWR(tournamentId ? `/api/swiss-tournaments/${tournamentId}` : null, fetcher, {refreshInterval: 1500})
    const [title, setTitle] = useState("")
    const [playerName, setPlayerName] = useState("")
    const users = useMemo(() => [
        ...(state?.players ?? []).filter(player => player.display_name).map(player => ({userId: player.user_id, name: player.display_name})),
        ...registeredUsers,
    ], [state?.players, registeredUsers])
    const [rank, setRank] = useState("")
    const [selectedMatch, setSelectedMatch] = useState(null)
    const [message, setMessage] = useState("")
    const [undoing, setUndoing] = useState(false)
    const [stageDrawing, setStageDrawing] = useState(false)
    const [stagePreview, setStagePreview] = useState("")
    const selectedGames = selectedMatch?.games ?? []
    const pendingGame = selectedGames.find(game => !game.result)
    const stageName = pendingGame ? (t.stage?.[pendingGame.stage_id] || `ステージ ${pendingGame.stage_id}`) : ""

    const api = async (path, method = "POST", body = {}) => {
        const res = await fetch(`/api/swiss-tournaments/${path}`, {method, headers: {"content-type": "application/json"}, body: method === "GET" ? undefined : JSON.stringify(body)})
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || "操作に失敗しました")
        await refreshTournaments()
        await refreshState(data.state || data)
        return data
    }
    const create = async () => {
        try {
            const data = await api("", "POST", {title})
            setTournamentId(String(data.tournament.id))
            setTitle("")
        } catch (e) { setMessage(e.message) }
    }
    const addPlayer = async () => {
        try {
            await api(`${tournamentId}/players`, "POST", {name: playerName.trim(), provisional_rank: rank || null})
            setPlayerName("")
            setRank("")
        } catch (e) { setMessage(e.message) }
    }
    const draw = async () => {
        try { await api(`${tournamentId}/draw`); setMessage("組み合わせを抽選しました") } catch (e) { setMessage(e.message) }
    }
    const startGame = () => {
        const stageIds = state?.tournament?.stage_pool ?? []
        let ticks = 0
        setStageDrawing(true)
        const timer = setInterval(() => {
            const stageId = stageIds[Math.floor(Math.random() * stageIds.length)]
            setStagePreview(t.stage?.[stageId] || `ステージ ${stageId}`)
            ticks += 1
            if (ticks < 12) return
            clearInterval(timer)
            api(`${tournamentId}/matches/${selectedMatch.id}/games`).then(data => {
                const updated = data.state.rounds.flatMap(round => round.matches).find(match => match.id === selectedMatch.id)
                setSelectedMatch(updated)
            }).catch(e => setMessage(e.message)).finally(() => {
                setStageDrawing(false)
                setStagePreview("")
            })
        }, 90)
    }
    const record = async result => {
        try {
            const data = await api(`${tournamentId}/matches/${selectedMatch.id}/games/${pendingGame.id}`, "POST", {result})
            const updated = data.rounds.flatMap(round => round.matches).find(match => match.id === selectedMatch.id)
            if (updated?.status === "completed") setSelectedMatch(null)
            else setSelectedMatch(updated)
        } catch (e) { setMessage(e.message) }
    }
    const rounds = state?.rounds ?? []
    const lastResult = rounds.flatMap(round => round.matches.flatMap(match => match.games))
        .filter(game => game.result)
        .sort((a, b) => (b.result_sequence ?? 0) - (a.result_sequence ?? 0)
            || new Date(b.updated_at) - new Date(a.updated_at) || b.id - a.id)[0]
    const undoResult = async () => {
        if (!lastResult || undoing) return
        setUndoing(true)
        try {
            const data = await api(`${tournamentId}/undo-result`, "POST", {game_id: lastResult.id})
            setSelectedMatch(data.rounds.flatMap(round => round.matches).find(match => match.id === lastResult.match_id))
            setMessage("直前の結果を取り消しました。同じステージで結果を入力し直してください。")
        } catch (e) { setMessage(e.message) }
        finally { setUndoing(false) }
    }
    const playerRows = useMemo(() => state?.players ?? [], [state?.players])
    const rankingGroups = useMemo(() => {
        const swissRounds = [...(state?.rounds ?? [])]
            .filter(round => round.phase === "swiss")
            .sort((a, b) => a.round_no - b.round_no)
        const hasSecondRound = swissRounds.length >= 2
        const groups = []
        for (const second of hasSecondRound ? ["win", "loss", "pending"] : ["pending"]) {
            for (const first of ["win", "loss"]) {
                groups.push({key: `${first}-${second}`, first, second, players: []})
            }
        }
        const pending = {key: "pending", first: "pending", players: []}
        for (const player of playerRows) {
            const results = swissRounds.slice(0, 2).map(round => {
                const match = round.matches.find(item => item.player1_user_id === player.user_id || item.player2_user_id === player.user_id)
                if (!match || match.status !== "completed" || !match.winner_user_id) return "pending"
                return match.winner_user_id === player.user_id ? "win" : "loss"
            })
            const group = groups.find(item => item.first === results[0] && item.second === (results[1] ?? "pending")) ?? pending
            group.players.push(player)
        }
        const showPendingSecond = groups.some(group => group.second === "pending" && group.players.length)
        return [...groups.filter(group => !hasSecondRound || group.second !== "pending" || showPendingSecond), ...(pending.players.length ? [pending] : [])].map(group => ({
            ...group,
            label: group.first === "pending" ? "第1ラウンド 未確定・対戦前" : `第1ラウンド ${group.first === "win" ? "勝者" : "敗者"}${hasSecondRound ? ` ／ 第2ラウンド ${{win: "勝者", loss: "敗者", pending: "未確定"}[group.second]}` : ""}`,
            players: [...group.players].sort((a, b) => (a.provisional_rank ?? Number.MAX_SAFE_INTEGER) - (b.provisional_rank ?? Number.MAX_SAFE_INTEGER)),
        }))
    }, [playerRows, state?.rounds])

    return <Page>
        <SeoHead title="オンラインビンゴ・ダンドリバトル大会 - ピクチャレ大会" noindex={true}/>
        <Panel>
            <Typography variant="h4" component="h1">オンラインビンゴ・ダンドリバトル大会</Typography>
            {error && <Typography color="error">{error.message}</Typography>}
            {message && <Typography>{message}</Typography>}
            <ControlField select label="大会" value={tournamentId} onChange={e => setTournamentId(e.target.value)} size="small" style={{marginTop: 12, minWidth: 280, color: "inherit"}}>
                <MenuItem value="">大会を選択</MenuItem>
                {(tournaments ?? []).map(item => <MenuItem key={item.id} value={item.id}>{item.title}（{item.status}・{item.player_count}人）</MenuItem>)}
            </ControlField>
            {isAdmin && <Box style={{marginTop: 10}}>
                <ControlField label="新規大会名" size="small" value={title} onChange={e => setTitle(e.target.value)}/>
                <ControlButton variant="outlined" onClick={create} disabled={!title} style={{marginLeft: 8}}>新規開催</ControlButton>
            </Box>}
        </Panel>
        {state && <>
            {isAdmin && state.tournament.status === "registration" && <Panel>
                <Typography variant="h6">参加者登録</Typography>
                <Grid container spacing={1} style={{marginTop: 2}}>
                    <Grid item xs={12} md={5}><TextField fullWidth size="small" label="名前" value={playerName} onChange={e => setPlayerName(e.target.value)} inputProps={{maxLength: 255}}/></Grid>
                    <Grid item xs={12} md={3}><TextField fullWidth size="small" label="ビンゴパワー" type="number" value={rank} onChange={e => setRank(e.target.value)}/></Grid>
                    <Grid item><Button variant="contained" onClick={addPlayer} disabled={!playerName.trim()} startIcon={<PersonAddIcon/>}>追加</Button></Grid>
                </Grid>
                {playerRows.map(player => <Box key={player.id} style={{marginTop: 8}}>{name(users, player.user_id)} / ビンゴパワー {player.provisional_rank ?? "未設定"}<Button color="error" size="small" onClick={() => api(`${tournamentId}/players/${encodeURIComponent(player.user_id)}`, "DELETE")} style={{marginLeft: 8}}>削除</Button></Box>)}
            </Panel>}
            <Panel>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{state.tournament.title} / {state.tournament.status}</Typography>
                    {isAdmin && <Box display="flex" style={{gap: 8, flexWrap: "wrap"}}>
                        <ControlButton variant="outlined" disabled={!state.can_draw || state.tournament.status === "completed" || undoing} onClick={draw} startIcon={<CasinoIcon/>}>抽選</ControlButton>
                        <ControlButton variant="outlined" disabled={!lastResult || undoing || stageDrawing} onClick={undoResult}>直前の結果を取り消す</ControlButton>
                    </Box>}
                </Box>
                <Typography variant="body2" style={{marginTop: 8}}>第1ラウンド：左が勝者、右が敗者。第2ラウンド：上が勝者、下が敗者。第3ラウンド以降は区画を固定し、区画内はビンゴパワー順です。不戦勝も勝者に含みます。</Typography>
                <RankingGrid>
                    {rankingGroups.map(group => <RankingGroup key={group.key} style={group.first === "pending" ? {gridColumn: "1 / -1"} : undefined}>
                        <strong>{group.label}</strong>
                        {group.players.map(player => <PlayerCard key={player.id}>
                            <div>{name(users, player.user_id)}</div>
                            <small>ビンゴパワー {player.provisional_rank ?? "未設定"} / {player.wins}勝{player.losses}敗</small>
                        </PlayerCard>)}
                        {!group.players.length && <Typography variant="body2" style={{marginTop: 8}}>該当者なし</Typography>}
                    </RankingGroup>)}
                </RankingGrid>
            </Panel>
            {rounds.map(round => <Panel key={round.id}>
                <Typography variant="h6">{round.phase === "final" ? "決勝" : `${round.round_no}ラウンド`} {round.status === "completed" ? "（完了）" : ""}</Typography>
                {round.matches.map(match => <Match key={match.id} $complete={match.status === "completed"} disabled={!isAdmin || match.is_bye} onClick={() => isAdmin && !match.is_bye && setSelectedMatch(match)}>
                    <strong>第{match.match_no}戦　{name(users, match.player1_user_id)} {match.is_bye ? "（シード）" : ` ${match.player1_wins} - ${match.player2_wins} ${name(users, match.player2_user_id)}`}</strong>
                    {match.games.map(game => <GameLine key={game.id}>ゲーム{game.match_game_no}: {t.stage?.[game.stage_id] || `ステージ ${game.stage_id}`} / {game.result === "draw" ? "引き分け" : game.winner_user_id ? `${name(users, game.winner_user_id)} 勝利` : "結果入力待ち"}</GameLine>)}
                </Match>)}
            </Panel>)}
        </>}
        <Dialog open={Boolean(selectedMatch)} onClose={() => setSelectedMatch(null)} fullWidth maxWidth="sm">
            <DialogTitle>{selectedMatch && `第${selectedMatch.match_no}戦: ${name(users, selectedMatch.player1_user_id)} vs ${name(users, selectedMatch.player2_user_id)}`}</DialogTitle>
            <DialogContent>
                {stageDrawing ? <Typography variant="h5" align="center" style={{color: "#ffe08a"}}>ステージ抽選中: {stagePreview}</Typography> : pendingGame ? <><Typography variant="h5">ゲーム{pendingGame.match_game_no}: {stageName}</Typography><Typography style={{marginTop: 12}}>このゲームの結果を記録してください。</Typography></> : <Typography>次のゲームを抽選してください。</Typography>}
            </DialogContent>
            <DialogActions>
                {pendingGame ? <>
                    <Button onClick={() => record("player1")}>{name(users, selectedMatch.player1_user_id)} 勝利</Button>
                    <Button onClick={() => record("draw")}>引き分け</Button>
                    <Button onClick={() => record("player2")}>{name(users, selectedMatch.player2_user_id)} 勝利</Button>
                </> : selectedMatch?.status !== "completed" && <Button variant="contained" disabled={stageDrawing} onClick={startGame} startIcon={<CasinoIcon/>}>次ゲームを抽選</Button>}
                <Button onClick={() => setSelectedMatch(null)}>閉じる</Button>
            </DialogActions>
        </Dialog>
    </Page>
}
