import Link from 'next/link'
import Record from './Record'
import {useLocale} from '../../lib/pik5'
import {hideRuleNames} from '../../lib/const'
import {evidenceUrl} from '../../lib/yearRecords.mjs'
import {formatSpeedrunTime, speedrunRecordData} from '../../lib/yearRecordPresentation.mjs'

export default function YearRecordList({records, year}) {
    const {t, locale} = useLocale()
    return <div data-year-record-list>
        {records.map(record => {
            const code = record.stage_code || record.stage_id
            const name = (locale === 'en' && record.eng_stage_name) || t.stage[code] || record.stage_name || code
            const ruleName = record.event_rule_name || (!hideRuleNames.includes(Number(record.rule)) && record.rule < 100 && t.rule[record.rule])
            const stageLabel = `${code}#${name}${ruleName ? `（${ruleName}）` : ''}`
            return <Record
                key={record.post_id}
                data={{...record, video_url: evidenceUrl(record.video_url)}}
                year={year}
                stageHref={`/stage/${code}/0/${record.rule}/${year}/0`}
                stageLabel={stageLabel}
                showZeroScore
            />
        })}
    </div>
}

export function YearSpeedrunList({boards}) {
    const {t} = useLocale()
    return <>
        {boards.map(board => <section key={`${board.stage}:${board.console}`}>
            <h2 style={{fontSize: '1.1em', marginTop: 24}}>
                <Link href={`/speedrun/${board.stage}/${board.console}`}>{t.speedrun[board.stage]}</Link>
                {' · '}{t.console?.[board.console] || `#${board.console}`}
            </h2>
            <div data-year-record-list>{board.runs.map(run => <Record
                key={run.id}
                data={speedrunRecordData(run, board)}
                series={Math.floor(board.stage / 100)}
                stageHref={`/speedrun/${board.stage}/${board.console}`}
                stageLabel={t.speedrun[board.stage]}
                userEntries={run.players}
                detailHref={run.url}
                scoreText={formatSpeedrunTime(run.time)}
                showRankPoints={false}
            />)}</div>
        </section>)}
    </>
}
