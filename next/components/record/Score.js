import {ScoreTail, ScoreType} from "../../styles/pik5.css";
import {range} from "../../lib/pik5";

export default function Score({score, stage, category}){
    function sec2time(sec){
        const hh = ("00"+ ~~(sec / 3600)).slice(-2)
        const mm = ("00"+ ~~(~~(sec / 60) % 60)).slice(-2)
        const ss = ("00"+ ~~(sec % 60)).slice(-2)
        return (hh !== "00" ? hh +":" :"")+mm+":"+ss
    }
    // 巨大生物をたおせと一部のサイドストーリーの初期残時間を定義
    const timeStageList = [{stage:338, time:720}, {stage:341, time:840},
        {stage:343, time:780}, {stage:345, time:420}, {stage:346, time:420}, {stage:347, time:900},
        {stage:348, time:780}, {stage:349, time:600}, {stage:350, time:900}]

    const soloBattleList = range(245, 254) // ソロバトル
    const bingoBattleList = range(351, 362) // ソロビンゴ
    const countUpStageList = soloBattleList.concat(bingoBattleList)

    if(category === "speedrun" || countUpStageList.includes(stage)){
        // RTAの場合
        return (
            <>
                <ScoreType as="span">{sec2time(score)}</ScoreType>
            </>
        )
    } else {
        const time = timeStageList.find(({stage:s})=> s === stage)
        if(time){
            // 残り時間で競うステージの場合
            const screenTime = time.time - score

            return (
                <>
                    <ScoreType as="span">{sec2time(screenTime)}</ScoreType>
                </>
            )
        } else {
            // ポイントで競うステージの場合
            return (
                <>
                    <ScoreType as="span">{score.toLocaleString()}</ScoreType>
                    <ScoreTail as="span"> pts.</ScoreTail>
                </>
            )
        }
    }
}