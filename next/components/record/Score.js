import {ScoreTail, ScoreType} from "../../styles/pik5.css";
import useSWR from "swr"
import {fetcher, range, sec2time} from "../../lib/pik5";
import {timeStageList} from "../../lib/const";

export default function Score({rule, score, stage, category, unit = "pts", showZero = false, scoreType = null}){

    const eventStage = Number(stage) >= 1001 && Number(stage) <= 1999
    const {data: stageMetadata} = useSWR(eventStage && !scoreType ? `/api/server/stage/${stage}` : null, fetcher)
    const isEventTime = scoreType === "time" || (eventStage && (stageMetadata?.data?.display === "time" || stageMetadata?.display === "time"))
    if(!score && !showZero){
        return (
            <></>
        )
    }

    // 全回収TAの場合はスコアから逆算して経過時間を求める
    function score2time(score, stage){
        const stageTimes = timeStageList.find(lists => lists.stage === Number(stage))
        return stageTimes.time - (score - stageTimes.score)
    }

    if (isEventTime) {
        return <ScoreType className="score-type" as="span">{sec2time(Number(score))}</ScoreType>
    }
    if( category === "battle"){
        // バトルモードの場合
        return (
            <>
                <ScoreTail className="score-tail" as="span">Rate </ScoreTail>
                <ScoreType className="score-type" as="span">{score.toLocaleString()}</ScoreType>
            </>
        )
    }
    // 時間表示するルール一覧
    else if([11, 29, 35, 43, 46, 47, 91].includes(Number(rule)) || category === "speedrun"){
        // RTAの場合
        const convertScore = (Number(rule) === 11) ? score2time(score, stage) : score
        return (
            <>
                <ScoreType className="score-type" as="span">{sec2time(convertScore)}</ScoreType>
            </>
        )
    } else {
        const time = timeStageList.find(({stage:s})=> s === stage)
        if(time && Number(rule) !== 10 && Number(rule) !== 25){
            // 残り時間で競うステージの場合（全回収TA、本編地下を除く）
            const screenTime = time.time - score

            return (
                <>
                    <ScoreType className="score-type" as="span">{sec2time(screenTime)}</ScoreType>
                </>
            )
        } else {
            // ポイントで競うステージの場合
            return (
                <>
                    <ScoreType className="score-type" as="span">{score.toLocaleString()}</ScoreType>
                    <ScoreTail className="score-tail" as="span"> {unit}.</ScoreTail>
                </>
            )
        }
    }
}
