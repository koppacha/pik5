import {useEffect, useState} from 'react'
import Link from 'next/link'
import {Grid} from '@mui/material'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faMedal, faRankingStar} from '@fortawesome/free-solid-svg-icons'
import {TopBox, TopBoxHeader, TopBoxContent, WrapTopBox, TrendCellBox} from '../../styles/pik5.css'
import useDandoriCatalog from '../../hooks/useDandoriCatalog'
import {DANDORI_START, showDandoriBox, dandoriMonthLabel, dandoriDifficultyLabel} from '../../lib/dandori'
import {useLocale} from '../../lib/pik5'

export default function MonthlyDandori({initialNow, development}) {
    const [now, setNow] = useState(initialNow)
    const catalog = useDandoriCatalog()
    const {locale} = useLocale()
    useEffect(() => {
        if (development || now >= DANDORI_START) return
        const timer = setTimeout(() => setNow(Date.now()), Math.min(60000, DANDORI_START - now))
        return () => clearTimeout(timer)
    }, [development, now])
    if (!showDandoriBox(now, development)) return null
    return <WrapTopBox item xs={12} className="wrap-top-box">
        <TopBox className="top-box">
            <TopBoxHeader className="top-box-header" style={{alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px'}}>
                <span><FontAwesomeIcon icon={faMedal} /> だれでもチャレンジ！ダンドリ検定（{dandoriMonthLabel(catalog?.month, now)}）</span>
                <Link href="/total/48" style={{color: '#cfcfcf', padding:'2px 8px', backgroundColor:'#404040', borderRadius:'4px', fontSize: '0.8em', marginLeft: 'auto', whiteSpace: 'nowrap'}}><FontAwesomeIcon icon={faRankingStar} /> 総合ランキング</Link>
            </TopBoxHeader>
            <TopBoxContent className="top-box-content">
                <Grid container>
                    {catalog?.monthly?.slice(0, 6).map(stage => {
                        const stageName = (locale === 'en' && stage.eng_stage_name) || stage.stage_name
                        return <Grid item xs={4} sm={3} md={2} key={stage.stage_code} component={Link} href={`/stage/${stage.stage_code}/0/48`}>
                            <TrendCellBox className="cell-box" title={stageName}>
                                <span className="cell-box-caption">#{stage.stage_code}</span>
                                <span>{stageName.length > 10 ? `${stageName.substring(0, 9)}..` : stageName}</span>
                                <span className="cell-box-caption">{dandoriDifficultyLabel(stage.difficulty)}</span>
                            </TrendCellBox>
                        </Grid>
                    })}
                </Grid>
                {!catalog?.monthly?.length && <p>{catalog?.unavailable ? '検定情報を一時的に取得できません。時間をおいて再読み込みしてください。' : catalog ? 'ステージは準備中です。' : '検定情報を読み込んでいます。'}</p>}
            </TopBoxContent>
        </TopBox>
    </WrapTopBox>
}
