import React, {useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {useSession} from 'next-auth/react'
import useSWR from 'swr'
import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography} from '@mui/material'
import {TopBox, TopBoxContent, TopBoxHeader, WrapTopBox} from '../../styles/pik5.css'
import {useLocale} from '../../lib/pik5'
import {canAccessLimitedIdeas, formatLimitedIdeasDate, limitedIdeasRatio, validateLimitedIdea} from '../../lib/limitedIdeas'
import {faTicketSimple} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

const endpoint = '/api/limited-ideas'
const notice = '登録した時点で管理人またはイベントスタッフはルールを閲覧・編集・削除・調整・利用する権利を有します。また利用規約に同意したものとみなします。ルールは原則として日本語版を基準とします。各ルールはルール本文に特記しないかぎり、証拠画像必須、証拠動画任意、ソウビ自由、リタイア禁止、操作方法不問、登録スコアはゲーム内スコアとなります。特定環境でしかプレイできないルールは採用されません。オッチンのトックン状況は指定できません。同一とみなせるルールの複数投稿があった場合、投稿日時がもっとも早いユーザーを発案者とみなします。'
const blank = () => ({title: 2, stageId: 201, ruleName: '', difficulty: 1, registrationMethod: 'score', body: ''})
const listCellStyle = {
    display: 'flex', alignItems: 'center', minWidth: 0, padding: 8,
    borderRight: '1px solid #8888', borderBottom: '1px solid #8888',
    fontSize: '0.875rem', overflowWrap: 'anywhere',
}

async function request(url, options) {
    const response = await fetch(url, {cache: 'no-store', ...options})
    const data = await response.json()
    if (!response.ok) throw Object.assign(new Error(data.message || '取得に失敗しました。'), {status: response.status})
    return data
}

