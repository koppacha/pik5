import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import Record from "../../components/Record";

export async function getServerSideProps(context){
    const series = context.query.series
    // TODO: 合計点算出はNext.jsのサーバーサイドで表示ごとに処理

    // シリーズ番号に基づいて集計対象ステージをバックエンドで選別して持ってくる
    const res = await fetch(`http://laravel:8000/api/total/${series}`)
    const data = await res.json()

    // 持ってきたデータを人別にまとめて配列に入れる

    // 合計点に基づいて並べて順位を付与する

    return {
        props: {
            data, series
        }
    }
}

export default function Series(param){

    // デフォルト設定ではスコア降順で並び替え（sort関数を使うためにオブジェクトを配列に変換）
    const result = Object.keys(param.data).map(function (key){
        return param.data[key]
    }).sort( function(a, b){
        return (a.score > b.score) ? -1 : 1
    })

    console.log(result)

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    return (
        <>
            ステージ：{ t.stage[param.series.slice(0,2)] }<br/>
            操作方法：{ t.stage[param.series.slice(-1)] }<br/>
            <br/>
            <ul>
                {
                    result.map(data =>
                        <li>{data.user_name}:{data.score}pts/{data.rps}rps</li>
                    )
                }
            </ul>
        </>
    )
}