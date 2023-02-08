import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";

export default function Record(props) {

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const r = props.data;

    return (
        <div>
            {r.user_name}さん |
            {r.score} pts. |
            {r.rps} rps. |
            {t.stage[r.stage_id]} |
            {r.img_url} |
            {r.video_url} |
            {r.unique_id} |
            {r.evi_hash} |
            {r.post_rank} 位 |
            {r.created_at} |
            {r.flg} flg |
            {r.post_comment}
        </div>
    )
}