export default function LimitedIdeas() {
    const {t} = useLocale()
    const {data: session, status} = useSession()
    const identity = session?.user?.dbId || ''
    const {data: summary, error: summaryError, mutate: refreshSummary} = useSWR(
        [endpoint, identity], ([url]) => request(url), {refreshInterval: 30000, shouldRetryOnError: false},
    )
    const [clock, setClock] = useState(() => Date.now())
    const periodOpen = canAccessLimitedIdeas(null, clock)
    const previousPeriod = useRef(periodOpen)
    useEffect(() => {
        const timer = setInterval(() => setClock(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])
    useEffect(() => {
        if (previousPeriod.current !== periodOpen) refreshSummary()
        previousPeriod.current = periodOpen
    }, [periodOpen, refreshSummary])

    const [manageOpen, setManageOpen] = useState(false)
    const [formOpen, setFormOpen] = useState(false)
    const [drafts, setDrafts] = useState({create: blank()})
    const [draftKey, setDraftKey] = useState('create')
    const [showNotice, setShowNotice] = useState(false)
    const [deleting, setDeleting] = useState(null)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [page, setPage] = useState(0)
    const {data: listing, error: listError, mutate: refreshList} = useSWR(
        manageOpen && identity ? [`${endpoint}?view=mine&page=${page}`, identity] : null,
        ([url]) => request(url), {shouldRetryOnError: false},
    )
    useEffect(() => {
        setDrafts({create: blank()})
        setManageOpen(false)
        setFormOpen(false)
        setDeleting(null)
        setMessage('')
        setPage(0)
    }, [identity])

    const visible = Boolean(summary && !summaryError && (summary.admin || periodOpen))
    const draft = drafts[draftKey] || blank()
    const change = (field, value) => setDrafts(current => ({...current, [draftKey]: {...draft, [field]: value}}))
    const closeForm = () => { if (!busy) setFormOpen(false) }
    const openForm = item => {
        const key = item?.ruleId || 'create'
        setDraftKey(key)
        if (item) setDrafts(current => ({...current, [key]: item}))
        setMessage('')
        setFormOpen(true)
    }
    const save = async event => {
        event.preventDefault()
        if (busy) return
        const error = validateLimitedIdea(draft)
        if (error) {
            setMessage(error)
            return
        }
        setBusy(true)
        setMessage('')
        try {
            await request(endpoint, {
                method: draftKey === 'create' ? 'POST' : 'PUT',
                headers: {'Content-Type': 'application/json'}, body: JSON.stringify(draft),
            })
            setFormOpen(false)
            setDrafts(current => ({...current, [draftKey]: blank()}))
            await Promise.all([refreshSummary(), refreshList()])
        } catch (error) {
            setMessage(error.message)
            if (error.status === 403) refreshSummary()
            if (error.status === 409) refreshList()
        } finally { setBusy(false) }
    }
    const remove = async () => {
        if (busy || !deleting) return
        setBusy(true)
        setMessage('')
        try {
            await request(endpoint, {
                method: 'DELETE', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ruleId: deleting.ruleId, revision: deleting.revision}),
            })
            setDeleting(null)
            await Promise.all([refreshSummary(), refreshList()])
        } catch (error) {
            setMessage(error.message)
            if (error.status === 403) refreshSummary()
        } finally { setBusy(false) }
    }
    if (!visible) return null

    const stages = Array.from({length: draft.title === 2 ? 30 : 28}, (_, index) => (draft.title === 2 ? 201 : 401) + index)
    const fieldProps = {fullWidth: true, margin: 'normal', variant: 'standard', disabled: busy}
    const disabled = !identity || status !== 'authenticated'
    const buttonStyle = {...(disabled && {color: 'var(--color-muted-text)', borderColor: 'var(--color-divider-muted)'})}
    return (
        <WrapTopBox item xs={12} className="wrap-top-box top-split-column-item">
            <TopBox className="top-box">
                <TopBoxHeader className="top-box-header"><span><FontAwesomeIcon icon={faTicketSimple} /> 期間限定チャレンジルール応募</span></TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    <Typography style={{fontSize: '0.9em'}}>
                        期間限定チャレンジルールを募集中です。<br/>現在の応募総数：{summary.count} / 推定採用倍率：{limitedIdeasRatio(summary.count)}倍 / 募集終了日時：{formatLimitedIdeasDate(summary.closesAt)}
                    </Typography>
                    <Box style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginTop: 12}}>
                        <Button variant="contained" style={buttonStyle} disabled={disabled} onClick={() => openForm(null)}>期間限定チャレンジを作成する</Button>
                        <Button variant="contained" style={buttonStyle} disabled={disabled} onClick={() => {
                            setManageOpen(true)
                            setMessage('')
                            setPage(0)
                        }}>期間限定チャレンジを管理する</Button>
                    </Box>
                    {status === 'unauthenticated' && <Typography style={{marginTop: 8}}>作成・管理には<Link href="/auth/login">ログイン</Link>が必要です</Typography>}
                </TopBoxContent>
            </TopBox>

            <Dialog open={manageOpen} onClose={() => { if (!busy) setManageOpen(false) }} fullWidth maxWidth="md" aria-labelledby="limited-manage-title">
                <DialogTitle id="limited-manage-title">期間限定チャレンジを管理する</DialogTitle>
                <DialogContent dividers style={{maxHeight: '65vh', overflowY: 'auto'}}>
                    <Typography>登録したあなたのルール：{listing?.ownCount ?? '…'}個</Typography>
                    {listing?.admin && <Typography variant="body2">管理者として全ユーザーのルールを表示しています。</Typography>}
                    {listError && <Alert severity="error">{listError.message}</Alert>}
                    {message && !formOpen && !deleting && <Alert severity="error">{message}</Alert>}
                    {!listing && !listError && <Typography>読み込み中…</Typography>}
                    {listing?.count === 0 && <Typography>登録ルールはありません。</Typography>}
                    {listing && <Box style={{overflowX: 'auto', marginTop: 12}} tabIndex={0} role="region" aria-label="ルール一覧（横スクロール可能）">
                        <Box role="table" aria-label="登録ルール一覧" style={{
                            display: 'grid', width: '100%', minWidth: 760,
                            gridTemplateColumns: '144px minmax(220px, 2fr) 96px 172px minmax(120px, 1fr)',
                            borderTop: '1px solid #8888', borderLeft: '1px solid #8888',
                        }}>
                            <Box role="row" style={{display: 'contents'}}>
                                {['操作', 'タイトル', '難易度', '更新日時', 'ユーザー名'].map(label => <Box
                                    key={label} role="columnheader"
                                    style={{...listCellStyle, fontWeight: 'bold', backgroundColor: '#8882'}}
                                >{label}</Box>)}
                            </Box>
                            {listing.items.map(item => <Box key={item.ruleId} role="row" style={{display: 'contents'}}>
                                <Box role="cell" style={{...listCellStyle, gap: 8, justifyContent: 'center'}}>
                                    <Button size="small" variant="contained" style={{minWidth: 56}} onClick={() => openForm(item)}>編集</Button>
                                    <Button size="small" variant="contained" style={{minWidth: 56}} color="error" onClick={() => {
                                        setDeleting(item)
                                        setMessage('')
                                    }}>削除</Button>
                                </Box>
                                <Box role="cell" style={listCellStyle}>{t.stage[item.stageId]}（{item.ruleName}）</Box>
                                <Box role="cell" style={{...listCellStyle, justifyContent: 'center'}}>{"★".repeat(item.difficulty)}</Box>
                                <Box role="cell" style={{...listCellStyle, whiteSpace: 'nowrap'}}>{formatLimitedIdeasDate(item.updatedAt)}</Box>
                                <Box role="cell" style={listCellStyle}>{item.creatorName}</Box>
                            </Box>)}
                        </Box>
                    </Box>}
                </DialogContent>
                <DialogActions style={{flexWrap: 'wrap'}}>
                    <Button disabled={page === 0} onClick={() => setPage(value => value - 1)}>前へ</Button>
                    <Button disabled={!listing || (page + 1) * 50 >= listing.count} onClick={() => setPage(value => value + 1)}>次へ</Button>
                    <Button onClick={() => refreshList()}>一覧を更新</Button>
                    <Button disabled={busy} onClick={() => setManageOpen(false)}>閉じる</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm" aria-labelledby="limited-form-title">
                <Box component="form" onSubmit={save} style={{display: 'flex', flexDirection: 'column', minHeight: 0}}>
                    <DialogTitle id="limited-form-title">
                        期間限定チャレンジを{draftKey === 'create' ? '作成' : '編集'}する
                        <Button variant="contained" style={{marginLeft:"1em"}} aria-expanded={showNotice} aria-controls="limited-notice" onClick={() => setShowNotice(value => !value)}>注意事項</Button>
                        <Button variant="contained" style={{marginLeft:"0.5em"}} component={Link} href="https://docs.google.com/spreadsheets/d/1ZzqmjESn_LXDVjF9T3EBZYZ7nuTj1sb1bQ9WZkj3fDk/edit?usp=sharing" target="_blank">過去ルール一覧</Button>
                    </DialogTitle>
                    <DialogContent dividers>
                        {showNotice && <Typography id="limited-notice" variant="body2" style={{whiteSpace: 'pre-wrap'}}>{notice}</Typography>}
                        {message && <Alert severity="error" role="alert">{message}</Alert>}
                        <TextField {...fieldProps} label="ユーザー名" value={draft.creatorName ?? session?.user?.name ?? ''} disabled />
                        <TextField {...fieldProps} select label="タイトル" value={draft.title} onChange={event => {
                            const title = Number(event.target.value)
                            setDrafts(current => ({...current, [draftKey]: {...draft, title, stageId: title === 2 ? 201 : 401}}))
                        }}>
                            {[2, 4].map(title => <MenuItem key={title} value={title}>{t.title[title]}</MenuItem>)}
                        </TextField>
                        <TextField {...fieldProps} select label="ステージ" value={draft.stageId} onChange={event => change('stageId', Number(event.target.value))}>
                            {stages.map(stage => <MenuItem key={stage} value={stage}>{t.stage[stage]}</MenuItem>)}
                        </TextField>
                        <TextField {...fieldProps} required label="ルール名" value={draft.ruleName} onChange={event => change('ruleName', event.target.value)} helperText={`${[...draft.ruleName].length} / 10文字`} error={[...draft.ruleName].length > 10} />
                        <TextField {...fieldProps} select label="難易度" value={draft.difficulty} onChange={event => change('difficulty', Number(event.target.value))} helperText="基準は過去ルール一覧を参考にしてください。難易度が高いほど採用されにくくなります。">
                            {[1, 2, 3, 4, 5].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                        </TextField>
                        <TextField {...fieldProps} select label="登録方法" value={draft.registrationMethod} onChange={event => change('registrationMethod', event.target.value)}>
                            <MenuItem value="score">スコア</MenuItem><MenuItem value="time">タイム</MenuItem>
                        </TextField>
                        <TextField {...fieldProps} required multiline minRows={4} label="本文" value={draft.body} onChange={event => change('body', event.target.value)} helperText={`${[...draft.body].length} / 256文字`} error={[...draft.body].length > 256} />
                    </DialogContent>
                    <DialogActions>
                        <Button disabled={busy} type="submit">投稿</Button>
                        <Button disabled={busy} onClick={closeForm}>閉じる</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog open={Boolean(deleting)} onClose={() => { if (!busy) setDeleting(null) }} fullWidth maxWidth="xs" aria-labelledby="limited-delete-title">
                <DialogTitle id="limited-delete-title">このルールを削除しますか？</DialogTitle>
                <DialogContent>{message && <Alert severity="error">{message}</Alert>}</DialogContent>
                <DialogActions>
                    <Button disabled={busy || !deleting} color="error" onClick={remove}>削除</Button>
                    <Button disabled={busy} onClick={() => setDeleting(null)}>キャンセル</Button>
                </DialogActions>
            </Dialog>
        </WrapTopBox>
    )
}
