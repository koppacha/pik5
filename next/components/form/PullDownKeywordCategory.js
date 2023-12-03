import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {StyledSelect} from "../../styles/pik5.css";
import {useLocale} from "../../lib/pik5";

export default function PullDownKeywordCategory({category}){

    const {t, } = useLocale()
    
    const categoryArray = ["all", "game", "pikmin", "field", "object", "creature", "character", "world", "term", "term2", "psl", "technical", "glitch", "rule", "idea", "other"]

    return (
        <FormControl>
            <FormHelperText className="form-helper-text">{t.keyword.g.category}</FormHelperText>
            <StyledSelect
                defaultValue={category || "all"}
                id="select-category"
            >
                {
                    categoryArray.map(val =>
                        <MenuItem key={val} value={val} component={Link} href={'/keyword?c='+val}>{t.keyword.category[val]}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}