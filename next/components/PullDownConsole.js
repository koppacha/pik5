import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";

export default function PullDownConsole(props){

    const { locale } = useRouter()
    const t = (locale === "en") ? en : ja
    
    const consoles = [0]

    // 取得対象が総合ランキングの場合はparentを置換する
    const parent = (props.info.parent < 10) ? props.info.stage_id : props.info.parent

    // ステージによって操作方法配列を操作
    if(props.info.series === 1){
        // ピクミン１＝Wii・NGC、全回収タイムアタック
        consoles.push(1, 2)
    }
    if(parent === 21){
        // ピクミン２：タマゴムシ縛り
        consoles.push(1, 2)
    }
    if(parent === 22){
        if(props.info.stage_id !== 216 && props.info.stage_id !== 223){
            // スプレー縛り（食神のかまど、ひみつの花園は除外）
            consoles.push(1, 2)
        } else {
            // 食神のかまど、ひみつの花園
            consoles.push(1, 2)
        }
    }
    if(props.info.series === 3 && parent !== 35){
        consoles.push(2, 3, 4, 5, 6)
    }
    
    return (
        <FormControl>
            <FormHelperText sx={{color:"#fff"}}>操作方法</FormHelperText>
            <Select
                sx={{color:'#fff'}}
                defaultValue={props.console}
                id="select-consoles"
            >
                {
                    // 操作方法プルダウンを出力
                    consoles.map(val =>
                        <MenuItem value={val} component={Link} href={'/stage/'+props.info.stage_id+'/'+
                            val+'/'+props.rule+'/'+props.year}>{t.console[val]}</MenuItem>
                    )
                }
            </Select>
        </FormControl>
    )
}