import { useSession, signIn, signOut } from "next-auth/react"
import prisma from "../lib/prisma";

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

export async function getStaticProps() {

    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true,
            role: true
        }
    })

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
        // セッションユーザーの情報を取り出す
        role = Number(users.find(function (e) {
            return e.userId === session.user.userId
        }).role)
    }
    if(Number(role) !== 10) {
        return (
            <div>
                <h1>アクセス権がありません。</h1>
            </div>
        )
    }
    return (
        <div>
            <h1>全記録ダウンロード</h1>
            <DownloadCsvButton record={data}/>
        </div>
    );
};