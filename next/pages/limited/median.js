import {useCallback, useEffect, useRef, useState} from 'react'
import {useSession} from 'next-auth/react'
import Head from 'next/head'
import {Noto_Serif_JP} from 'next/font/google'
import styled from 'styled-components'
import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Tab, Tabs, TextField} from '@mui/material'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faWebAwesome} from '@fortawesome/free-solid-svg-icons'
import {motion} from 'framer-motion'
import {bubbleFrames} from '../../lib/median/reveal.cjs'

const promptFont = Noto_Serif_JP({weight: '700', subsets: ['latin'], display: 'swap'})
const Shell = styled.div`
    --median-input-bg: var(--color-card-bg);
    --median-input-text: var(--color-text-base);
    --median-input-label: var(--color-text-sub);
    --median-input-border: var(--color-border-base);
    --median-input-focus: #1976d2;
    --median-input-error: #c62828;
    --form-helper-text-color: var(--median-input-label);
    --form-helper-error-color: var(--median-input-error);
    [data-theme='dark'] & {
        --median-input-bg: #2b2d33;
        --median-input-text: #f3f4f6;
        --median-input-label: #cbd5e1;
        --median-input-border: #9ca3af;
        --median-input-focus: #90caf9;
        --median-input-error: #ffb4ab;
    }
    width: 100%; max-width: none; box-sizing: border-box; margin: 24px 0; padding: 16px; color: var(--color-text-base);
    .MuiOutlinedInput-root { color: var(--median-input-text); background-color: var(--median-input-bg); border-radius: 10px; }
    .MuiOutlinedInput-input { color: var(--median-input-text); -webkit-text-fill-color: var(--median-input-text); caret-color: var(--median-input-text); }
    .MuiOutlinedInput-notchedOutline { border-color: var(--median-input-border); }
    .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline { border-color: var(--median-input-text); }
    .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline { border-color: var(--median-input-focus); }
    .MuiInputLabel-root, .MuiFormHelperText-root { color: var(--median-input-label); }
    .MuiInputLabel-root.Mui-focused { color: var(--median-input-focus); }
    .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline { border-color: var(--median-input-error); }
    .MuiInputLabel-root.Mui-error, .MuiFormHelperText-root.Mui-error { color: var(--median-input-error); }
    .topline, .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .topline { justify-content: space-between; }
    .controls { justify-content: center; }
    h1 { font-size: 2rem; margin: 0; letter-spacing: .08em; }
    .muted { opacity: .7; font-size: .85rem; }
    .players { display: grid; grid-template-columns: repeat(var(--columns), minmax(90px, 1fr)); gap: 8px; margin: 24px 0; overflow-x: auto; }
    .player { min-width: 90px; padding: 12px 8px; border-radius: 12px; background: var(--color-card-bg); text-align: center; overflow-wrap: anywhere; }
    .score { display: block; font-size: 1.6rem; font-weight: bold; }
    .prompt { text-align: center; font-size: clamp(1.5rem, 4vw, 2.8rem); padding: 32px 12px; min-height: 140px; overflow-wrap: anywhere; }
    .panel { border: 1px solid #7775; border-radius: 16px; padding: 20px; margin: 20px 0; }
    .answers { display: grid; grid-template-columns: repeat(var(--columns), minmax(100px, 1fr)); gap: 12px; overflow-x: auto; padding: 4px; }
    .answer { border: 4px solid #7776; border-radius: 14px; padding: 16px; overflow-wrap: anywhere; }
    .answer > b { display: block; margin-bottom: 16px; }
    .answer.minimum { border-color: #287d79; }
    .answer.maximum { border-color: #a94343; }
    .answer.median { border-color: #ffe34a; }
    .answer strong { display: block; font-size: 1.4rem; margin: 10px 0; }
    .answer-group { display: contents; }
    .round-status { display: flex; align-items: center; justify-content: center; min-height: 72px; box-sizing: border-box; text-align: center; padding: 12px; margin-bottom: 16px; }
    .next-controls { margin-top: 20px; }
    .input-dock { position: fixed; inset: auto 0 0; z-index: 40; margin: 0; border-radius: 16px 16px 0 0; background: var(--color-bg-base); box-shadow: 0 -4px 20px #0003; max-height: 45vh; max-height: 45dvh; overflow-y: auto; padding-bottom: calc(16px + env(safe-area-inset-bottom)); }
    .dock-tabs { margin-bottom: 12px; border-bottom: 1px solid #7775; }
    .dock-tabs .MuiTab-root { color: var(--median-input-label); }
    .dock-tabs .Mui-selected { color: var(--median-input-focus); }
    .dock-form { display: grid; gap: 12px; padding: 4px; }
    .input-dock .answers { grid-template-columns: repeat(var(--columns), minmax(220px, 1fr)); }
    .subarea { padding-top: 400px; }
    .history { max-height: 360px; overflow-y: auto; }
    .history article { border-bottom: 1px solid #7775; padding: 12px 0; overflow-wrap: anywhere; }
    .queue textarea { max-height: min(160px, 18dvh); overflow-y: auto !important; }
    .join { max-width: 520px; margin: 40px auto; }
    .legend { display: flex; gap: 20px; flex-wrap: wrap; font-size: .9rem; }
    @media (max-width: 600px) { padding: 4px; .panel { padding: 14px; } .input-dock { bottom: 62px; padding-bottom: calc(14px + env(safe-area-inset-bottom)); } }
`

