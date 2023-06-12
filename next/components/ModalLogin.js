import Dialog from "@mui/material/Dialog";
import {Box, Button} from "@mui/material";
import Image from "next/image";
import React, {useEffect, useState} from "react";
import Link from "next/link";
import InputError from "./InputError";
import Input from "./Input";
import {useRouter} from "next/router";
import {useAuth} from "../hooks/auth";
import Label from "./Label";
import AuthSessionStatus from "./AuthSessionStatus";

export default function ModalLogin({open, handleClose}) {

    const router = useRouter()

    const { login } = useAuth({
        middleware: 'guest',
        redirectIfAuthenticated: '/',
    })
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [shouldRemember, setShouldRemember] = useState(false)
    const [errors, setErrors] = useState([])
    const [status, setStatus] = useState(null)

    useEffect(() => {
        if (router.query.reset?.length > 0 && errors.length === 0) {
            setStatus(atob(router.query.reset))
        } else {
            setStatus(null)
        }
    })

    const submitForm = async event => {
        event.preventDefault()

        await login({
            email,
            password,
            remember: shouldRemember,
            setErrors,
            setStatus,
        })
    }

    return (
        <>
            <Dialog open={open} onClose={handleClose}>
                <Box style={{width:"100%",height:"100%"}}>
                    <AuthSessionStatus className="mb-4" status={status} />
                    <form onSubmit={submitForm}>
                        {/* Email Address */}
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                className="block mt-1 w-full"
                                onChange={event => setEmail(event.target.value)}
                                required
                                autoFocus
                            />

                            <InputError messages={errors.email} className="mt-2" />
                        </div>

                        {/* Password */}
                        <div className="mt-4">
                            <Label htmlFor="password">Password</Label>

                            <Input
                                id="password"
                                type="password"
                                value={password}
                                className="block mt-1 w-full"
                                onChange={event => setPassword(event.target.value)}
                                required
                                autoComplete="current-password"
                            />

                            <InputError
                                messages={errors.password}
                                className="mt-2"
                            />
                        </div>

                        {/* Remember Me */}
                        <div className="block mt-4">
                            <label
                                htmlFor="remember_me"
                                className="inline-flex items-center">
                                <input
                                    id="remember_me"
                                    type="checkbox"
                                    name="remember"
                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    onChange={event =>
                                        setShouldRemember(event.target.checked)
                                    }
                                />

                                <span className="ml-2 text-sm text-gray-600">
                                Remember me
                            </span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end mt-4">
                            <Link
                                href="/forgot-password">
                                パスワードを忘れた
                            </Link>
                            <Button>Login</Button>
                        </div>
                    </form>
                </Box>
            </Dialog>
        </>
    );
}