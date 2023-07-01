import React, {useState} from "react";
import {signIn, useSession} from "next-auth/react";
import {useRouter} from "next/router";
import {useForm} from "react-hook-form";
import {logger} from "../../lib/logger";
import {Box, FormControl, Grid, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import {useLocale} from "../../lib/pik5";
import TextField from "@mui/material/TextField";
import {yupResolver} from "@hookform/resolvers/yup";
import * as yup from "yup";
import {AuthWindow} from "../../styles/pik5.css";
import Image from "next/image";

export default function Login(){

    const {t} = useLocale()

    const { data: session, status } = useSession();
    const router = useRouter();

    const schema = yup.object({
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
        <Box>
            <Box style={{zIndex:"-1",position:"fixed",top:"0",left:"0",width:"100%",height:"100vh"}}>
                <Image src="/img/bg29.jpg" fill style={{objectFit:"cover",overflow:"hidden"}} alt="background"/>
            </Box>
            <Grid container justifyContent="center" alignItems="center" style={{height:"100vh"}}>
                <AuthWindow item>
                    <Typography variant="strong">ログイン</Typography><br/>
                    <FormControl>
                        <TextField
                            {...register('userId')}
                            id="userId"
                            label="ユーザー名"
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
                        <Button onClick={handleSubmit(onSubmit)}>{t.g.submit}</Button><br/>
                        <Button href="/">トップページへ</Button>
                        <Button href="/auth/register">はじめての方はこちら</Button>
                    </FormControl>
                </AuthWindow>
            </Grid>
        </Box>
    )
}