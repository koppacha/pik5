import prisma from "../../../lib/prisma"
import { logger } from "../../../lib/logger"
import sha256 from "crypto-js/sha256"
import bcrypt from "bcrypt";
import {invalidateUsersCache} from "../../../lib/usersCache"
import {isValidPassword} from "../../../lib/passwordPolicy"

export default async function handle(req, res) {
    if (req.method === "POST") {
        await handlePOST(res, req);
    } else {
        return res.status(400).json({error: "不正なリクエストです。"})
    }
}

const hashPassword = (password) => {
    const saltRounds = 10
    return bcrypt.hashSync(password, saltRounds)
};

async function handlePOST(res, req) {

    const name = String(req.body.name || "").trim()
    const userId = String(req.body.userId || "").trim()
    const password = String(req.body.password || "")

    if(!name) return res.status(400).json({error: "ハンドルネームが入力されていません。"})
    if(name.length > 32 || !/^[^<>\\"']*$/.test(name)){
        return res.status(400).json({error: "ハンドルネームの形式が正しくありません。"})
    }
    if(!userId) return res.status(400).json({error: "ユーザーIDが入力されていません。"})
    if(userId.length < 3) return res.status(400).json({error: "ユーザーIDは3文字以上で入力してください。"})
    if(userId.length > 32 || !/^[\w-]+$/.test(userId)){
        return res.status(400).json({error: "ユーザーIDの形式が正しくありません。"})
    }
    if(!isValidPassword(password)){
        return res.status(400).json({error: "パスワードは8文字以上72文字以下の安全な半角英数記号で入力してください。"})
    }

    const userSearch = await prisma.user.findFirst({
        where: {
            userId
        },
    })
    if(userSearch){
        // ユーザーIDの重複は弾く
        return res.status(400).json({error: "ユーザーIDが重複しています。"})
    } else {
        const user = await prisma.user.create({
            data: {name, userId, password: hashPassword(password)},
        })
        invalidateUsersCache()
        res.status(200).json(user);
    }
}
