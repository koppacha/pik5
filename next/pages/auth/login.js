import React, {useState} from "react";
import {signIn, useSession} from "next-auth/react";
import {useRouter} from "next/router";
import {useForm} from "react-hook-form";
import {logger} from "../../lib/logger";
import {Box, FormControl, Grid, List, ListItem, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import {useLocale} from "../../lib/pik5";
import TextField from "@mui/material/TextField";
import {yupResolver} from "@hookform/resolvers/yup";
import * as yup from "yup";
import {AuthButton, AuthWindow} from "../../styles/pik5.css";
import Image from "next/image";
import Link from "next/link";
import Head from "next/head";

export default function Login(){

    const {t} = useLocale()

    const { data: session, status } = useSession();
    const router = useRouter();

    const schema = yup.object({
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
        watch,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
    });

    let defaultBody = {
        userId: "",
        password: "",
    };
    async function onSubmit(values) {
        try {
            const body = { ...defaultBody, ...values };

            let res = await signIn("credentials", {
                ...body,
                callbackUrl: router.query.callbackUrl,
            });
        } catch (error) {
            logger.error(error);
        }
    }
    if (status === "authenticated") {
        router.push("/", {
            query: {
                callbackUrl: router.query.callbackUrl,
            },
        });
    }

    return (
        <>
            <Head>
                <title>{t.g.login} - {t.title[0]}</title>
            </Head>
            <Box>
                <Box style={{zIndex:"-1",position:"fixed",top:"0",left:"0",width:"100%",height:"100vh"}}>
                    <Image src="/img/bg29.jpg" fill style={{objectFit:"cover",overflow:"hidden"}} alt="background"/>
                </Box>
                <Grid container justifyContent="center" alignItems="center" style={{height:"100vh"}}>
                    <AuthWindow item>
                        <Typography variant="strong">{t.g.login}</Typography><br/>
                        <Box className="form-helper-text">
                            <TextField
                                {...register('userId')}
                                id="userId"
                                label={t.g.userName}
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
                            />
                            <AuthButton onClick={handleSubmit(onSubmit)}>{t.g.login}</AuthButton>
                        </Box>
                        <Box style={{marginTop:"30px",width:"100%"}}>
                            <List>
                                <ListItem><Link href="/">・トップページへ</Link></ListItem>
                                <ListItem><Link href="/auth/register">・未登録の方はこちら</Link></ListItem>
                                <ListItem><Link href="/keyword/moving">・旧ピクチャレ大会からの引き継ぎはこちら</Link></ListItem>
                            </List>
                        </Box>
                    </AuthWindow>
                </Grid>
            </Box>
        </>
    )
}