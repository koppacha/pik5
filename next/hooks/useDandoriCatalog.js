import useSWR from 'swr'

export default function useDandoriCatalog() {
    const {data, error} = useSWR('/api/dandori', async url => {
        const response = await fetch(url)
        if (!response.ok) throw new Error('検定情報を取得できません')
        return response.json()
    }, {revalidateOnFocus: true, refreshInterval: 60000})
    return error ? {...data, unavailable: true} : data
}
