import NextAuth from 'next-auth'
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "../../../lib/prisma"
import { logger } from "../../../lib/logger"

export const authOptions = {
    adapter: PrismaAdapter(prisma),
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: "/auth/login",
        signOut: "/auth/logout",
    },
    logger: {
        error: (code, metadata) => {
            logger.error(code, metadata);
        },
        warn: (code) => {
            logger.warn(code);
        },
        debug: (code, metadata) => {
            logger.debug(code, metadata);
        },
    },
    session: { strategy: "jwt" },
    providers: [
        CredentialsProvider({
            // The name to display on the sign in form (e.g. "Sign in with...")
            id: "credentials",
            name: "credentials",
            // `credentials` is used to generate a form on the sign in page.
            // You can specify which fields should be submitted, by adding keys to the `credentials` object.
            // e.g. domain, username, password, 2FA token, etc.
            // You can pass any HTML attribute to the <input> tag through the object.
            credentials: {
                name: {label: "Screen Name", type: "text"},
                userId: {label: "User Id", type: "text"},
                password: {label: "Password", type: "password"}
            },
            authorize: async (credentials, req) => {
                const user = await fetch(
                    `http://0.0.0.0:3000/api/user/check-credentials`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            accept: "application/json",
                        },
                        body: Object.entries(credentials)
                            .map((e) => e.join("="))
                            .join("&"),
                    },
                )
                    .then((res) => res.json())
                    .catch((err) => {
                        logger.debug(err)
                        return null;
                    });
                if (user) {
                    return user;
                } else {
                    return null;
                }
            },
        })
    ],
    callbacks: {
        async session({session, token}){
            if(token){
                session.user.id = token.id
            }
            return session
        },
        async jwt({token, user}){
            if(user){
                token.id = user.userId
            }
            return token
        },
    },
}

const authHandler = (req, res) => NextAuth(req, res, authOptions);

export default authHandler;