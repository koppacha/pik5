import NextAuth from 'next-auth'
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "../../../lib/prisma"
import { logger } from "../../../lib/logger"
import bcrypt from "bcrypt"

const scopes = ['identify', 'email']

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
    session: {
        strategy: "jwt",
    },
    providers: [
        // DiscordCastomProvider({
        //     id: "discord",
        //     name: "discord",
        //     clientId: process.env.DISCORD_CLIENT_ID,
        //     clientSecret: process.env.DISCORD_CLIENT_SECRET,
        //     redirectUri: 'https://localhost:3005',
        // }),
        // TwitterProvider({
        //     clientId: process.env.TWITTER_CLIENT_ID,
        //     clientSecret: process.env.TWITTER_CLIENT_SECRET
        // }),
        CredentialsProvider({
            // The name to display on the sign-in form (e.g. "Sign in with...")
            id: "credentials",
            name: "credentials",
            // `credentials` is used to generate a form on the sign-in page.
            // You can specify which fields should be submitted, by adding keys to the `credentials` object.
            // e.g. domain, username, password, 2FA token, etc.
            // You can pass any HTML attribute to the <input> tag through the object.
            credentials: {
                name: {label: "Screen Name", type: "text"},
                userId: {label: "User Id", type: "text"},
                password: {label: "Password", type: "password"}
            },
            authorize: async (credentials, req) => {
                try {
                    const {userId, password} = credentials
                    const user = await prisma.user.findFirstOrThrow({
                        where: {
                            userId: userId
                        },
                    })
                    // ここで入力されたパスワードをハッシュ化しDB上のハッシュと比較する
                    if(user && bcrypt.compareSync(password, user.password)){
                        return user
                    } else {
                        return null
                    }
                } catch (e) {
                    return null
                }
                // const user = await fetch(
                //     `auth/user/check-credentials`,
                //     {
                //         method: "POST",
                //         headers: {
                //             "Content-Type": "application/x-www-form-urlencoded",
                //             accept: "application/json",
                //         },
                //         body: Object.entries(credentials)
                //             .map((e) => e.join("="))
                //             .join("&"),
                //     },
                // )
                //     .then((res) => res.json())
                //     .catch((err) => {
                //         logger.debug(err)
                //         return null;
                //     });
                // if (user) {
                //     return user;
                // } else {
                //     return null;
                // }
            },
        })
    ],
    callbacks: {
        async session({session, token}){
            if(token){
                session.user.id = token.id
                session.user.image = null
            }
            return session
        },
        async jwt({token, user}){
            if(user){
                token.id = user.userId
            }
            return token
        },
        // async redirect({ url, baseUrl }) {
        //     // Allows relative callback URLs
        //     if (url.startsWith("/")) return `${baseUrl}${url}`
        //     // Allows callback URLs on the same origin
        //     else if (new URL(url).origin === baseUrl) return url
        //     return baseUrl
        // },
    },
}

const authHandler = (req, res) => NextAuth(req, res, authOptions);

export default authHandler;