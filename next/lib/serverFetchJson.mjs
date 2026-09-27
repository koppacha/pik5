import fetch from 'node-fetch'

// Node内蔵fetchのUndiciで、大きなConnection: close応答の読込が停止する問題を回避する。
// 集計APIは処理時間が長いため、一律のタイムアウトは設定しない。
export async function serverFetchJson(url) {
    const response = await fetch(url)
    if (!response.ok) {
        response.body.destroy()
        throw new Error(`Upstream API failed with status ${response.status}`)
    }
    return response.json()
}
