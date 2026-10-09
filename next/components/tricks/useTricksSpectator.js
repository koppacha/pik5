import {useCallback, useEffect, useRef, useState} from "react"

// Log IDs are monotonic, including when several posts arrive in one poll.
export default function useTricksSpectator(state, enabled) {
    const [presentation, setPresentation] = useState(null)
    const queueRef = useRef([])
    const activeRef = useRef(null)
    const timerRef = useRef(null)
    const cursorRef = useRef(null)
    const eventRef = useRef(null)

    const next = useCallback(() => {
        const item = queueRef.current.shift()
        activeRef.current = item || null
        setPresentation(item ? {item, blinking: true} : null)
        if (!item) return
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null
            setPresentation({item, blinking: false})
            if (!queueRef.current.length) {
                activeRef.current = null
                setPresentation(null)
                return
            }
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null
                next()
            }, 1000)
        }, 10000)
    }, [])

    useEffect(() => {
        if (!state) return
        const cursor = Math.max(0, ...(state.logs || []).map((log) => Number(log?.id) || 0))
        const changedEvent = eventRef.current !== state.tournament?.event_id
        if (!enabled || changedEvent || cursorRef.current === null) {
            if (timerRef.current) window.clearTimeout(timerRef.current)
            timerRef.current = null
            queueRef.current = []
            activeRef.current = null
            cursorRef.current = cursor
            eventRef.current = state.tournament?.event_id
            setPresentation(null)
            return
        }
        const posts = (state.logs || [])
            .filter((log) => Number(log?.id) > cursorRef.current
                && ["record_posted", "record_updated"].includes(log.event))
            .sort((a, b) => Number(a.id) - Number(b.id))
        cursorRef.current = Math.max(cursorRef.current, cursor)
        posts.forEach((log) => {
            // A post can be collected before the next poll; its public log retains the card identity.
            const card = (state.field || []).find((candidate) => Number(candidate.event_card_id) === Number(log.event_card_id))
                || (log.card_id && log.event_card_id && {
                    id: log.card_id, event_card_id: log.event_card_id, stage_id: log.stage_id,
                    title: log.card_title, rule_name: log.rule_name,
                })
            if (card) queueRef.current.push({log, card})
        })
        if (!activeRef.current && queueRef.current.length) next()
    }, [enabled, next, state])

    useEffect(() => () => {
        if (timerRef.current) window.clearTimeout(timerRef.current)
        queueRef.current = []
        activeRef.current = null
        cursorRef.current = null
        eventRef.current = null
    }, [])

    return presentation
}
