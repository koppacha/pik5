import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {StyledSelect} from "../styles/pik5.css";
import {useLocale} from "../plugin/pik5";

export default function PullDownConsole(props){

    const {info, console, rule, year, user} = props.props
    
    const {t, r} = useLocale()
    
    const consoles = [0]
    let type = ""
    let id   = ""

    // ユーザー別ランキング以外の処理
    if(info) {
        // 取得対象が総合ランキングの場合はparentを置換する
        const parent = (info.parent < 10) ? info.stage_id : info.parent

        // ステージによって操作方法配列を操作
        if (info.series === 1) {
            // ピクミン１＝Wii・NGC、全回収タイムアタック
            consoles.push(1, 2)
        }
        if (parent === 21) {
            // ピクミン２：タマゴムシ縛り
            consoles.push(1, 2)
        }
        if (parent === 22) {
            if (info.stage_id !== 216 && info.stage_id !== 223) {
                // スプレー縛り（食神のかまど、ひみつの花園は除外）
                consoles.push(1, 2)
            } else {
                // 食神のかまど、ひみつの花園
                consoles.push(1, 2)
            }
        }
        if (info.series === 3 && parent !== 35) {
            consoles.push(2, 3, 4, 5, 6)
        }
        type = info.type
        id   = info.stage_id
    } else {
        // ユーザー別ランキングの処理
        consoles.push(1, 2, 3, 4, 5, 6)
        type = "user"
        id   = user
    }

    return (
        <FormControl>
            <FormHelperText className="form-helper-text">操作方法</FormHelperText>
            <StyledSelect
                defaultValue={console}
                id="select-console"
            >
                {
                    // 操作方法プルダウンを出力
                    consoles.map(val =>
                        <MenuItem value={val} component={Link} href={'/'+type+'/'+id+'/'+
                            val+'/'+rule+'/'+year}>{t.console[val]}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}