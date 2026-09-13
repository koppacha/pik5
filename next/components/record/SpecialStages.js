import {Box} from "@mui/material"
import Link from "next/link"
import * as React from "react"
import {speedrunStageConfigs} from "../../lib/const"
import {stageUrlOutput} from "../../lib/factory"
import {useLocale} from "../../lib/pik5"

export const SPECIAL_STAGES_RULE = "special"

function formatLabel(label){
    return String(label).replace("（", "\n（")
}

export default function SpecialStages({series, stages = [], consoles = 0, year}){
    const {t} = useLocale()
    const seriesId = Number(series)
    const seriesTopId = seriesId * 10
    const speedrunStages = Object.keys(speedrunStageConfigs)
        .map(Number)
        .filter(stage => String(stage).slice(0, 2) === String(seriesTopId))
        .sort((a, b) => a - b)
    const items = [
        ...speedrunStages.map(stage => ({
            key: `speedrun-${stage}`,
            id: `s${stage}`,
            label: formatLabel(`${t.speedrun?.s?.[stage] ?? stage}RTA`),
            href: `/speedrun/${stage}${Number(consoles) ? `/${consoles}` : ""}`,
        })),
        ...stages.map(stage => ({
            key: `stage-${stage.stage_id}`,
            id: stage.stage_id,
            label: formatLabel(t.stage?.[stage.stage_id] ?? stage.stage_id),
            href: `/stage/${stageUrlOutput(stage.stage_id, consoles, 91, year, 91)}`,
        })),
    ]

    if(!items.length) return null

    return (
        <Box
            className="stage-list-wrapper"
            style={{width: "100%", overflowX: "auto", overflowY: "hidden"}}
        >
            <Box
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
                    minWidth: "800px",
                }}
            >
                {items.map(item => (
                    <Box style={{minWidth: 0}} key={item.key}>
                        <Link href={item.href}>
                            <Box className="stage-list-box">#{item.id}<br/>{item.label}</Box>
                        </Link>
                    </Box>
                ))}
            </Box>
        </Box>
    )
}
