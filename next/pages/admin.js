import Link from 'next/link'
import { useSession, signIn, signOut } from "next-auth/react"
import SeoHead from "../components/SeoHead"

const DownloadCsvButton = ({ record }) => {

    // CSVファイルを生成する関数
    const generateCsv = (data) => {
        // 日付をフォーマットする関数 (yyyy/MM/dd hh:mm:ss)
        const formatDate = (date) => {
            const d = new Date(date)
            const pad = (n) => n.toString().padStart(2, '0')
            return isNaN(d.getTime()) ? date :
                `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        }

        // すべてのキーを取得してCSVのヘッダー行を作成
        const headers = Object.keys(data[0] || {}).join(',')

        // 各レコードをCSVのデータ行に変換
        const rows = data.map((item) => {
            return Object.keys(data[0]).map((key) => {
                const value = item[key] ?? ''

                // 整数値っぽいものはそのまま出力
                if (Number.isInteger(Number(value))) {
                    return value
                }
                // 日付に見えるものはフォーマットして出力
                const parsedDate = Date.parse(value)
                if (!isNaN(parsedDate)) {
                    return formatDate(value)
                }
                // その他のデータは文字列として扱う
                return `"${value}"`
            }).join(',')
        })

        // CSVの内容を結合
        return [headers, ...rows].join('\n')
    }

    // CSVをダウンロードする関数
    const downloadCsv = () => {
        // 現在のタイムスタンプを取得してファイル名に使用
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
        const filename = `record_${timestamp}.csv`

        // CSVデータを作成
        const csvContent = generateCsv(record)

        // BlobオブジェクトでCSVファイルを作成し、UTF-8でエンコード
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })

        // ファイルをダウンロードするためのリンクを作成
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.setAttribute('download', filename)

        // ダウンロードリンクをクリックしてCSVをダウンロード
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <button onClick={downloadCsv}>Download CSV</button>
    )
}

export async function getServerSideProps({req, res: response}) {
    response.setHeader('Cache-Control', 'private, no-store')
    const {getServerSession} = await import('next-auth/next')
    const {authOptions} = await import('./api/auth/[...nextauth]')
    const {currentManagementUser} = await import('../lib/dandoriServer')
    const currentUser = await currentManagementUser(await getServerSession(req, response, authOptions))
    if (Number(currentUser?.role) !== 10) return {props: {data: [], users: []}}
    const { getCachedUsersWithRole } = await import("../lib/usersCache")

    const users = await getCachedUsersWithRole()

    // すべての記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/record`)
    let data = await res.json()

    return {
        props: {
            data, users
        }
    }
}
export default function Admin({data, users}){

    let role = 0
    const {data: session } = useSession()
    // 権限チェック
    if(session) {
        role = Number(session?.user?.role)
    }
    if(Number(role) !== 10) {
        return (
            <div>
                <SeoHead
                    title={"管理画面 - ピクチャレ大会"}
                    noindex={true}
                />
                <h1>アクセス権がありません。</h1>
            </div>
        )
    }
    return (
        <div>
            <SeoHead
                title={"管理画面 - ピクチャレ大会"}
                noindex={true}
            />
            <h1>全記録ダウンロード</h1>
            <p><Link href="/admin/stages">だれでもダンドリ検定 ステージ管理</Link></p>
            <DownloadCsvButton record={data}/>
        </div>
    );
};
