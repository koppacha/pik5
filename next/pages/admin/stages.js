import styled from 'styled-components'
import {useLocale} from '../../lib/pik5'
import {useState} from 'react'
import {Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField} from '@mui/material'
import SeoHead from '../../components/SeoHead'

const ManagementPanel = styled(Box)`
    .MuiInputBase-root, .MuiInputLabel-root, .MuiSvgIcon-root, .MuiFormHelperText-root { color: var(--color-text-base); }
    .MuiOutlinedInput-notchedOutline { border-color: var(--color-text-base); opacity: 0.5; }
    .MuiOutlinedInput-notchedOutline legend { float: none; }
    .numeric-fields > div { flex: 1 1 180px; min-width: 180px; }
    fieldset { min-width: 0; }
`

const numericFields = {time: '制限時間（秒）', treasure: 'お宝・最大得点', pikmin: 'ピクミン数', border1: '基準1', border2: '基準2', border3: '基準3', border4: '基準4'}
const freshStage = () => ({mode: 'new', stage_code: '', stage_name: '', eng_stage_name: '', stage_sub: '',
    difficulty: 1, score_type: 'time', score_order: 'DESC', total_base: 600, consoles: [4], require_image: false, require_video: false,
    time: 0, treasure: 0, pikmin: 0, border1: 0, border2: 0, border3: 0, border4: 0})

export async function getServerSideProps({req, res}) {
    res.setHeader('Cache-Control', 'private, no-store')
    const {getServerSession} = await import('next-auth/next')
    const {authOptions} = await import('../api/auth/[...nextauth]')
    const {currentManagementUser, managementRequest} = await import('../../lib/dandoriServer')
    try {
        const user = await currentManagementUser(await getServerSession(req, res, authOptions))
        if (!user) return {props: {initial: null, denied: 'ログインが必要です。'}}
        const response = await managementRequest(user)
        if (!response.ok) return {props: {initial: null, denied: response.status === 403 ? 'アクセス権がありません。' : '管理機能を利用できません。設定をご確認ください。'}}
        return {props: {initial: response.data, denied: null}}
    } catch {
        return {props: {initial: null, denied: '管理機能を利用できません。'}}
    }
}

