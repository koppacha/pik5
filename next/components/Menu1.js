import {
    Card,
    CardContent,
    CardHeader,
    ClickAwayListener,
    Grid,
    List,
    ListItem,
    MenuItem,
    MenuList,
    Paper
} from "@mui/material";
import * as React from "react";
import {range} from "@/plugin/pik5";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import Link from "next/link";

const s101Color = "#ffa35b"
const s102Color = "#dc6b24"
const s103Color = "#fa8e22"
const s104Color = "#f1c14d"
const s105Color = "#d56839"

export default function Menu1(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    return (
        <Paper>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                    sx={{
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={2}>
                            <Card>
                                <CardHeader
                                    title="ピクミン"
                                    subheader="[NGC/Wii] Since 2001"
                                />
                                <CardContent>
                                    <List>
                                        <ListItem>参加者数：99人</ListItem>
                                        <ListItem component={Link} href="/total/100">総合ランキング</ListItem>
                                        <ListItem>レギュレーション</ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={2}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s101Color,
                                borderLeft:"solid 10px "+s101Color,
                                margin:"6px 4px 0px 4px",
                                height:"42px",
                            }} component={Link} href="/stage/101">#101 {t.stage[101]}</MenuItem>
                        </Grid>
                        <Grid item xs={2}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s102Color,
                                borderLeft:"solid 10px "+s102Color,
                                margin:"6px 4px 0px 4px",
                                height:"42px",
                            }} component={Link} href="/stage/102">#102 {t.stage[102]}</MenuItem>
                        </Grid>
                        <Grid item xs={2}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s103Color,
                                borderLeft:"solid 10px "+s103Color,
                                margin:"6px 4px 0px 4px",
                                height:"42px",
                            }} component={Link} href="/stage/103">#103 {t.stage[103]}</MenuItem>
                        </Grid>
                        <Grid item xs={2}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s104Color,
                                borderLeft:"solid 10px "+s104Color,
                                margin:"6px 4px 0px 4px",
                                height:"42px",
                            }} component={Link} href="/stage/104">#104 {t.stage[104]}</MenuItem>
                        </Grid>
                        <Grid item xs={2}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s105Color,
                                borderLeft:"solid 10px "+s105Color,
                                margin:"6px 4px 0px 4px",
                                height:"42px",
                            }} component={Link} href="/stage/105">#105 {t.stage[105]}</MenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}