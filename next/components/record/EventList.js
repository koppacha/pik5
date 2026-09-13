import {Box, Grid} from "@mui/material"
import Link from "next/link"
import * as React from "react"

export default function EventList({currentId = 0, events = []}){
    if(!events?.length){
        return <></>
    }

    const eventDate = (eventId) => {
        const value = String(eventId).padStart(6, "0")
        return `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4, 6)}`
    }

    const formatTitle = (event) => {
        const title = String(event.event_title ?? event.event_id)
        const subTitle = event.sub_title ? String(event.sub_title).replace(/×/g, "×\n") : ""
        const round = title.match(/^(第[0-9０-９]+回)(.*)$/)
        const displayTitle = round
            ? `${round[1]}${subTitle ? "" : `\n${round[2].trim()}`}`
            : title

        return subTitle ? `${displayTitle}\n${subTitle}` : displayTitle
    }

    const label = (event) => {
        return formatTitle(event)
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
            <Grid container style={{minWidth: events.length > 12 ? "1200px" : "100%"}} columns={{xs: 6, md: 9, lg: 12}}>
                {events.map((event) => (
                    <Grid style={{whiteSpace:"pre-line"}} key={event.event_id} item xs={1.5}>
                        <Link href={`/limited/${event.event_id}`}>
                            <Box className={`stage-list-box ${Number(currentId) === Number(event.event_id) ? "active" : ""}`}>
                                {eventDate(event.event_id)}<br/>{label(event)}
                            </Box>
                        </Link>
                    </Grid>
                ))}
            </Grid>
        </Box>
    )
}
