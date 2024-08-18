import {ScoreTail, ScoreType} from "../../styles/pik5.css";
import {range, sec2time} from "../../lib/pik5";
import {timeStageList} from "../../lib/const";

export default function Score({rule, score, stage, category}){

    const soloBattleList = range(245, 254) // ソロバトル
    const bingoBattleList = range(351, 362) // ソロビンゴ
    const countUpStageList = soloBattleList.concat(bingoBattleList)

    if(!score){
        return (
            <></>
        )
    }

    // 全回収TAの場合はスコアから逆算して経過時間を求める
    function score2time(score, stage){
        const stageTimes = timeStageList.find(lists => lists.stage === Number(stage))
        return stageTimes.time - (score - stageTimes.score)
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
    else if(Number(rule) === 11 || Number(rule) === 43 || Number(rule) === 46 || Number(rule) === 91 || category === "speedrun" || countUpStageList.includes(stage)){
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
                    <ScoreTail className="score-tail" as="span"> pts.</ScoreTail>
                </>
            )
        }
    }
}