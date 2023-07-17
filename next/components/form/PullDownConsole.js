import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {StyledSelect} from "../../styles/pik5.css";
import {useLocale} from "../../lib/pik5";

export default function PullDownConsole(props){

    const {info, console, rule, year, user} = props.props

    const {t} = useLocale()
    
    const consoles = [0]
    let type, id

    // ユーザー別ランキング以外の処理
    if(info) {
        // 取得対象が総合ランキングの場合はparentを置換する
        const parent = (info.parent < 10) ? info.stage_id : info.parent

        // ステージによって操作方法配列を操作
        if (info.series === 1 || info.series === 2) {
            // ピクミン１・２＝Wii・NGC・Switch
            consoles.push(1, 2, 7)
        }
        if (info.series === 3 && parent !== 36) {
            consoles.push(2, 3, 4, 5)
        }
        if (parent === 36){
            console.push(3, 4, 5, 6)
        }
        type = info.type
        id   = info.stage_id
    } else {
        // ユーザー別ランキングの処理
        consoles.push(1, 2, 3, 4, 5, 6, 7)
        type = "user"
        id   = user
    }

    return (
        <FormControl>
            <FormHelperText className="form-helper-text">{t.g.console}</FormHelperText>
            <StyledSelect
                defaultValue={console}
                id="select-console"
            >
                {
                    // 操作方法プルダウンを出力
                    consoles.map(val =>
                        <MenuItem key={val} value={val} component={Link} href={'/'+type+'/'+id+'/'+
                            val+'/'+rule+'/'+year}>{t.console[val]}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}