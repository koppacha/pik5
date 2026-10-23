import {Box, Grid} from "@mui/material"
import Link from "next/link"
import * as React from "react"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faSquare, faTableColumns, faTableCells, faLayerGroup} from "@fortawesome/free-solid-svg-icons"

const limitedRuleGroups = [
    {name: "スタンダード", color: "#589ddd", textColor: "#fff", icon: faSquare, ids: [151101, 160306, 160319, 160423, 160430, 160806]},
    {name: "チーム対抗", color: "#c54b4b", textColor: "#fff", icon: faTableColumns, ids: [170101, 170211, 170325, 170429, 171013, 180101]},
    {name: "エリア踏破", color: "#519a56", textColor: "#fff", icon: faTableCells, ids: [180901, 190802, 200723, 200918, 211105, 221008]},
    {name: "トリックテイキング", color: "#cfac53", textColor: "#222", icon: faLayerGroup, ids: [261009]}
]

export default function EventList({currentId = 0, events = [], limitedGroups = false}){
    if(!events?.length){
        return <></>
    }

    const eventDate = (eventId) => {
        const value = String(eventId).padStart(6, "0")
        return `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4, 6)}`
    }

    const formatTitle = (event) => {
        const title = String(event.event_title ?? event.event_id)
        const subTitle = limitedGroups
            ? String(event.sub_title ?? "").split("×").slice(1).map(value => value.trim()).filter(Boolean).join("\n") || "スタンダード"
            : event.sub_title ? String(event.sub_title).replace(/×/g, "×\n") : ""
        const round = title.match(/^(第[0-9０-９]+回)(.*)$/)
        const displayTitle = round
            ? `${round[1]}${subTitle ? "" : `\n${round[2].trim()}`}`
            : title

        return subTitle ? `${displayTitle}\n${subTitle}` : displayTitle
    }

    const label = (event) => {
        return formatTitle(event)
    }

    const eventLink = (event) => (
        <Link key={event.event_id} href={Number(event.event_id) === 261009 ? "/limited/tricks?261009" : `/limited/${event.event_id}`}>
            <Box className={`stage-list-box ${Number(currentId) === Number(event.event_id) ? "active" : ""}`}>
                {eventDate(event.event_id)}<br/>{label(event)}
            </Box>
        </Link>
    )

    if(limitedGroups){
        return (
            <Box className="stage-list-wrapper" style={{overflowX: "auto", marginBottom: "12px"}}>
                <Box style={{minWidth: "900px"}}>
                    {limitedRuleGroups.map(group => {
                        const groupEvents = events.filter(event => group.ids.includes(Number(event.event_id)))
                            .sort((a, b) => group.ids.indexOf(Number(a.event_id)) - group.ids.indexOf(Number(b.event_id)))
                        if(!groupEvents.length) return null
                        return (
                            <Box component="section" aria-label={group.name} key={group.name}
                                 style={{marginBottom: "8px"}}>
                                <Box component="h2" style={{display: "table", margin: 0, padding: "4px 10px", fontSize: "0.85em", backgroundColor: group.color, color: group.textColor, borderRadius: "5px 5px 0 0"}}>
                                    <FontAwesomeIcon icon={group.icon} style={{marginRight:'6px'}}/>{group.name}
                                </Box>
                                <Box style={{display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", border: `1px solid ${group.color}`, borderRadius: "0 2px 2px 2px"}}>
                                    {groupEvents.map(eventLink)}
                                </Box>
                            </Box>
                        )
                    })}
                </Box>
            </Box>
        )
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
                        <Link href={Number(event.event_id) === 261009 ? "/limited/tricks?261009" : `/limited/${event.event_id}`}>
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