export default function StageManagement({initial, denied}) {
    const {t} = useLocale()
    const [data, setData] = useState(initial)
    const [month, setMonth] = useState('2026-11')
    const [revision, setRevision] = useState(0)
    const [publishAt, setPublishAt] = useState('2026-11-12T00:00')
    const [stages, setStages] = useState(() => Array.from({length: 6}, freshStage))
    const [message, setMessage] = useState('')
    const [error, setError] = useState(false)
    const [busy, setBusy] = useState(false)
    const [preview, setPreview] = useState(false)
    const [userId, setUserId] = useState('')
    if (denied) return <><SeoHead title="検定ステージ管理" noindex /><Alert severity="error">{denied}</Alert></>

    function update(index, key, value) {
        setPreview(false)
        const candidate = key === 'stage_code' && data.candidates.find(item => (item.stage_code || String(item.stage_id)) === value)
        setStages(previous => previous.map((stage, i) => i === index ? {...stage, [key]: value, ...(candidate && {difficulty: candidate.difficulty ?? 1})} : stage))
    }
    function loadMonth(value) {
        const release = data.releases.find(item => item.month === value)
        setMonth(value)
        setRevision(release?.revision || 0)
        setPublishAt(`${value}-12T00:00`)
        setStages(release ? release.stages.map(stage => ({...freshStage(), ...stage, mode: 'reuse', stage_code: stage.stage_code || String(stage.stage_id), require_image: Boolean(stage.require_image), require_video: Boolean(stage.require_video)})) : Array.from({length: 6}, freshStage))
        setPreview(false)
    }
    async function send(body) {
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch('/api/dandori-management', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)})
            const result = await response.json()
            if (!response.ok) throw new Error(Object.values(result.errors || {}).flat().join(' / ') || result.message || '保存できませんでした')
            const refreshed = await fetch('/api/dandori-management').then(res => res.json())
            if (!refreshed.releases) throw new Error('保存後の再取得に失敗しました。再読み込みしてください。')
            setData(refreshed)
            const release = refreshed.releases.find(item => item.month === month)
            if (release) {
                setRevision(release.revision)
                setStages(release.stages.map(stage => ({...freshStage(), ...stage, mode: 'reuse', stage_code: stage.stage_code || String(stage.stage_id), require_image: Boolean(stage.require_image), require_video: Boolean(stage.require_video)})))
            }
            setError(false)
            setMessage('保存しました。')
            setPreview(false)
        } catch (exception) {
            setError(true)
            setMessage(exception.message)
        } finally {
            setBusy(false)
        }
    }
    const locked = Boolean(data.releases.find(item => item.month === month)?.publish_at)
    return <ManagementPanel style={{maxWidth: 1000, margin: '0 auto', padding: '16px 8px'}}>
        <SeoHead title="だれでもダンドリ検定 ステージ管理" noindex />
        <h1>だれでもダンドリ検定 ステージ管理</h1>
        <p style={{marginBottom: 24}}>毎月6ステージを登録します。既存ステージの流用では元の名称・所属ルールや記録は変わりません。難易度はステージ情報として保存します。公開後の配信回は変更できません。</p>
        {message && <Alert severity={error ? 'error' : 'success'}>{message}</Alert>}
        <Stack spacing={2}>
            <TextField select label="配信月" value={month} onChange={event => loadMonth(event.target.value)}>
                {Array.from({length: 12}, (_, index) => {
                    const value = new Date(Date.UTC(2026, 10 + index, 1)).toISOString().slice(0, 7)
                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                })}
            </TextField>
            {locked && <Alert severity="info">公開設定済みです。閲覧のみ可能です。</Alert>}
            {stages.map((stage, index) => <Box component="fieldset" key={index} disabled={busy || locked} style={{padding: 16, borderRadius: 8}}>
                <legend>ステージ {index + 1}</legend>
                <Stack spacing={2}>
                    <TextField select label="登録方法" value={stage.mode} onChange={event => update(index, 'mode', event.target.value)}>
                        <MenuItem value="new">完全新作（番号は自動採番）</MenuItem><MenuItem value="reuse">既存ステージを流用</MenuItem>
                    </TextField>
                    {stage.mode === 'reuse' && <TextField select label="流用するステージ" value={stage.stage_code} onChange={event => update(index, 'stage_code', event.target.value)}>
                        {data.candidates.map(candidate => <MenuItem key={candidate.stage_id} value={candidate.stage_code || String(candidate.stage_id)}>#{candidate.stage_code || candidate.stage_id} {candidate.stage_name}</MenuItem>)}
                    </TextField>}
                    {stage.mode === 'new' && <>
                        <TextField required label="ステージ名" value={stage.stage_name} onChange={event => update(index, 'stage_name', event.target.value)} />
                        <TextField label="英語ステージ名（未入力時は日本語名）" value={stage.eng_stage_name} onChange={event => update(index, 'eng_stage_name', event.target.value)} />
                        <TextField label="補足分類" value={stage.stage_sub} onChange={event => update(index, 'stage_sub', event.target.value)} />
                        <Box className="numeric-fields" style={{display: 'flex', flexWrap: 'wrap', gap: 12}}>{Object.entries(numericFields).map(([key, label]) => <TextField key={key} label={label} type="number" inputProps={{min: 0, max: 999999}} value={stage[key]} onChange={event => update(index, key, Number(event.target.value))} />)}</Box>
                    </>}
                    <TextField required select label="難易度" value={stage.difficulty ?? ''} onChange={event => update(index, 'difficulty', Number(event.target.value))}>
                        <MenuItem value="" disabled>未設定</MenuItem>
                        <MenuItem value={1}>1：おてがる</MenuItem><MenuItem value={2}>2：ほんかく</MenuItem><MenuItem value={3}>3：きわみ</MenuItem>
                    </TextField>
                    <TextField select label="スコア表示" value={stage.score_type} onChange={event => update(index, 'score_type', event.target.value)}><MenuItem value="time">時間</MenuItem><MenuItem value="points">得点</MenuItem></TextField>
                    <TextField select label="順位の付け方" value={stage.score_order} onChange={event => update(index, 'score_order', event.target.value)}><MenuItem value="DESC">大きいほど上位（残り時間・得点）</MenuItem><MenuItem value="ASC">小さいほど上位（クリア時間）</MenuItem></TextField>
                    <TextField label="時間が小さいほど上位の場合の総合換算基準（秒）" type="number" value={stage.total_base} onChange={event => update(index, 'total_base', Number(event.target.value))} />
                    <Box><p>対応する操作方法</p>{[1, 2, 3, 4].map(id => <FormControlLabel key={id} control={<Checkbox checked={stage.consoles.includes(id)} onChange={event => update(index, 'consoles', event.target.checked ? [...stage.consoles, id].sort() : stage.consoles.filter(value => value !== id))} />} label={t.console[id]} />)}</Box>
                    <FormControlLabel control={<Checkbox checked={stage.require_video} onChange={event => update(index, 'require_video', event.target.checked)} />} label="証拠動画を必須にする" />
                    <FormControlLabel control={<Checkbox checked={stage.require_image} onChange={event => update(index, 'require_image', event.target.checked)} />} label="証拠画像を必須にする" />
                </Stack>
            </Box>)}
            <TextField label="公開日時（日本時間）" type="datetime-local" value={publishAt} onChange={event => setPublishAt(event.target.value)} InputLabelProps={{shrink: true}} />
            {preview && <Alert severity="info">{month}の6枠を {publishAt.replace('T', ' ')}（日本時間）に公開します。新作には番号が自動採番され、既存流用は選択した番号のルール48に関連付けます。</Alert>}
            <Stack direction="row" spacing={2}>
                <Button variant="outlined" disabled={busy || locked} onClick={() => send({month, revision, stages, publish_at: null})}>下書き保存</Button>
                <Button variant="outlined" disabled={busy || locked} onClick={() => setPreview(true)}>公開内容を確認</Button>
                {preview && <Button variant="contained" disabled={busy || locked} onClick={() => send({month, revision, stages, publish_at: `${publishAt}:00+09:00`})}>6ステージを公開</Button>}
            </Stack>
            {data.admin && <Box>
                <h2>追加フォームの利用許可</h2>
                <TextField label="ログインID" value={userId} onChange={event => setUserId(event.target.value)} />
                <Button disabled={busy || !userId} onClick={() => send({action: 'grant', userId})}>許可</Button>
                <Button disabled={busy || !userId} onClick={() => send({action: 'revoke', userId})}>取消</Button>
                <ul>{data.permissions.map(permission => <li key={permission.user_id}>{permission.userId || permission.user_id}</li>)}</ul>
            </Box>}
        </Stack>
    </ManagementPanel>
}
