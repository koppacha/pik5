import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/router"
import {Box, FormControl, Grid, List, ListItem, Typography} from "@mui/material";
import {AuthButton, AuthWindow} from "../../styles/pik5.css";
import TextField from "@mui/material/TextField";
import {useLocale} from "../../lib/pik5";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import Image from "next/image";
import Link from "next/link";
import Head from "next/head";
import {logger} from "../../lib/logger";
import prisma from "../../lib/prisma";

export async function getServerSideProps(context){

    // スクリーンネームをリクエスト（検索用）
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    return {
        props: {
            users
        }
    }
}

export default function Register() {

    const {t} = useLocale()
    const router = useRouter();

    const [message, setMessage] = useState('')

    const schema = yup.object({
        name: yup
            .string()
            .matches(/^[^<>\\"']*$/, "特殊な文字は使えません。")
            .max(32, "表示名は32文字までです。")
            .required(t.yup.required),
        userId: yup
            .string()
            .matches(/^[\w-]+$/, "使える文字種は半角英数字、アンダーバー、ハイフンのみです。")
            .max(32, "ユーザーIDは32文字までです。")
            .required(t.yup.required),
        password: yup
            .string()
            .matches(/^[^<>\\"']*$/, "特殊な文字は使えません。")
            .required(t.yup.required),
    })

    const {
        handleSubmit,
        register,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
    });

    async function onSubmit(values) {
        if(!values.userId){
            setMessage("ユーザーIDが入力されていません。")
            return
        }
        const body = { ...values }
        const res = await fetch(`/api/user/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        if(res.status < 300) {
            await router.push(
                `login${
                    router.query.callbackUrl
                        ? `?callbackUrl=${router.query.callbackUrl}`
                        : ""}`)
        } else {
            const error = await res.json()
            setMessage(error.error ||"不明なエラーが発生しています。");
        }
    }
    return (
        <>
            <Head>
                <title>{t.g.register+" - "+t.title[0]}</title>
            </Head>
            <Box>
                <Box style={{zIndex:"-1",position:"fixed",top:"0",left:"0",width:"100%",height:"100vh"}}>
                    <Image src="/img/bg29.jpg" fill style={{objectFit:"cover",overflow:"hidden"}} alt="background"/>
                </Box>
                <Grid container justifyContent="center" alignItems="center" style={{height:"100vh"}}>
                    <AuthWindow className="auth-window" item>
                        <Typography variant="strong" style={{margin:"10px",fontSize:"2em",lineHeight:"2em"}}>{t.g.welcome}</Typography><br/>
                        <Box className="form-helper-text">
                            <TextField
                                {...register('name')}
                                id="name"
                                label={t.g.userName}
                                type="text"
                                variant="standard"
                                error={'name' in errors}
                                helperText={errors.name?.message}
                            /><br/>
                            <TextField
                                {...register('userId')}
                                id="userId"
                                label={t.g.userId}
                                type="text"
                                variant="standard"
                                error={'userId' in errors}
                                helperText={errors.userId?.message}
                            /><br/>
                            <TextField
                                {...register('password')}
                                id="password"
                                label={t.g.password}
                                type="password"
                                variant="standard"
                                error={'password' in errors}
                                helperText={errors.password?.message}
                            /><br/>
                            <AuthButton onClick={handleSubmit(onSubmit)}>{t.g.submit}</AuthButton>
                        </Box>
                        <Box style={{margin:"30px",color:"red"}}>
                            {message && <>＊{message}</>}
                        </Box>
                        <Box style={{border:"1px solid #fff",borderRadius:"8px",padding:"10px",width:"100%"}}>
                            {t.g.register1}<br/>
                            {t.g.register2}<br/>
                            {t.g.register3}
                        </Box>
                        <Box style={{width:"100%"}}>
                            <List>
                                <ListItem><Link href="/">{t.g.top}</Link></ListItem>
                                <ListItem><Link href="/auth/login">{t.g.registered}</Link></ListItem>
                                <ListItem><Link href="/keyword/moving">{t.g.transferFromOldSite}</Link></ListItem>
                                <ListItem><Link href="/keyword/rules">{t.g.ru}</Link></ListItem>
                            </List>
                        </Box>

                    </AuthWindow>
                </Grid>
            </Box>
        </>
    );
}
