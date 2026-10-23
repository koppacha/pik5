import {Box} from "@mui/material"
import {addName2posts, useLocale} from "../../lib/pik5"
import Record from "./Record"
import NowLoading from "../NowLoading"
import React from 'react'
import WorldRecordBorder, {ReferenceScoreBorder} from './ReferenceScoreBorder'

export default function RankingStandard({parent, posts, borders, stage, console:consoles, rule, year, users, worldRecords = [], onWorldRecordDeleted}){

    const {t} = useLocale()

    if(!posts){
        return (
            <NowLoading/>
        )
    }

    // 取得したデータにPrismaから取ってきたスクリーンネームを入れる
    const data = addName2posts(posts, users)

    let i = borders.length - 1

    // 参考スコアを表示するルール
    const borderShowRules = [20, 21, 22]

    const pending = [...worldRecords].sort((a, b) => a.score_order === 'ASC' ? Number(a.score) - Number(b.score) : Number(b.score) - Number(a.score))
    const worldBorder = record => <WorldRecordBorder key={`world-record-${record.id}`} record={record} stage={stage} rule={rule} onDeleted={onWorldRecordDeleted} />
    const ranking = data.flatMap(function(post){
        const rows = []
        const star = "★"
        while (pending.length && (pending[0].score_order === 'ASC' ? Number(post.score) > Number(pending[0].score) : Number(post.score) < Number(pending[0].score))) {
            rows.push(worldBorder(pending.shift()))
        }

        if(borderShowRules.includes(Number(rule))){
            while(i >= 0 && post.score < borders[i]){
                const border = borders[i]
                rows.push(
                    <ReferenceScoreBorder
                        key={`border-standard-${i}`}
                    >
                        {star.repeat(i + 1)} {t.border[2][i]} {border.toLocaleString()} pts.
                    </ReferenceScoreBorder>
                )
                i--
            }
        }

        rows.push(
            <Record key={post.unique_id} data={post} parent={parent}/>
        )

        return rows
    })
    ranking.push(...pending.map(worldBorder))
    return ranking
}
