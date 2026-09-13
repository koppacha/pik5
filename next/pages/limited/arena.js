import React, {useEffect, useMemo, useState} from "react"
import useSWR from "swr"
import {useSession} from "next-auth/react"
import styled from "styled-components"
import CryptoJS from "crypto-js"
import {
    Box,
    Button,
    ButtonGroup,
    FormControlLabel,
    Grid,
    Radio,
    RadioGroup,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material"
import CasinoIcon from "@mui/icons-material/Casino"
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep"
import PersonAddIcon from "@mui/icons-material/PersonAdd"
import PersonRemoveIcon from "@mui/icons-material/PersonRemove"
import SendIcon from "@mui/icons-material/Send"
import ShuffleIcon from "@mui/icons-material/Shuffle"
import SeoHead from "../../components/SeoHead"
import {id2name, useLocale} from "../../lib/pik5"

const arenaFetcher = async url => {
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) {
        const error = new Error(data?.message || "fetch error")
        error.status = res.status
        throw error
    }
    return data
}

const ROULETTE_COOKIE = "pik5_arena_roulette"
const ROULETTE_SECRET = "pik5-arena-roulette-v1"
const ROULETTE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const ROULETTE_BASE_DURATION_MS = 4300
const ROULETTE_DURATION_JITTER_MS = 420
const ROULETTE_MIN_LOOPS = 3
const ROULETTE_MAX_EXTRA_LOOPS = 1

const arenaStages = [
    {stageId: 10016, weight: 1},
    {stageId: 10017, weight: 1},
    {stageId: 10018, weight: 1},
    {stageId: 10019, weight: 1},
    {stageId: 10020, weight: 1},
    {stageId: 10021, weight: 1},
    {stageId: 10022, weight: 1},
    {stageId: 10023, weight: 1},
    {stageId: 10024, weight: 1},
    {stageId: 10025, weight: 1},
    {stageId: 10026, weight: 1},
    {stageId: 10027, weight: 1},
]

const Page = styled.div`
  min-height: 100vh;
  padding: 16px 296px 176px 16px;
  background: #101214;
  color: #f4f7fb;
`

const Management = styled.div`
  max-width: 1040px;
`

const Panel = styled.div`
  border: 1px solid #2c333a;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: #171b20;
`

const BottomDisplay = styled.div`
  position: fixed;
  left: 0;
  right: 300px;
  bottom: 0;
  z-index: 20;
  border-top: 1px solid #39414a;
  background: #080a0d;
  color: #f8fbff;
`

const DisplayRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(120px, 2fr) minmax(0, 5fr);
  min-height: 72px;
`

const WatcherRow = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.$columns}, minmax(88px, 1fr));
  min-height: 68px;
`

const InfoBlock = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 10px;
  border-right: 1px solid #303841;
  border-bottom: 1px solid #303841;
`

const BlockTitle = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  font-size: 1em;
`

const SummaryTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const SummaryTitleText = styled.span`
  font-size: 1em;
  font-weight: 700;
`

const SummaryDateText = styled.span`
  color: #ccc;
  font-size: 0.9em;
`

const RateSubText = styled.span`
  color: #ccc;
  font-size: 0.8em;
`

const MetaLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #b7c0ca;
  font-size: 0.9em;
`

const StageBlock = styled(InfoBlock)`
  text-align: center;
  background: #1b232b;
`

const RoulettePanel = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  width: 300px;
  box-sizing: border-box;
  overflow: hidden;
  border-left: 1px solid #39414a;
  background: #0b0f14;
  color: #f8fbff;
  padding: 64px 10px 10px;
`

const RouletteItem = styled.div`
  display: flex;
  align-items: center;
  min-height: 42px;
  padding: 6px 8px;
  margin-bottom: 6px;
  border: 1px solid ${props => props.$active ? "#f0c14b" : "#2c333a"};
  border-radius: 6px;
  background: ${props => props.$active ? "#2a2412" : "#151a20"};
  color: ${props => props.$active ? "#ffe08a" : "#d6dde6"};
  font-weight: ${props => props.$active ? 700 : 500};
  font-size: 0.9em;
`

const HistoryItem = styled.div`
  border: 1px solid #2c333a;
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 8px;
  background: #12161b;
`

