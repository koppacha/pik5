import NextAuth from 'next-auth'
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "../../../lib/prisma"
import { logger } from "../../../lib/logger"
import bcrypt from "bcrypt"
import { decryptEmail } from '../../../lib/emailCrypto'
import {maskEmailAddress} from "../../../lib/pik5";

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
            authorize: async (credentials) => {
                try {
                    const {userId, password, name} = credentials ?? {}
                    const screenName = (typeof name === 'string') ? name.trim() : ''

                    if(!userId || !password) return null

                    const user = await prisma.user.findFirst({
                        where: {
                            userId: userId,
                            ...(screenName ? {name: screenName} : {}),
                        },
                    })

                    if(!user) return null

                    // ここで入力されたパスワードをDB上のハッシュと比較する（sync は避ける）
                    const ok = await bcrypt.compare(password, user.password)
                    if(ok) return user

                    return null
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
            if(token && session?.user){
                // 互換性維持:
                // - 既存フロントは `session.user.id` を userId(ログインID) として扱っている可能性がある
                // - 新方式では JWT(token) の token.id は DB主キー(id) を保持し、userId は token.userId に保持する

                const userId = token.userId ?? (typeof token.id === 'string' ? token.id : undefined)

                // 既存互換: id / userId にはログインIDを入れる
                if(userId) session.user.id = userId
                if(userId) session.user.userId = userId

                // 新規: DB主キーは dbId として露出（将来的にこちらを参照できる）
                session.user.dbId = token.id

                if(token.role) session.user.role = token.role
                if(token.name) session.user.name = token.name

                // メール認証関連情報
                session.user.hasVerifiedEmail = Boolean(token.hasVerifiedEmail)
                session.user.emailMasked = token.emailMasked ?? null
                session.user.email = token.emailMasked ?? null

                // 互換: session.email を参照する実装があればこちらも埋める
                session.email = token.emailMasked ?? null

                // 画像は未使用
                session.user.image = null
            }
            return session
        },
        async jwt({token, user, trigger, session}){
            // サインイン直後: DB主キー(id)を token.id に載せる（=基準を主キーにする）
            if(user){
                token.id = user.id
                token.userId = user.userId
                token.name = user.name
                token.role = user.role

                // サインイン直後にもメール情報を載せる（次リクエスト待ちにしない）
                if (user.emailVerified && user.email) {
                    token.hasVerifiedEmail = true
                    const plain = decryptEmail(user.email)
                    token.emailMasked = plain ? maskEmailAddress(plain) : null
                } else {
                    token.hasVerifiedEmail = false
                    token.emailMasked = null
                }

                return token
            }

            // 既存JWT互換: 以前は token.id に userId(ログインID) を載せていた可能性がある。
            // 再ログイン不要で移行できるよう、token をその場でマイグレーションする。
            try {
                // legacy 形式: token.userId が無い場合は token.id を userId とみなす
                if(!token.userId && typeof token.id === 'string'){
                    token.userId = token.id
                }

                // DB主キーが未確定の可能性がある場合だけDB参照して補完する
                // - token.id が無い
                // - legacy 形式で token.id === token.userId のまま
                const needsDbHydrate = token.userId && (token.id == null || token.userId === token.id)

                if(needsDbHydrate){
                    const dbUser = await prisma.user.findFirst({
                        where: { userId: token.userId },
                        select: { id: true, userId: true, name: true, role: true, email: true, emailVerified: true },
                    })

                    if (dbUser?.emailVerified && dbUser?.email) {
                        token.hasVerifiedEmail = true
                        const plain = decryptEmail(dbUser.email)
                        token.emailMasked = plain ? maskEmailAddress(plain) : null
                    } else {
                        token.hasVerifiedEmail = false
                        token.emailMasked = null
                    }

                    if(dbUser){
                        token.id = dbUser.id
                        token.userId = dbUser.userId
                        token.name = dbUser.name
                        token.role = dbUser.role
                    }
                }
            } catch (e) {
                // 失敗しても既存セッションを落とさない
            }

            // 通常トークンでもメール情報が未設定なら補完する（DB参照は必要時のみ）
            if (token.hasVerifiedEmail === undefined) {
                try {
                    let u = null

                    // まずはDB主キーで検索（token.id は基本的にDB主キー）
                    if (token.id) {
                        u = await prisma.user.findUnique({
                            where: { id: token.id },
                            select: { email: true, emailVerified: true },
                        })
                    }

                    // 取れなければログインIDで検索
                    if (!u && token.userId) {
                        u = await prisma.user.findFirst({
                            where: { userId: token.userId },
                            select: { email: true, emailVerified: true },
                        })
                    }

                    if (u?.emailVerified && u?.email) {
                        token.hasVerifiedEmail = true
                        const plain = decryptEmail(u.email)
                        token.emailMasked = plain ? maskEmailAddress(plain) : null
                    } else {
                        token.hasVerifiedEmail = false
                        token.emailMasked = null
                    }
                } catch (e) {
                    // メール情報の補完に失敗してもログインは継続させる
                    token.hasVerifiedEmail = false
                    token.emailMasked = null
                }
            }

            // useSession().update() などで session 更新が走った場合に token も追随させる
            if(trigger === 'update' && session){
                // update() の payload 形状が揺れるので両対応
                const s = session.user ?? session

                if(typeof s.name === 'string') token.name = s.name
                if(typeof s.role === 'string') token.role = s.role
                if(typeof s.userId === 'string') token.userId = s.userId
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