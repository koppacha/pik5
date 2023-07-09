import {Box} from "@mui/material";
import {fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import {logger} from "../../lib/logger";

export default function RankingStandard({borders, stage, console:consoles, rule, year}){

    const { data } = useSWR(`/api/server/record/${stage}/${consoles}/${rule}/${year}`, fetcher)

    if(!data){
        return (
            <NowLoading/>
        )
    }
    const {t} = useLocale()
    let i = borders.length - 1

    // 参考スコアを表示するルール
    const borderShowRules = [20, 21, 22]

    return Object.values(data.data).map(function (post){
                    const border = borders[i]
                    const star = "★"
                    if(post.score < border && borderShowRules.includes(Number(rule))){
                        i--;
                        return (
                            <>
                                <Box style={{
                                    color:"#e81fc1",
                                    borderBottom:"2px dotted #e81fc1",
                                    textAlign:"center",
                                    margin:"8px 0"
                                }}>
                                    {star.repeat(i + 2)} {t.border[2][i + 1]} {border.toLocaleString()} pts.
                                </Box>
                                <Record data={post}/>
                            </>
                        )
                    } else {
                        return (
                            <Record data={post}/>
                        )
                    }
                }
            )
}