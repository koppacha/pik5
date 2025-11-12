import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {StyledSelect} from "../../styles/pik5.css";
import {rule2consoles, useLocale} from "../../lib/pik5";

export default function PullDownDifficulty(props){

    const {info, consoles, rule, year, user, difficulty} = props.props

    const {t} = useLocale()

    const difficultyArray = [0, 1, 2, 3]
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
            <FormHelperText className="form-helper-text">{t.g.difficulty}</FormHelperText>
            <Select
                className="styled-select"
                defaultValue={0}
                id="select-console"
                MenuProps={{disableScrollLock: true}}
            >
                {
                    // 操作方法プルダウンを出力
                    difficultyArray.map(val =>
                        <MenuItem key={val} value={val} component={Link}
                                  href={'/'+type+'/'+id+'/'+consoles+'/'+rule+'/'+year+'/'+val}>{t.difficulty[val]}</MenuItem>
                    )
                }
            </Select>
        </FormControl>
    )
}