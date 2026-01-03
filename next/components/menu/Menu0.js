import {
    Card,
    CardContent,
    CardHeader,
    ClickAwayListener,
    Grid,
    List,
    ListItem,
    MenuList,
    Paper
} from "@mui/material";
import * as React from "react";
import Link from "next/link";
import {HeaderPopMenu, SeriesTheme, StyledMenuItem} from "../../styles/pik5.css";
import {useLocale} from "../../lib/pik5";
import {du, eg, ne, p1} from "../../lib/const";

export default function Menu0(props){

    const {t} = useLocale()
    const color = "#fff"

    return (
        <HeaderPopMenu>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                    disablePadding
                >
                    <Grid container onClick={props.handleClose}>
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/" onClick={props.handleClose}>{t.g.top}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/auth/login" onClick={props.handleClose}>{t.g.login}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/auth/register" onClick={props.handleClose}>{t.g.register}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/auth/config" onClick={props.handleClose}>{t.g.config}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/total/1" onClick={props.handleClose}>{t.stage[1]}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/total/2" onClick={props.handleClose}>{t.stage[2]}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/total/3" onClick={props.handleClose}>{t.stage[3]}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/total/10" onClick={props.handleClose}>{t.stage[10]}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/total/20" onClick={props.handleClose}>{t.stage[20]}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/total/30" onClick={props.handleClose}>{t.stage[30]}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/total/40" onClick={props.handleClose}>{t.stage[40]}</StyledMenuItem>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+color,
                            }} component={Link} href="/keyword/rules" onClick={props.handleClose}>{t.g.ru}</StyledMenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </HeaderPopMenu>
    )
}