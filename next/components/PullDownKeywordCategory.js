import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {StyledSelect} from "../styles/pik5.css";
import {useLocale} from "../lib/pik5";

export default function PullDownKeywordCategory({category}){

    const {t, } = useLocale()
    
    const categoryArray = ["all", "game", "pikmin", "collect", "field", "object", "creature", "character", "world", "term", "term2", "psl", "technical", "glitch", "rule", "qa", "other"]

    return (
        <FormControl>
            <FormHelperText className="form-helper-text">カテゴリ</FormHelperText>
            <StyledSelect
                defaultValue={category || "all"}
                id="select-category"
            >
                {
                    // 操作方法プルダウンを出力
                    categoryArray.map(val =>
                        <MenuItem value={val} component={Link} href={'/keyword?c='+val}>{t.keyword.category[val]}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}