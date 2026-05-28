import {Box, Grid} from "@mui/material"
import Link from "next/link"
import * as React from "react"
import {useLocale} from "../../lib/pik5"

export default function CategoryList({currentEvent = 0, events = [], type = "event"}){
    const {t} = useLocale()
    const list = type === "event"
        ? events
            .map(Number)
            .filter((id) => id !== 0)
            .sort((a, b) => {
                if(a === 200) return -1
                if(b === 200) return 1
                if(a === 251) return 1
                if(b === 251) return -1
                return a - b
            })
        : events

    const label = (id) => {
        if(type === "event"){
            return t.limited.category?.[id] ?? id
        }
        return t.ru?.[id] ?? t.rule?.[id] ?? id
    }

    const href = (id) => {
        if(type === "event"){
            return Number(id) === 0 ? "/total/4" : `/total/4/${id}`
        }
        return `/total/${id}`
    }

    return (
        <Box
            className="stage-list-wrapper"
            style={{
                width: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                whiteSpace: "nowrap",
                marginBottom: "12px"
            }}
        >
            <Grid container style={{minWidth: list.length > 8 ? "920px" : "100%"}} columns={{xs: 6, md: 9, lg: 12}}>
                {list.map((id) => (
                    <Grid style={{whiteSpace:"nowrap"}} key={id} item xs={1.5}>
                        <Link href={href(id)}>
                            <Box className={`stage-list-box ${Number(currentEvent) === Number(id) ? "active" : ""}`}>
                                #{id}<br/>{label(id)}
                            </Box>
                        </Link>
                    </Grid>
                ))}
            </Grid>
        </Box>
    )
}
