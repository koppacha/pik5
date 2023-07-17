import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/router"
import {Box, FormControl, Grid, Typography} from "@mui/material";
import {AuthWindow} from "../../styles/pik5.css";
import TextField from "@mui/material/TextField";
import {useLocale} from "../../lib/pik5";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import Button from "@mui/material/Button";
import Image from "next/image";

export default function Register() {

    const {t} = useLocale()
    const router = useRouter();

    const schema = yup.object({
        name: yup
            .string()
            .required(t.yup.required),
        userId: yup
            .string()
            .required(t.yup.required),
        password: yup
            .string()
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
        try {
            const body = { ...values };
            console.log(`POSTing ${JSON.stringify(body, null, 2)}`);
            const res = await fetch(`/api/user/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            reset();
            router.push(
                `login${
                    router.query.callbackUrl
                        ? `?callbackUrl=${router.query.callbackUrl}`
                        : ""
                }`,
            );
        } catch (error) {
            console.error(error);
        }
    }

    return (
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
                            helperText={errors.userId?.message}
                        />
                        <TextField
                            {...register('userId')}
                            id="userId"
                            label="ユーザーID"
                            type="text"
                            variant="standard"
                            error={'userId' in errors}
                            helperText={errors.userId?.message}
                        />
                        <TextField
                            {...register('password')}
                            id="password"
                            label="パスワード"
                            type="password"
                            variant="standard"
                            error={'password' in errors}
                            helperText={errors.password?.message}
                        />
                        <Button href="/">トップページに戻る</Button>
                        <Button href="/auth/login">ログイン</Button>
                        <Button onClick={handleSubmit(onSubmit)}>{t.g.submit}</Button>
                    </Box>
                </AuthWindow>
            </Grid>
        </Box>
    );
}
