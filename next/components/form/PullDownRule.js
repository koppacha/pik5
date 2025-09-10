import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {StyledSelect} from "../../styles/pik5.css";
import {useLocale} from "../../lib/pik5";

export default function PullDownRule(props){

    // TODO: プルダウン版ルールフィルタはいまのところユーザー別ページでのみ使う
    const {consoles, rule, year, user} = props.props

    const {t} = useLocale()

    const rules = [0]

    rules.push(10, 11, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47)
    const type = "user"
    const id   = user

    return (
        <FormControl>
            <FormHelperText className="form-helper-text">{t.g.category}</FormHelperText>
            <StyledSelect
                className="styled-select"
                defaultValue={rule}
                id="select-rule"
                MenuProps={{disableScrollLock: true}}
            >
                {
                    // 操作方法プルダウンを出力
                    rules.map(rule =>
                        <MenuItem key={rule} value={rule} component={Link}
                                  href={'/'+type+'/'+id+'/'+consoles+'/'+rule+'/'+year}>{t.rule[rule]}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}