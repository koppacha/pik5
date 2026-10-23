import {useSession} from 'next-auth/react'
import useSWR from 'swr'

export default function useWorldRecordPermissions() {
    const {data: session} = useSession()
    const user = session?.user?.userId || session?.user?.id
    const {data, mutate} = useSWR(user ? ['/api/world-records?action=capabilities', user] : null, async ([url]) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error('利用状態を取得できません')
        return response.json()
    }, {refreshInterval: 30000, revalidateOnFocus: true})
    return {canReport: data?.can_report === true, canDelete: data?.can_delete === true, refresh: mutate}
}