const columns = count => Math.max(1, count <= 10 ? count : Math.ceil(count / 2))
const phaseNames = {waiting: '出題待ち', answering: '回答受付中', closing: '回答を回収中', closed: '締切済み', revealed: '回答開示'}

function AnswerCard({answer, highlight, children}) {
    return <motion.div layout transition={{duration: 0.25}} className={`answer ${highlight && answer.minimum ? 'minimum' : ''} ${highlight && answer.maximum ? 'maximum' : ''} ${highlight && answer.median ? 'median' : ''}`}>
        <span>{answer.name}</span>
        {answer.raw && answer.raw !== answer.display && <div className="muted">入力：{answer.raw}</div>}
        <strong>{answer.display}</strong>
        {!answer.valid && <div className="muted">無効な入力のため0扱い</div>}
        {highlight && <span>{answer.points > 0 ? '+' : ''}{answer.points}点</span>}
        {children}
    </motion.div>
}

export default function Median() {
    const {data: session, status} = useSession()
    const [game, setGame] = useState(null)
    const gameRef = useRef(null)
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState('')
    const [connectionError, setConnectionError] = useState('')
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [confirm, setConfirm] = useState(null)
    const [raw, setRaw] = useState('')
    const rawRef = useRef('')
    const [answerStatus, setAnswerStatus] = useState('')
    const [answerError, setAnswerError] = useState(false)
    const answerVersion = useRef(0)
    const dirtyAnswer = useRef(false)
    const chain = useRef(Promise.resolve())
    const [queue, setQueue] = useState('')
    const queueTextRef = useRef('')
    const queueEditRevision = useRef(0)
    const queueSaveChain = useRef(Promise.resolve())
    const [queueStatus, setQueueStatus] = useState('')
    const dirtyQueue = useRef(false)
    const queueVersion = useRef(0)
    const [suggestion, setSuggestion] = useState('')
    const [dockTab, setDockTab] = useState('answer')
    const [removeName, setRemoveName] = useState('')
    const [removeId, setRemoveId] = useState('')
    const [reveal, setReveal] = useState({key: '', answers: [], done: false})
    const inputDockRef = useRef(null)
    const [dockSpace, setDockSpace] = useState(0)
    const roundKey = `${game?.id || ''}:${game?.round?.id || ''}:${game?.me || ''}`
    const active = game?.players.filter(p => p.active) || []
    const ownPlayer = active.find(player => player.id === game?.me)
    const removalMatches = active.filter(player => player.id !== game?.host && player.name === removeName)
    const removalTarget = removalMatches.length === 1 ? removalMatches[0] : removalMatches.find(player => player.id === removeId)
    const visibleDockTab = (dockTab === 'manage' && !game?.isHost) || (dockTab === 'queue' && !game?.isHost) || (dockTab === 'suggest' && game?.isHost) ? 'answer' : dockTab
    const showInputDock = Boolean(ownPlayer && !game.ended)
    const roundMessage = game?.ended ? '' : game?.phase === 'waiting' ? '次のお題を待っています' : game?.me && game.phase === 'closed' ? '回答を締め切り、採点結果を保存しました。開示をお待ちください。' : game?.me && game.phase === 'closing' ? '受付を停止し、各参加者の回答を保存しています…' : ''

    useEffect(() => {
        const dock = inputDockRef.current
        if (!showInputDock || !dock) {setDockSpace(0); return}
        const measure = () => {
            const rect = dock.getBoundingClientRect()
            setDockSpace(Math.ceil(rect.height + Math.max(0, window.innerHeight - rect.bottom) + 24))
        }
        const observer = new ResizeObserver(measure)
        observer.observe(dock)
        window.addEventListener('resize', measure)
        measure()
        return () => {observer.disconnect(); window.removeEventListener('resize', measure)}
    }, [showInputDock])

    const apply = useCallback(data => {
        const next = data.game
        const current = gameRef.current
        if (current && next && (next.id < current.id || (next.id === current.id && next.version < current.version))) return
        if (next?.id !== current?.id) {
            dirtyQueue.current = false
            queueEditRevision.current++
            setQueueStatus('')
        }
        gameRef.current = next
        setGame(next)
        setLoaded(true)
    }, [])

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/median', {cache: 'no-store'})
            const data = await res.json().catch(() => {throw new Error('通信を再試行しています')})
            if (!res.ok) throw new Error(data.message)
            apply(data)
            setConnectionError('')
        } catch (e) { setConnectionError(e.message || '状態を取得できません') }
    }, [apply])

    useEffect(() => {
        let cancelled = false
        let timer
        const poll = async () => {
            if (!cancelled && (!document.hidden || ['answering', 'closing'].includes(gameRef.current?.phase))) await refresh()
            if (!cancelled) timer = setTimeout(poll, 2000)
        }
        poll()
        return () => {cancelled = true; clearTimeout(timer)}
    }, [refresh])

    const send = useCallback(async (action, extra = {}) => {
        const res = await fetch('/api/median', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({action, gameId: gameRef.current?.id, ...extra})})
        const data = await res.json().catch(() => {throw new Error('通信できませんでした。再度お試しください')})
        if (!res.ok) throw new Error(data.message || '操作できませんでした')
        apply(data)
        return data.game
    }, [apply])

    useEffect(() => {
        const own = gameRef.current?.round?.own
        setRaw(own?.raw || '')
        rawRef.current = own?.raw || ''
        dirtyAnswer.current = false
        answerVersion.current++
        setAnswerStatus(own ? (own.error || `保存済み：${own.display}`) : '')
        setAnswerError(own?.valid === false)
    }, [roundKey])

    useEffect(() => {
        if (!dirtyQueue.current) {
            const text = (game?.queue || []).join('\n')
            setQueue(text)
            queueTextRef.current = text
            queueVersion.current = game?.queueVersion || 0
        }
    }, [game?.queue, game?.queueVersion])

    const saveAnswer = useCallback((force = false, closeToken = null) => {
        if (!force && !dirtyAnswer.current) return chain.current
        const current = gameRef.current
        if (!current?.me || current.ended || (current.phase !== 'answering' && !(current.phase === 'closing' && closeToken)) || !current.round.eligible) return chain.current
        const version = answerVersion.current
        const text = rawRef.current
        dirtyAnswer.current = false
        setAnswerStatus('保存中…')
        const task = chain.current.catch(() => {}).then(() => send('answer', {gameId: current.id, roundId: current.round.id, raw: text, ...(closeToken && {closeToken})}))
        chain.current = task
        task.then(next => {
            if (answerVersion.current !== version) return
            const own = next.round.own
            setAnswerStatus(own.error || `保存済み：${own.display}`)
            setAnswerError(!own.valid)
        }).catch(e => {
            if (answerVersion.current !== version) return
            dirtyAnswer.current = true
            setAnswerStatus(e.message)
            setAnswerError(true)
        })
        return task
    }, [send])

    useEffect(() => {
        const timer = setTimeout(() => {saveAnswer()?.catch(() => {})}, 400)
        return () => clearTimeout(timer)
    }, [raw, saveAnswer])

    useEffect(() => {
        if (game?.phase !== 'closing' || !game.round?.awaitingFinal || game.ended) return
        let cancelled = false
        let retry
        const token = game.round.closeToken
        const submit = async () => {
            if (cancelled || gameRef.current?.phase !== 'closing' || gameRef.current?.round?.closeToken !== token) return
            try { await saveAnswer(true, token) }
            catch {
                if (!cancelled && Date.now() < game.round.closeDeadline) retry = setTimeout(submit, 500)
            }
        }
        submit()
        return () => {cancelled = true; clearTimeout(retry)}
    }, [game?.phase, game?.round?.closeToken, game?.round?.awaitingFinal, game?.round?.closeDeadline, game?.ended, saveAnswer])

    const revealKey = game?.phase === 'revealed' ? `${game.id}:${game.round.id}` : ''
    useEffect(() => {
        if (!revealKey) return
        const initial = gameRef.current.round.answers
        const frames = bubbleFrames(initial)
        setReveal({key: revealKey, answers: initial, done: false})
        let timer
        let cancelled = false
        const advance = () => {
            if (cancelled) return
            const frame = frames.next()
            setReveal({key: revealKey, answers: frame.value, done: frame.done})
            if (!frame.done) timer = setTimeout(advance, 1000 / 3)
        }
        timer = setTimeout(advance, 1000)
        return () => {cancelled = true; clearTimeout(timer)}
    }, [revealKey])

    const saveQueue = () => {
        const gameId = gameRef.current?.id
        const task = queueSaveChain.current.catch(() => {}).then(async () => {
            if (!dirtyQueue.current || gameRef.current?.id !== gameId) return
            const revision = queueEditRevision.current
            setQueueStatus('保存中…')
            try {
                const next = await send('queue', {gameId, text: queueTextRef.current, queueVersion: queueVersion.current})
                if (gameRef.current?.id !== gameId) return
                setError('')
                queueVersion.current = next.queueVersion
                if (revision === queueEditRevision.current) {
                    dirtyQueue.current = false
                    queueTextRef.current = next.queue.join('\n')
                    setQueue(queueTextRef.current)
                    setQueueStatus('保存済み')
                } else setQueueStatus('未保存の変更があります')
            } catch (error) {
                if (gameRef.current?.id === gameId) setQueueStatus('保存できませんでした。入力内容は保持しています。')
                throw error
            }
        })
        queueSaveChain.current = task
        return task
    }

    const act = async (action, extra = {}) => {
        setBusy(true)
        setError('')
        try {
            if (action === 'close') await saveAnswer(true)
            if (['show', 'receive', 'restart'].includes(action)) await saveQueue()
            await send(action, {...extra, ...(action === 'close' && {roundId: gameRef.current?.round?.id})})
            if (action === 'suggest') setSuggestion('')
        } catch (e) { setError(e.message) }
        finally { setBusy(false) }
    }

    const sortDone = reveal.key === revealKey && reveal.done
    const answers = reveal.key === revealKey ? reveal.answers : (game?.round?.answers || [])
    const groups = answers.reduce((list, answer) => {
        if (list.at(-1)?.[0].value === answer.value) list.at(-1).push(answer)
        else list.push([answer])
        return list
    }, [])

    const leaveButton = playerId => {
        if (game?.ended) return null
        if (!game?.isHost && playerId === game?.me) return <Button disabled={busy} onClick={() => setConfirm({action: 'leave', title: 'イベントから離脱しますか？'})}>イベントから離脱する</Button>
        return null
    }

    return <Shell style={dockSpace ? {paddingBottom: dockSpace} : undefined}>
        <Head><title>Median — 中央値ゲーム</title><meta name="robots" content="noindex" /></Head>
        <div className="topline"><div><h1>中央値ゲーム</h1><span className="muted">https://pik5.net/limited/median</span></div>
            {game && <span className="muted">#{game.id} · {game.ended ? '終了' : phaseNames[game.phase]}</span>}</div>
        {(error || connectionError) && <Alert severity="error" onClose={() => {setError(''); setConnectionError('')}} style={{marginTop: 16}}>{error || connectionError}</Alert>}
        {!loaded && <p role="status">読み込み中…</p>}
        {loaded && !game?.me && <section className="panel join">
            <h2>{game?.ended ? 'ゲームは終了しました' : 'ゲームに参加'}</h2>
            {status === 'loading' ? <p>ログイン情報を確認中…</p> : <>
                {session?.user ? <p>参加名：{session.user.name}</p> : <TextField label="プレイヤー名" value={name} onChange={e => setName(e.target.value)} inputProps={{maxLength: 80}} fullWidth />}
                <div className="controls" style={{marginTop: 20}}>
                    {(!game?.host || game?.ended) && <Button variant="contained" disabled={busy || (!session && !name.trim())} onClick={() => act('join', {host: true, name})}>主催として参加</Button>}
                    {!game?.ended && <Button variant="outlined" disabled={busy || (!session && !name.trim())} onClick={() => act('join', {host: false, name})}>参加者として参加</Button>}
                </div>
                <p className="muted">匿名参加は名前の完全一致で再入場できます。ログイン参加はアカウントごとに扱います。</p>
            </>}
        </section>}
        {!!active.length && <div className="players" style={{'--columns': columns(active.length)}}>
            {active.map(player => <div className="player" key={player.id}>
                {game.host === player.id && <FontAwesomeIcon icon={faWebAwesome} title="主催" style={{marginRight: 6}} />}{player.name}
                <span className="score">{player.score - (game.phase === 'revealed' && !sortDone ? (game.round.answers.find(a => a.playerId === player.id)?.points || 0) : 0)}</span>
            </div>)}
        </div>}
        {game && <>
            <div className={`prompt ${promptFont.className}`} aria-hidden={!game.ended && !game.round?.prompt}>{game.ended ? 'ゲーム終了' : game.round?.prompt || ''}</div>
            <div role="status" className="round-status" aria-hidden={!roundMessage}>{roundMessage}</div>
            {game.ended && <Alert severity="info">終了したゲームは終了後24時間保持されます。{game.expiresAt && ` 保持期限：${new Date(game.expiresAt).toLocaleString('ja-JP')}`}</Alert>}
            {game.me && !game.ended && <>
                {game.round && !game.round.eligible && <p>次の問題から回答できます。</p>}
                <div className="controls">
                    {game.isHost && <>
                        {game.phase === 'waiting' && <Button variant="contained" disabled={busy || !queue.split(/\r?\n/).some(line => line.trim())} onClick={() => act('show')}>お題表示</Button>}
                        {game.phase === 'answering' && <Button variant="contained" disabled={busy} onClick={() => act('close')}>締切・採点</Button>}
                        {game.phase === 'closed' && <Button variant="contained" disabled={busy} onClick={() => act('reveal')}>回答を開示</Button>}
                    </>}
                </div>
            </>}
            {game.phase === 'revealed' && <section className="panel results-panel" aria-labelledby="median-results-title">
                <h2 id="median-results-title">みんなの回答</h2>
                {sortDone && <p className="legend"><span>青緑：最小値 −1</span><span>赤：最大値 −1</span><span>黄：中央値 +2（優先）</span></p>}
                <div className="answers results-grid" style={{'--columns': columns(answers.length)}}>
                    {sortDone ? groups.map(group => <div className="answer-group" role="group" aria-label={`回答 ${group[0].display}`} key={group[0].value}>{group.map(answer => <AnswerCard key={answer.playerId} answer={answer} highlight />)}</div>)
                        : answers.map(answer => <AnswerCard key={answer.playerId} answer={answer} highlight={false} />)}
                </div>
                {game.me && game.isHost && !game.ended && <div className="controls next-controls"><Button variant="contained" disabled={busy || !sortDone} onClick={() => act('next')}>次の問題へ</Button></div>}
            </section>}
            <div className="subarea">
                <section className="panel"><h2>過去のお題</h2><div className="history">
                    {!game.history.length && <p className="muted">開示したお題がここに並びます。</p>}
                    {game.history.filter(round => game.phase !== 'revealed' || sortDone || round.id !== game.round.id).map(round => <article key={round.id}><b>{round.id}. {round.prompt}</b>
                        {[['minimum', '最小値'], ['median', '中央値'], ['maximum', '最大値']].map(([field, label]) => <div key={field}>{label}：{round.answers.filter(a => a[field]).map(a => a.name).join('、')}</div>)}
                    </article>)}
                </div></section>
            </div>
            {game.isHost && game.ended && <div className="controls">
                <Button disabled={busy} variant="outlined" onClick={() => setConfirm({action: 'restart', title: '得点をリセットして新しいゲームを始めますか？'})}>新しくゲームを始める</Button>
            </div>}
        </>}
        <details className="panel"><summary>有効な定数・関数</summary>
            <p>定数：pi（π）、e、tau、phi</p>
            <p>関数：abs、sqrt、cbrt、nthRoot、exp、log、log10、log2、sin、cos、tan、asin、acos、atan、atan2、sinh、cosh、tanh、asinh、acosh、atanh、floor、ceil、round、sign、min、max、factorial、combinations、permutations、gamma</p>
        </details>
        {showInputDock && <section ref={inputDockRef} className="panel input-dock" aria-label="イベント操作">
            <Tabs className="dock-tabs" value={visibleDockTab} onChange={(_, value) => setDockTab(value)} variant="scrollable" scrollButtons="auto" aria-label="イベント操作の切り替え">
                <Tab value="answer" label="回答入力" id="median-tab-answer" aria-controls="median-panel-answer" />
                {game.isHost ? <Tab value="queue" label="次以降のお題" id="median-tab-queue" aria-controls="median-panel-queue" />
                    : <Tab value="suggest" label="お題を投稿" id="median-tab-suggest" aria-controls="median-panel-suggest" />}
                {game.isHost && <Tab value="manage" label="管理" id="median-tab-manage" aria-controls="median-panel-manage" />}
            </Tabs>
            <div role="tabpanel" id="median-panel-answer" aria-labelledby="median-tab-answer" hidden={visibleDockTab !== 'answer'}>
                <div className="answers" style={{'--columns': 1}}>
                    <div className="answer">
                        <b>{ownPlayer.name}</b>
                        <TextField label="あなたの回答" value={raw} fullWidth
                            disabled={game.phase !== 'answering' || !game.round?.eligible || busy} error={answerError} inputProps={{maxLength: 512}}
                            helperText={game.phase === 'waiting' ? 'お題が表示されるまでお待ちください' : ['closed', 'revealed'].includes(game.phase) ? '回答は締め切られています' : answerStatus || '未入力は0として扱います。回答は開示まで他の参加者・主催には見えません。'}
                            onChange={e => {setRaw(e.target.value); rawRef.current = e.target.value; dirtyAnswer.current = true; answerVersion.current++; setAnswerStatus('保存待ち…'); setAnswerError(false)}} />
                        {leaveButton(ownPlayer.id)}
                    </div>
                </div>
            </div>
            {game.isHost && <div role="tabpanel" id="median-panel-queue" aria-labelledby="median-tab-queue" hidden={visibleDockTab !== 'queue'}>
                <div className="dock-form queue">
                    <TextField label="1行に1題（先頭から出題）" multiline minRows={3} maxRows={5} value={queue} fullWidth disabled={busy}
                        helperText={queueStatus || 'フォーカスを外すと自動保存します'}
                        onChange={e => {dirtyQueue.current = true; queueEditRevision.current++; queueTextRef.current = e.target.value; setQueue(e.target.value); setQueueStatus('未保存の変更があります')}}
                        onBlur={() => {saveQueue().catch(e => setError(e.message))}} />
                    <div className="controls">
                        {game.inboxCount > 0 && <Button disabled={busy} onClick={() => act('receive')}>お題を受け取る（{game.inboxCount}件）</Button>}
                        <Button disabled={busy} variant="outlined" onClick={() => setConfirm({action: 'restart', title: '得点をリセットして新しいゲームを始めますか？'})}>新しくゲームを始める</Button>
                        <Button disabled={busy} color="error" onClick={() => setConfirm({action: 'end', title: '全員のゲームを終了しますか？'})}>ゲームを終了</Button>
                    </div>
                </div>
            </div>}
            {!game.isHost && <div role="tabpanel" id="median-panel-suggest" aria-labelledby="median-tab-suggest" hidden={visibleDockTab !== 'suggest'}>
                <form className="dock-form" onSubmit={e => {e.preventDefault(); if (!busy && suggestion.trim()) act('suggest', {text: suggestion})}}>
                    <TextField label="主催に送るお題" value={suggestion} onChange={e => setSuggestion(e.target.value)} fullWidth inputProps={{maxLength: 250}} />
                    <div className="controls"><Button type="submit" variant="contained" disabled={busy || !suggestion.trim()}>送信</Button></div>
                </form>
            </div>}
            {game.isHost && <div role="tabpanel" id="median-panel-manage" aria-labelledby="median-tab-manage" hidden={visibleDockTab !== 'manage'}>
                <form className="dock-form" onSubmit={e => {e.preventDefault(); if (!busy && removalTarget) setConfirm({action: 'remove', extra: {playerId: removalTarget.id}, title: `${removalTarget.name}さんをイベントから離脱させますか？`})}}>
                    <TextField label="離脱させるプレイヤー名" value={removeName} onChange={e => {setRemoveName(e.target.value); setRemoveId('')}} fullWidth inputProps={{maxLength: 80}}
                        helperText={removeName && !removalMatches.length ? '一致する参加者がいません（主催は対象外です）' : '画面に表示されている名前を完全一致で入力してください'} />
                    {removalMatches.length > 1 && <TextField select label="同名の参加者から選択" value={removeId} onChange={e => setRemoveId(e.target.value)} fullWidth>
                        {removalMatches.map(player => <MenuItem key={player.id} value={player.id}>{player.name}（参加順 {active.indexOf(player) + 1}・{player.score}点）</MenuItem>)}
                    </TextField>}
                    <div className="controls"><Button type="submit" color="error" variant="outlined" disabled={busy || !removalTarget}>離脱させる</Button></div>
                </form>
            </div>}
        </section>}
        <Dialog open={!!confirm} onClose={() => setConfirm(null)}><DialogTitle>{confirm?.title}</DialogTitle><DialogContent>この操作を実行します。</DialogContent><DialogActions>
            <Button onClick={() => setConfirm(null)}>キャンセル</Button><Button onClick={() => {const choice = confirm; setConfirm(null); act(choice.action, choice.extra)}}>実行</Button>
        </DialogActions></Dialog>
    </Shell>
}

Median.disableRecordNotifications = true
Median.fullWidth = true