const HistoryTitle = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-weight: 700;
`

const HistoryDetail = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  margin-top: 6px;
  color: #b7c0ca;
  font-size: 12px;
`

function readCookie(name) {
    if (typeof document === "undefined") return null
    const item = document.cookie.split("; ").find(row => row.startsWith(`${name}=`))
    return item ? decodeURIComponent(item.split("=").slice(1).join("=")) : null
}

function writeCookie(name, value) {
    if (typeof document === "undefined") return
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${ROULETTE_COOKIE_MAX_AGE}; Path=/limited/arena; SameSite=Lax`
}

function deleteCookie(name) {
    if (typeof document === "undefined") return
    document.cookie = `${name}=; Max-Age=0; Path=/limited/arena; SameSite=Lax`
}

function readRouletteHistory() {
    const encrypted = readCookie(ROULETTE_COOKIE)
    if (!encrypted) return []

    try {
        const raw = CryptoJS.AES.decrypt(encrypted, ROULETTE_SECRET).toString(CryptoJS.enc.Utf8)
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter(Number.isFinite) : []
    } catch {
        return []
    }
}

function writeRouletteHistory(history) {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(history), ROULETTE_SECRET).toString()
    writeCookie(ROULETTE_COOKIE, encrypted)
}

function clearTemporaryCookies() {
    deleteCookie(ROULETTE_COOKIE)
}

function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0)
    let cursor = Math.random() * total
    for (const item of items) {
        cursor -= item.weight
        if (cursor <= 0) return item
    }
    return items[items.length - 1]
}

function pickStage(history) {
    const counts = arenaStages.reduce((acc, stage) => {
        acc[stage.stageId] = history.filter(id => id === stage.stageId).length
        return acc
    }, {})
    const allPickedTwice = arenaStages.every(stage => counts[stage.stageId] >= 2)
    const recent = history.slice(0, 4)

    let candidates = arenaStages.filter(stage => {
        if (!allPickedTwice && counts[stage.stageId] >= 2) return false
        return !recent.includes(stage.stageId)
    })

    if (candidates.length === 0) {
        candidates = arenaStages.filter(stage => allPickedTwice || counts[stage.stageId] < 2)
    }
    if (candidates.length === 0) {
        candidates = arenaStages
    }

    return weightedPick(candidates)
}

function buildRouletteDelays(stepCount) {
    const totalDuration = ROULETTE_BASE_DURATION_MS + Math.random() * ROULETTE_DURATION_JITTER_MS
    const weights = Array.from({length: stepCount}, (_, index) => {
        const progress = stepCount <= 1 ? 1 : index / (stepCount - 1)
        return 0.55 + progress * progress * 1.8
    })
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)

    return weights.map(weight => totalDuration * weight / weightTotal)
}

function formatStageName(name) {
    if (!name) return "未定ステージ"
    const index = name.indexOf("（")
    if (index <= 0) return name
    return `${name.slice(0, index)}\n${name.slice(index)}`
}

function getPlayerName(users, userId, displayName = null) {
    if (displayName) return displayName
    if (!userId) return "-"
    const name = id2name(users, userId)
    return name && name !== "名無し" ? name : "名無し"
}

function RateDisplay({player}) {
    if (!player) return <span>-</span>
    const delta = Number(player.current_point || 0) - Number(player.start_point || 0)
    return (
        <span>
            <span>{player.current_point}</span>{" "}
            <RateSubText>/ {player.start_point} ({delta >= 0 ? "+" : ""}{delta})</RateSubText>
        </span>
    )
}

function getCurrentTimeText(now) {
    if (!now) return "--:--:--"
    return now.toLocaleTimeString("ja-JP", {hour: "2-digit", minute: "2-digit", second: "2-digit"})
}

function getCurrentDateTimeText(now) {
    if (!now) return "--月--日 --:--:--"
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const date = String(now.getDate()).padStart(2, "0")
    return `${month}月${date}日 ${getCurrentTimeText(now)}`
}

function historyResultMark(result) {
    switch (Number(result)) {
        case 1:
            return "○ - ×"
        case -1:
            return "× - ○"
        default:
            return "△ - △"
    }
}

function resultRateText(result) {
    if (!result) return "-"
    return `${result.point} → ${result.point_result} (${result.score ?? ""})`
}

function paymentFromRating(rating) {
    const extra = Math.max(0, Number(rating || 0) - 1000)
    const payment = Math.round(Number(rating || 0) * 0.10 + (extra * extra) / 10000)
    return Math.max(50, Math.min(payment, 220))
}

function receiverFee(holder, latestMatchNo) {
    if (!holder || Number(holder.current_streak || 0) <= 0 || Number(latestMatchNo || 0) <= 0) return 0
    const fee = Math.round(paymentFromRating(holder.current_point) * 0.10)
    return Math.max(5, Math.min(fee, 15))
}

function playerWinGain(holder, challenger, watchers, resultType) {
    if (!holder || !challenger) return 0
    const holderPayment = paymentFromRating(holder.current_point)
    const challengerPayment = paymentFromRating(challenger.current_point)
    const streak = Number(holder.current_streak || 0)
    const fee = streak > 0 ? Math.max(5, Math.min(Math.round(holderPayment * 0.10), 15)) : 0
    const pot = holderPayment + challengerPayment + fee * watchers.length
    const baseShare = resultType === "holder"
        ? ({0: 0.70, 1: 0.70, 2: 0.71, 3: 0.72, 4: 0.73}[streak] ?? 0.75)
        : ({0: 0.70, 1: 0.72, 2: 0.74, 3: 0.76, 4: 0.78}[streak] ?? 0.80)
    const winnerPayment = resultType === "holder" ? holderPayment : challengerPayment
    const share = Math.min(Math.max(baseShare, (winnerPayment + 5) / pot), 0.90)
    return Math.round(pot * share) - winnerPayment
}

function PlayerBlock({title, player, users, isHolder, winGain, participationFee}) {
    return (
        <InfoBlock>
            <BlockTitle>
                <span>{title}: {getPlayerName(users, player?.user_id, player?.display_name)}</span>
                <RateDisplay player={player}/>
            </BlockTitle>
            <MetaLine>
                <span>{isHolder ? `現在: ${player?.current_streak ?? 0}連勝` : `${player?.wins ?? 0}勝${player?.losses ?? 0}敗`}</span>
                <span>最高: {player?.highest_streak ?? 0}連勝</span>
                <span>勝利時: {winGain >= 0 ? "+" : ""}{winGain}</span>
                <span>参加費: {participationFee}</span>
            </MetaLine>
        </InfoBlock>
    )
}

function WatcherBlock({player, users}) {
    return (
        <InfoBlock>
            <BlockTitle>
                <span>{getPlayerName(users, player?.user_id, player?.display_name)}</span>
                <RateDisplay player={player}/>
            </BlockTitle>
            <MetaLine>
                <span>{player?.wins ?? 0}勝{player?.losses ?? 0}敗</span>
                <span>最高: {player?.highest_streak ?? 0}連勝</span>
            </MetaLine>
        </InfoBlock>
    )
}

export async function getServerSideProps() {
    const {default: prisma} = await import("../../lib/prisma")
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true,
        },
    })

    let initialArenaState = null
    try {
        const stateRes = await fetch("http://laravel:8000/api/new-arena/state")
        if (stateRes.ok) {
            initialArenaState = await stateRes.json()
            const nameByUserId = new Map(users.map(user => [user.userId, user.name]))
            initialArenaState = {
                ...initialArenaState,
                players: (initialArenaState.players ?? []).map(player => ({
                    ...player,
                    display_name: nameByUserId.get(player.user_id) || null,
                })),
                history: (initialArenaState.history ?? []).map(match => ({
                    ...match,
                    holder_display_name: nameByUserId.get(match.holder_user_id) || null,
                    challenger_display_name: nameByUserId.get(match.challenger_user_id) || null,
                })),
            }
        }
    } catch {
        initialArenaState = null
    }

    return {props: {users, initialArenaState}}
}

export default function ArenaPage({users, initialArenaState}) {
    const {t} = useLocale()
    const {data: session} = useSession()
    const isAdmin = Number(session?.user?.role || 0) === 10
    const {data, error, mutate} = useSWR("/api/arena/state", arenaFetcher, {
        fallbackData: initialArenaState,
        refreshInterval: 1000,
    })
    const players = data?.players ?? []
    const holder = players.find(player => Number(player.position) === 1)
    const challenger = players.find(player => Number(player.position) === 2)
    const watchers = players.filter(player => Number(player.position) >= 3)
    const visibleWatchers = watchers.slice(0, 10)
    const watcherIds = useMemo(() => watchers.map(player => player.user_id).join(","), [watchers])
    const [now, setNow] = useState(null)
    const [userId, setUserId] = useState("")
    const [selectedStageId, setSelectedStageId] = useState("")
    const [activeStageId, setActiveStageId] = useState(arenaStages[0].stageId)
    const [isSpinning, setIsSpinning] = useState(false)
    const [form, setForm] = useState({
        stage_id: "",
        user_id_1p: "",
        user_id_2p: "",
        score_1p: "",
        score_2p: "",
        receivers: "",
        result: "1",
    })
    const [message, setMessage] = useState("")

    const stageName = useMemo(() => {
        const name = selectedStageId ? t.stage?.[selectedStageId] : ""
        return formatStageName(name)
    }, [selectedStageId, t.stage])

    useEffect(() => {
        setNow(new Date())
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        setForm(prev => ({
            ...prev,
            stage_id: selectedStageId ? String(selectedStageId) : prev.stage_id,
            user_id_1p: holder?.user_id ?? "",
            user_id_2p: challenger?.user_id ?? "",
            receivers: watcherIds,
        }))
    }, [selectedStageId, holder?.user_id, challenger?.user_id, watcherIds])

    const sendArenaPost = async (path, body = {}) => {
        const res = await fetch(`/api/arena/${path}`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify(body),
        })
        const response = await res.json()
        if (!res.ok) {
            throw new Error(response?.message || "request failed")
        }
        await mutate(response, false)
        return response
    }

    const handleAdd = async () => {
        try {
            await sendArenaPost("player/add", {user_id: userId})
            setUserId("")
            setMessage("ユーザーを追加しました")
        } catch (e) {
            setMessage(`追加できません: ${e.message}`)
        }
    }

    const handleRemove = async () => {
        try {
            await sendArenaPost("player/remove", {user_id: userId})
            setUserId("")
            setMessage("ユーザーを削除しました")
        } catch (e) {
            setMessage(`削除できません: ${e.message}`)
        }
    }

    const handleShuffle = async () => {
        try {
            await sendArenaPost("shuffle")
            setMessage("並び順をシャッフルしました")
        } catch (e) {
            setMessage(`シャッフルできません: ${e.message}`)
        }
    }

    const handleRoulette = () => {
        if (isSpinning) return
        const history = readRouletteHistory()
        const selected = pickStage(history)
        const startIndex = Math.max(0, arenaStages.findIndex(stage => Number(stage.stageId) === Number(activeStageId)))
        const selectedIndex = Math.max(0, arenaStages.findIndex(stage => Number(stage.stageId) === Number(selected.stageId)))
        const distance = (selectedIndex - startIndex + arenaStages.length) % arenaStages.length
        const loopCount = ROULETTE_MIN_LOOPS + Math.floor(Math.random() * (ROULETTE_MAX_EXTRA_LOOPS + 1))
        const maxTick = arenaStages.length * loopCount + distance
        const delays = buildRouletteDelays(maxTick)
        setIsSpinning(true)

        let tick = 0
        const spin = () => {
            tick += 1
            const flowStage = arenaStages[(startIndex + tick) % arenaStages.length]
            setActiveStageId(tick >= maxTick ? selected.stageId : flowStage.stageId)

            if (tick >= maxTick) {
                const nextHistory = [selected.stageId, ...history].slice(0, 48)
                writeRouletteHistory(nextHistory)
                setSelectedStageId(selected.stageId)
                setForm(prev => ({...prev, stage_id: String(selected.stageId)}))
                setIsSpinning(false)
                return
            }

            setTimeout(spin, delays[tick - 1])
        }
        spin()
    }

    const handleClearTemporaryCookies = () => {
        clearTemporaryCookies()
        setMessage("一時保存Cookieを空にしました")
    }

    const handleSubmit = async () => {
        try {
            await sendArenaPost("result", form)
            setSelectedStageId("")
            setForm(prev => ({...prev, stage_id: "", score_1p: "", score_2p: ""}))
            setMessage("対戦結果を送信しました")
        } catch (e) {
            setMessage(`送信できません: ${e.message}`)
        }
    }

    const latestMatchNo = Number(data?.latest_match_no || 0)
    const nextMatchNo = latestMatchNo + 1
    const fee = receiverFee(holder, latestMatchNo)
    const holderPayment = holder ? paymentFromRating(holder.current_point) : 0
    const challengerPayment = challenger ? paymentFromRating(challenger.current_point) : 0
    const holderWinGain = playerWinGain(holder, challenger, watchers, "holder")
    const challengerWinGain = playerWinGain(holder, challenger, watchers, "challenger")

    return (
        <Page>
            <SeoHead title="ピクチャレアリーナ対戦 - ピクチャレ大会" noindex={true}/>
            <Management>
                <Typography variant="h4" component="h1" style={{marginBottom: 12}}>ピクチャレアリーナ対戦</Typography>
                {error && <Panel>読み込みに失敗しました: {error.message}</Panel>}
                {message && <Panel>{message}</Panel>}
                {isAdmin ? (
                    <>
                        <Panel>
                            <Typography variant="h6" component="h2" style={{marginBottom: 8}}>管理領域</Typography>
                            <Grid container spacing={1}>
                                <Grid item xs={12} md={5}>
                                    <TextField
                                        label="user_id"
                                        value={userId}
                                        onChange={e => setUserId(e.target.value)}
                                        size="small"
                                        fullWidth
                                        InputLabelProps={{style: {color: "#b7c0ca"}}}
                                        inputProps={{style: {color: "#fff"}}}
                                    />
                                </Grid>
                                <Grid item>
                                    <ButtonGroup variant="contained">
                                        <Tooltip title="ユーザー追加">
                                            <Button onClick={handleAdd} startIcon={<PersonAddIcon/>}>追加</Button>
                                        </Tooltip>
                                        <Tooltip title="ユーザー削除">
                                            <Button onClick={handleRemove} color="error" startIcon={<PersonRemoveIcon/>}>削除</Button>
                                        </Tooltip>
                                    </ButtonGroup>
                                </Grid>
                                <Grid item>
                                    <Tooltip title="最初の並び順をシャッフル">
                                        <span>
                                            <Button
                                                variant="outlined"
                                                onClick={handleShuffle}
                                                disabled={latestMatchNo > 0}
                                                startIcon={<ShuffleIcon/>}
                                            >
                                                シャッフル
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Grid>
                                <Grid item>
                                    <Tooltip title="ステージ抽選">
                                        <span>
                                            <Button
                                                variant="contained"
                                                color="warning"
                                                onClick={handleRoulette}
                                                disabled={isSpinning}
                                                startIcon={<CasinoIcon/>}
                                            >
                                                ルーレット
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Grid>
                                <Grid item>
                                    <Tooltip title="DBに記録しない一時保存Cookieを空にする">
                                        <Button
                                            variant="outlined"
                                            color="inherit"
                                            onClick={handleClearTemporaryCookies}
                                            startIcon={<DeleteSweepIcon/>}
                                        >
                                            Cookieクリア
                                        </Button>
                                    </Tooltip>
                                </Grid>
                            </Grid>
                        </Panel>

                        <Panel>
                            <Typography variant="h6" component="h2" style={{marginBottom: 8}}>対戦結果入力</Typography>
                            <Grid container spacing={1}>
                                {[
                                    ["stage_id", "stage"],
                                    ["user_id_1p", "user_id_1p"],
                                    ["user_id_2p", "user_id_2p"],
                                    ["score_1p", "score_1p"],
                                    ["score_2p", "score_2p"],
                                    ["receivers", "receivers"],
                                ].map(([key, label]) => (
                                    <Grid item xs={12} md={key === "receivers" ? 12 : 4} key={key}>
                                        <TextField
                                            label={label}
                                            value={form[key]}
                                            onChange={e => setForm(prev => ({...prev, [key]: e.target.value}))}
                                            size="small"
                                            fullWidth
                                            InputLabelProps={{style: {color: "#b7c0ca"}}}
                                            inputProps={{style: {color: "#fff"}}}
                                        />
                                    </Grid>
                                ))}
                                <Grid item xs={12}>
                                    <RadioGroup
                                        row
                                        value={form.result}
                                        onChange={e => setForm(prev => ({...prev, result: e.target.value}))}
                                    >
                                        <FormControlLabel value="1" control={<Radio/>} label="チャンピオン勝利"/>
                                        <FormControlLabel value="-1" control={<Radio/>} label="チャレンジャー勝利"/>
                                        <FormControlLabel value="0" control={<Radio/>} label="特殊処理"/>
                                    </RadioGroup>
                                </Grid>
                                <Grid item>
                                    <Button
                                        variant="contained"
                                        onClick={handleSubmit}
                                        disabled={!form.stage_id}
                                        startIcon={<SendIcon/>}
                                    >
                                        送信
                                    </Button>
                                </Grid>
                            </Grid>
                        </Panel>

                        <Panel>
                            <Typography variant="h6" component="h2" style={{marginBottom: 8}}>対戦履歴</Typography>
                            {(data?.history ?? []).map(match => (
                                <HistoryItem key={match.id}>
                                    <HistoryTitle>
                                        <span>{match.match_no}戦目</span>
                                        <span>{t.stage?.[match.stage_id] ?? `仮ステージ ${match.stage_id ?? "-"}`}</span>
                                        <span>{getPlayerName(users, match.holder_user_id, match.holder_display_name)}</span>
                                        <span>{historyResultMark(match.result)}</span>
                                        <span>{getPlayerName(users, match.challenger_user_id, match.challenger_display_name)}</span>
                                    </HistoryTitle>
                                    <HistoryDetail>
                                        <div>{getPlayerName(users, match.holder_user_id, match.holder_display_name)}: {resultRateText(match.holder_result)}</div>
                                        <div>{getPlayerName(users, match.challenger_user_id, match.challenger_display_name)}: {resultRateText(match.challenger_result)}</div>
                                    </HistoryDetail>
                                </HistoryItem>
                            ))}
                        </Panel>
                    </>
                ) : (
                    <Panel>管理領域は管理者のみ表示されます。</Panel>
                )}
            </Management>

            <RoulettePanel>
                <Typography variant="h6" component="h2" style={{marginBottom: 8}}>Stage Roulette</Typography>
                {arenaStages.map(stage => (
                    <RouletteItem key={stage.stageId} $active={Number(activeStageId) === Number(stage.stageId)}>
                        {t.stage?.[stage.stageId] ?? `仮ステージ ${stage.stageId}`}
                    </RouletteItem>
                ))}
            </RoulettePanel>

            <BottomDisplay>
                <DisplayRow>
                    <PlayerBlock
                        title="暫定チャンピオン"
                        player={holder}
                        users={users}
                        isHolder={true}
                        winGain={holderWinGain}
                        participationFee={holderPayment}
                    />
                    <StageBlock>
                        <BlockTitle style={{justifyContent: "center"}}>
                            <span>{nextMatchNo}戦目</span>
                            <span style={{fontSize:"0.9em",color:"#ccc"}}>（観戦料 {fee}）</span>
                        </BlockTitle>
                        <div style={{whiteSpace: "pre-line", fontSize: 16, fontWeight: 700}}>{selectedStageId ? stageName : "ステージ未抽選"}</div>
                    </StageBlock>
                    <PlayerBlock
                        title="チャレンジャー"
                        player={challenger}
                        users={users}
                        isHolder={false}
                        winGain={challengerWinGain}
                        participationFee={challengerPayment}
                    />
                </DisplayRow>
                <WatcherRow $columns={Math.max(1, visibleWatchers.length + 1)}>
                    <InfoBlock>
                        <SummaryTitle>
                            <SummaryTitleText>第1回ピクチャレアリーナ対戦</SummaryTitleText>
                            <SummaryDateText>{getCurrentDateTimeText(now)}</SummaryDateText>
                        </SummaryTitle>
                        <MetaLine>
                            <span>{latestMatchNo}/{data?.event?.match_limit ?? 20}戦完了</span>
                            <span>参加者 {players.length}人</span>
                        </MetaLine>
                    </InfoBlock>
                    {visibleWatchers.map(player => (
                        <WatcherBlock key={player.user_id} player={player} users={users}/>
                    ))}
                </WatcherRow>
            </BottomDisplay>
        </Page>
    )
}
