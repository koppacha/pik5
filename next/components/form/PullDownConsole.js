import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {StyledSelect} from "../../styles/pik5.css";
import {rule2consoles, useLocale} from "../../lib/pik5";

export default function PullDownConsole(props){

    const {info, consoles, rule, year, user} = props.props

    const {t} = useLocale()

    const consoleArray = [0].concat(rule2consoles(rule))
    let type, id

    // ユーザー別ランキング以外の処理
    if(info?.parent) {
        // 取得対象が総合ランキングの場合はparentを置換する
        const parent = (info.parent < 10) ? info.stage_id : info.parent
        type = info.type
        id   = info.stage_id
    } else {
        type = "user"
        id   = user
    }

    return (
        <FormControl>
            <FormHelperText className="form-helper-text">{t.g.console}</FormHelperText>
            <StyledSelect
                defaultValue={consoles}
                id="select-console"
                MenuProps={{disableScrollLock: true}}
            >
                {
                    // 操作方法プルダウンを出力
                    consoleArray.map(val =>
                        <MenuItem key={val} value={val} component={Link}
                                  href={'/'+type+'/'+id+'/'+val+'/'+rule+'/'+year}>{t.console[val]}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}