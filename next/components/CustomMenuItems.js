import {MenuItem} from "@mui/material";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import {useState} from "react";
import Link from "next/link";

export default function CustomMenuItems(props){

    const [setAnchorEl] = useState(null);

    const handleClose = () => {
        setAnchorEl(null);
    };

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    if(props.series === 6) {
        // 総合ランキングのサブメニュー
        return (
            <>
                <Link href="/total/70"><MenuItem>全総合ランキング</MenuItem></Link>
                <Link href="/total/80"><MenuItem>通常総合ランキング</MenuItem></Link>
                <Link href="/total/90"><MenuItem>特殊総合ランキング</MenuItem></Link>
            </>
        )
    } else if(props.series === 2){
        // ピクミン２のサブメニュー
        return (
            <>
                <Link href="/total/200"><MenuItem>ピクミン２総合</MenuItem></Link>
                <Link href="/total/210"><MenuItem>タマゴあり</MenuItem></Link>
                <Link href="/total/220"><MenuItem>タマゴなし</MenuItem></Link>
                <Link href="/total/230"><MenuItem>本編地下</MenuItem></Link>
                <Link href="/total/240"><MenuItem>タマゴムシ縛り</MenuItem></Link>
                <Link href="/total/250"><MenuItem>スプレー縛り</MenuItem></Link>
                <Link href="/total/260"><MenuItem>ソロバトル</MenuItem></Link>
                <Link href="/total/270"><MenuItem>2Pチャレンジ</MenuItem></Link>
            </>
        )
    } else if(props.series === 3){
        // ピクミン３のサブメニュー
        return (
            <>
                <Link href="/total/300"><MenuItem>ピクミン３総合</MenuItem></Link>
                <Link href="/total/310"><MenuItem>お宝をあつめろ！</MenuItem></Link>
                <Link href="/total/320"><MenuItem>原生生物をたおせ！</MenuItem></Link>
                <Link href="/total/330"><MenuItem>巨大生物をたおせ！</MenuItem></Link>
                <Link href="/total/340"><MenuItem>サイドストーリー</MenuItem></Link>
                <Link href="/total/350"><MenuItem>ソロビンゴ</MenuItem></Link>
                <Link href="/total/360"><MenuItem>2Pチャレンジ</MenuItem></Link>
            </>
        )
    } else if(props.series === 4){
        // ピクミン４のサブメニュー（仮）
        return (
            <>
                <MenuItem onClick={handleClose}>ピクミン４総合</MenuItem>
            </>
        )
    } else if(props.series === 7){
        // 期間限定のサブメニュー
        return (
            <>
                <MenuItem onClick={handleClose}>期間限定総合</MenuItem>
                <MenuItem onClick={handleClose}>ルール投稿・投票</MenuItem>
                <MenuItem onClick={handleClose}>大会を開催する</MenuItem>
            </>
        )
    } else if(props.series === 8){
        // 日替わりのサブメニュー
        return (
            <>
                <MenuItem onClick={handleClose}>日替わり総合</MenuItem>
            </>
        )
    } else if(props.series === 9){
        // その他のサブメニュー
        return (
            <>
                <MenuItem onClick={handleClose}>チャレンジ複合（RTA）</MenuItem>
                <MenuItem onClick={handleClose}>バトルモード戦績</MenuItem>
                <MenuItem onClick={handleClose}>ルール集</MenuItem>
                <MenuItem onClick={handleClose}>Speedrun.com</MenuItem>
                <MenuItem onClick={handleClose}>Pikmin Wiki</MenuItem>
            </>
        )
    }
}