import {useEffect, useState} from "react";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import { useRouter } from "next/router";
import Record from "../../components/Record";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCompass } from '@fortawesome/free-solid-svg-icons'

// ステージ番号をアクセスされるたびに取得する（サーバーサイド）
export async function getServerSideProps(context){
    const stage = context.query.stage
    const res = await fetch(`http://laravel:8000/api/record/${stage}`)
    const data = await res.json()
    return {
        props: {
            data, stage
        }
    }
}

// レンダラー本体（フロントサイド）
export default function Stage(param){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    return (
        <>
            <FontAwesomeIcon icon={faCompass} />
            ステージ：{ t.stage[param.stage] }<br/>
            <br/>
            <ul>
                {
                    param.data.map(post =>
                        <Record data={post} />
                    )
                }
            </ul>
        </>
    )
}
