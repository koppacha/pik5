import {Box} from "@mui/material";
import {fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";

export default function RankingStandard({borders, stage, console:consoles, rule, year}){

    const {data} = useSWR(`http://localhost:8000/api/record/${stage}/${consoles}/${rule}/${year}`, fetcher)
    if(!data){
        return (
            <NowLoading/>
        )
    }
    const {t} = useLocale()
    let i = borders.length - 1

    return Object.values(data).map(function (post){
                    const border = borders[i]
                    const star = "★"
                    if(post.score < border){
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