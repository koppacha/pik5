import {useCallback, useEffect, useMemo, useRef, useState} from "react"
import {fetcher, useLocale} from "../../lib/pik5"
import RecordNotificationToast from "./RecordNotificationToast"
import {
    buildNotificationPayload,
    getRecordUserName,
    isBrowserNotificationEnabled,
    isLocalNotificationDebugMode,
    readNotificationStorage,
    RECORD_NOTIFY_COOLDOWN_MS,
    RECORD_POLL_INTERVAL_MS,
    RECORD_USER_COOLDOWN_MS,
    writeNotificationStorage,
} from "../../lib/recordNotification"

const LAST_NOTIFICATION_AT_KEY = "pik5_record_last_notification_at"
const USER_NOTIFICATION_MAP_KEY = "pik5_record_user_notification_map"

export default function RecordNotificationCenter({initialUsers = []}) {
    const {t} = useLocale()
    const isDebugModeRef = useRef(false)
    const [users, setUsers] = useState(Array.isArray(initialUsers) ? initialUsers : [])
    const [toastPayload, setToastPayload] = useState(null)
    const [toastOpen, setToastOpen] = useState(false)
    const initializedRef = useRef(false)
    const lastSeenPostIdRef = useRef(0)
    const pollingRef = useRef(false)
    const pendingRecordsRef = useRef([])
    const flushTimerRef = useRef(null)
    const flushPendingRecordsRef = useRef(() => {})
    const lastNotificationAtRef = useRef(0)
    const userNotificationMapRef = useRef({})

    useEffect(() => {
        isDebugModeRef.current = isLocalNotificationDebugMode()
        lastNotificationAtRef.current = Number(readNotificationStorage(LAST_NOTIFICATION_AT_KEY, 0)) || 0
        userNotificationMapRef.current = readNotificationStorage(USER_NOTIFICATION_MAP_KEY, {})
    }, [])

    useEffect(() => {
        if (Array.isArray(initialUsers) && initialUsers.length > 0) {
            setUsers(initialUsers)
        }
    }, [initialUsers])

    useEffect(() => {
        if (users.length > 0) return

        let cancelled = false
        fetcher("/api/users").then((response) => {
            if (cancelled || !Array.isArray(response)) return
            setUsers(response)
        }).catch(() => {

        })

        return () => {
            cancelled = true
        }
    }, [users.length])

    const usersById = useMemo(() => {
        return users.reduce((acc, user) => {
            if (!user?.userId) return acc
            acc[user.userId] = user
            return acc
        }, {})
    }, [users])

    const persistCooldownState = useCallback(() => {
        writeNotificationStorage(LAST_NOTIFICATION_AT_KEY, lastNotificationAtRef.current)
        writeNotificationStorage(USER_NOTIFICATION_MAP_KEY, userNotificationMapRef.current)
    }, [])

    const markUsersNotified = useCallback((records) => {
        const now = Date.now()
        records.forEach((record) => {
            if (!record?.user_id) return
            userNotificationMapRef.current[record.user_id] = now
        })
        persistCooldownState()
    }, [persistCooldownState])

    const notifyBrowser = useCallback((payload) => {
        if (typeof window === "undefined" || !payload) return
        if (!isBrowserNotificationEnabled()) return

        try {
            new window.Notification(payload.title, {
                body: payload.body,
                tag: "pik5-new-record",
                renotify: false,
            })
        } catch {

        }
    }, [])

    const flushPendingRecords = useCallback(() => {
        if (flushTimerRef.current) {
            window.clearTimeout(flushTimerRef.current)
            flushTimerRef.current = null
        }

        if (pendingRecordsRef.current.length === 0) return

        const now = Date.now()
        const remaining = isDebugModeRef.current ? 0 : (lastNotificationAtRef.current + RECORD_NOTIFY_COOLDOWN_MS) - now

        if (remaining > 0) {
            flushTimerRef.current = window.setTimeout(() => flushPendingRecordsRef.current(), remaining)
            return
        }

        const batch = [...pendingRecordsRef.current]
        pendingRecordsRef.current = []

        const payload = buildNotificationPayload(batch, t, usersById)
        if (!payload) return

        lastNotificationAtRef.current = now
        markUsersNotified(batch)
        setToastPayload(payload)
        setToastOpen(true)
        notifyBrowser(payload)
        persistCooldownState()
    }, [markUsersNotified, notifyBrowser, persistCooldownState, t, usersById])

    useEffect(() => {
        flushPendingRecordsRef.current = flushPendingRecords
    }, [flushPendingRecords])

    const enqueueRecords = useCallback((records) => {
        const existingIds = new Set(pendingRecordsRef.current.map((record) => Number(record.post_id)))
        records.forEach((record) => {
            if (existingIds.has(Number(record.post_id))) return
            pendingRecordsRef.current.push(record)
        })
        flushPendingRecords()
    }, [flushPendingRecords])

    const filterEligibleRecords = useCallback((records) => {
        const now = Date.now()

        return records.filter((record) => {
            if (!record?.post_id || Number(record?.stage_id) >= 1000) return false

            const userId = record?.user_id
            if (!userId) return false

            const lastNotifiedAt = Number(userNotificationMapRef.current[userId] || 0)
            return !(!isDebugModeRef.current && lastNotifiedAt > 0 && (now - lastNotifiedAt) < RECORD_USER_COOLDOWN_MS);


        }).map((record) => ({
            ...record,
            user_name: getRecordUserName(record, usersById),
        }))
    }, [usersById])

    useEffect(() => {
        let cancelled = false

        const poll = async () => {
            if (cancelled || pollingRef.current) return
            pollingRef.current = true

            try {
                if (!initializedRef.current) {
                    const latest = await fetcher("/api/server/new?limit=1")
                    const rows = Array.isArray(latest?.data) ? latest.data : []
                    lastSeenPostIdRef.current = Number(rows[0]?.post_id || 0)
                    initializedRef.current = true
                    return
                }

                const response = await fetcher(`/api/server/new?after_post_id=${lastSeenPostIdRef.current}`)
                const rows = Array.isArray(response?.data) ? response.data : []
                if (rows.length === 0) return

                lastSeenPostIdRef.current = rows.reduce((max, row) => {
                    return Math.max(max, Number(row?.post_id || 0))
                }, lastSeenPostIdRef.current)

                const eligibleRecords = filterEligibleRecords(rows)
                if (eligibleRecords.length > 0) {
                    enqueueRecords(eligibleRecords)
                }
            } catch {

            } finally {
                pollingRef.current = false
            }
        }

        poll()
        const timerId = window.setInterval(poll, RECORD_POLL_INTERVAL_MS)

        return () => {
            cancelled = true
            window.clearInterval(timerId)
            if (flushTimerRef.current) {
                window.clearTimeout(flushTimerRef.current)
                flushTimerRef.current = null
            }
        }
    }, [enqueueRecords, filterEligibleRecords])

    return (
        <RecordNotificationToast
            open={toastOpen}
            payload={toastPayload}
            onClose={() => setToastOpen(false)}
        />
    )
}
