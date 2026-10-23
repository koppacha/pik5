import {useEffect, useState} from 'react'
import Head from 'next/head'
import Link from 'next/link'
import useSWR from 'swr'
import {Alert, Box, Button, FormControl, InputLabel, MenuItem, Stack, Typography} from '@mui/material'
import {useRouter} from 'next/router'
import {StyledSelect} from '../../styles/pik5.css'
import {useLocale} from '../../lib/pik5'
import {evidenceUrl, japanYear, parseRecordYear} from '../../lib/yearRecords.mjs'
import YearRecordList, {YearSpeedrunList} from '../../components/record/YearRecordList'

export async function getServerSideProps({params, res}) {
    res.setHeader('Cache-Control', 'private, no-store')
    const year = parseRecordYear(params.year)
    if (!year) return {notFound: true}
    const {serverFetchJson} = await import('../../lib/serverFetchJson.mjs')
    const {getCachedUsers} = await import('../../lib/usersCache')
    const [snapshot, users] = await Promise.all([
        serverFetchJson(`http://laravel:8000/api/date/${year}`), getCachedUsers(),
    ])
    const names = new Map(users.map(user => [user.userId, user.name]))
    for (const rows of Object.values(snapshot.categories)) {
        for (const row of rows) row.user_name = names.get(row.user_id) || row.user_id
    }
    return {props: {snapshot, currentYear: japanYear()}}
}

async function fetchRta(url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error('RTA unavailable')
    return response.json()
}

export default function YearPage({snapshot, currentYear}) {
    const {t, locale} = useLocale()
    const router = useRouter()
    const labels = t.yearRecords
    const year = snapshot.year
    const [category, setCategory] = useState('normal')
    const [videosOnly, setVideosOnly] = useState(true)
    const [limit, setLimit] = useState(100)
    const {data: rta, error: rtaError, mutate} = useSWR(`/api/date/rta/${year}`, fetchRta, {
        revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false,
    })
    useEffect(() => {
        setCategory('normal')
        setVideosOnly(true)
        setLimit(100)
    }, [year])
    const available = Object.keys(snapshot.categories).filter(key => snapshot.categories[key].length)
    if (rta?.boards?.length) available.push('rta')
    const active = available.includes(category) ? category : available[0]
    const rows = (snapshot.categories[active] || []).filter(row => !videosOnly || evidenceUrl(row.video_url))
    const boards = (rta?.boards || []).map(board => ({...board, runs: board.runs.filter(run => !videosOnly || run.videoUrl)})).filter(board => board.runs.length)
    const count = active === 'rta' ? boards.reduce((total, board) => total + board.runs.length, 0) : rows.length
    const displayTime = value => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ja-JP', {
        timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'medium',
    }).format(new Date(value))
    // Mount rows progressively; every record remains accessible.
    let remaining = limit
    const visibleBoards = boards.map(board => {
        const runs = board.runs.slice(0, Math.max(0, remaining))
        remaining -= runs.length
        return {...board, runs}
    }).filter(board => board.runs.length)
    return <>
        <Head><title>{year} · {labels.title} - {t.title[0]}</title></Head>
        <Box style={{maxWidth: 1200, margin: '24px auto', padding: '0 12px'}}>
            <Link href="/">{t.title[0]}</Link>
            <Typography component="h1" variant="h4" style={{margin: '20px 0'}}>{year} · {labels.title}</Typography>
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" style={{alignItems: 'center', marginBottom: 20}}>
                <FormControl size="small" style={{minWidth: 110}}>
                    <InputLabel id="year-page-year" style={{color: 'inherit'}}>{t.g.year}</InputLabel>
                    <StyledSelect labelId="year-page-year" label={t.g.year} value={year}
                        onChange={event => router.push(`/date/${event.target.value}`)}>
                        {Array.from({length: currentYear - 2013}, (_, index) => currentYear - index).map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </StyledSelect>
                </FormControl>
                <Typography variant="body2">{labels.asOf}: {displayTime(snapshot.asOf)} JST</Typography>
            </Stack>
            <Typography variant="body2" style={{marginBottom: 16}}>{labels.description}</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" aria-label={labels.categories}>
                {available.map(key => <Button key={key} variant={active === key ? 'contained' : 'outlined'} aria-pressed={active === key}
                    onClick={() => {setCategory(key); setLimit(100)}}>{labels[key]}</Button>)}
            </Stack>
            <Stack direction="row" spacing={1} style={{marginTop: 16}} aria-label={labels.evidence}>
                <Button variant={videosOnly ? 'contained' : 'outlined'} aria-pressed={videosOnly}
                    onClick={() => {setVideosOnly(true); setLimit(100)}}>{labels.videosOnly}</Button>
                <Button variant={!videosOnly ? 'contained' : 'outlined'} aria-pressed={!videosOnly}
                    onClick={() => {setVideosOnly(false); setLimit(100)}}>{labels.all}</Button>
            </Stack>
            {!rta && !rtaError && <Typography role="status" variant="body2" style={{marginTop: 16}}>{labels.rtaLoading}</Typography>}
            {rtaError && <Alert severity="warning" style={{marginTop: 16}}>{labels.rtaError} <Button onClick={() => mutate()}>{labels.retry}</Button></Alert>}
            {active === 'rta' && rta && <Typography variant="body2" style={{marginTop: 16}}>
                {labels.updated}: {displayTime(rta.generatedAt)} JST · {labels.rtaCache}
            </Typography>}
            {active === 'rta' && rta?.stale && <Alert severity="warning" style={{marginTop: 12}}>{labels.stale}</Alert>}
            {active === 'rta' && rta?.unknownDates > 0 && <Typography variant="body2">{labels.unknownDates}: {rta.unknownDates}</Typography>}
            <Typography role="status" variant="body2" style={{marginTop: 20}}>{count.toLocaleString()} {labels.records}</Typography>
            {!count && <Typography style={{padding: '32px 0'}}>{videosOnly && active ? labels.noVideos : labels.empty}</Typography>}
            {active === 'rta'
                ? <YearSpeedrunList boards={visibleBoards} />
                : <YearRecordList records={rows.slice(0, limit)} year={year} />}
            {count > limit && <Button variant="outlined" onClick={() => setLimit(value => value + 100)}>{labels.more} ({Math.min(limit, count)}/{count})</Button>}
        </Box>
    </>
}
