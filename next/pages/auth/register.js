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
        const body = { ...values };
        const res = await fetch(`/api/user/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        reset();
        if(res.status < 300) {
            router.push(
                `login${
                    router.query.callbackUrl
                        ? `?callbackUrl=${router.query.callbackUrl}`
                        : ""
                }`,
            )
        } else {
            setMessage("すでに登録されているユーザーIDです。");
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
                    <AuthWindow item>
                        <Typography variant="strong">ピクチャレ大会へようこそ</Typography><br/>
                        <Box className="form-helper-text">
                            <TextField
                                {...register('name')}
                                id="name"
                                label="ユーザー名"
                                type="text"
                                variant="standard"
                                error={'name' in errors}
                                helperText={errors.name?.message}
                            /><br/>
                            <TextField
                                {...register('userId')}
                                id="userId"
                                label="ユーザーID"
                                type="text"
                                variant="standard"
                                error={'userId' in errors}
                                helperText={errors.userId?.message}
                            /><br/>
                            <TextField
                                {...register('password')}
                                id="password"
                                label="パスワード"
                                type="password"
                                variant="standard"
                                error={'password' in errors}
                                helperText={errors.password?.message}
                            /><br/>
                            <AuthButton onClick={handleSubmit(onSubmit)}>{t.g.submit}</AuthButton>
                        </Box>
                        <Box style={{marginTop:"30px",width:"100%"}}>
                            {message && <>{message}</>}
                        </Box>
                        <Box style={{border:"1px solid #fff",borderRadius:"8px",padding:"10px",width:"100%"}}>
                            ユーザー名はランキングに表示される名前です。今後変更できるようになる予定です。<br/>
                            ユーザーIDはログインとユーザーページのアクセスに必要なIDです。基本的に変更はできません。<br/>
                            登録することで利用規約に同意したものとみなします。
                        </Box>
                        <Box style={{width:"100%"}}>
                            <List>
                                <ListItem><Link href="/">・トップページへ</Link></ListItem>
                                <ListItem><Link href="/auth/login">・登録済みの方はこちら</Link></ListItem>
                                <ListItem><Link href="/keyword/moving">・旧ピクチャレ大会からの引き継ぎはこちら</Link></ListItem>
                                <ListItem><Link href="/keyword/rules">・利用規約</Link></ListItem>
                            </List>
                        </Box>

                    </AuthWindow>
                </Grid>
            </Box>
        </>
    );
}
