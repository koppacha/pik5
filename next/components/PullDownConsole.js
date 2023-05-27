import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {StyledSelect} from "../styles/pik5.css";

export default function PullDownConsole(props){

    const { locale } = useRouter()
    const t = (locale === "en") ? en : ja
    
    const consoles = [0]
    let type = ""
    let id   = ""

    // ユーザー別ランキング以外の処理
    if(props.info) {
        // 取得対象が総合ランキングの場合はparentを置換する
        const parent = (props.info.parent < 10) ? props.info.stage_id : props.info.parent

        // ステージによって操作方法配列を操作
        if (props.info.series === 1) {
            // ピクミン１＝Wii・NGC、全回収タイムアタック
            consoles.push(1, 2)
        }
        if (parent === 21) {
            // ピクミン２：タマゴムシ縛り
            consoles.push(1, 2)
        }
        if (parent === 22) {
            if (props.info.stage_id !== 216 && props.info.stage_id !== 223) {
                // スプレー縛り（食神のかまど、ひみつの花園は除外）
                consoles.push(1, 2)
            } else {
                // 食神のかまど、ひみつの花園
                consoles.push(1, 2)
            }
        }
        if (props.info.series === 3 && parent !== 35) {
            consoles.push(2, 3, 4, 5, 6)
        }
        type = props.info.type
        id   = props.info.stage_id
    } else {
        // ユーザー別ランキングの処理
        consoles.push(1, 2, 3, 4, 5, 6)
        type = "user"
        id   = props.user
    }

    return (
        <FormControl>
            <FormHelperText sx={{color:"#fff"}}>操作方法</FormHelperText>
            <StyledSelect
                defaultValue={props.console}
                id="select-console"
            >
                {
                    // 操作方法プルダウンを出力
                    consoles.map(val =>
                        <MenuItem value={val} component={Link} href={'/'+type+'/'+id+'/'+
                            val+'/'+props.rule+'/'+props.year}>{t.console[val]}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}