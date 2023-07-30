import prisma from "../../../lib/prisma"
import { logger } from "../../../lib/logger"
import sha256 from "crypto-js/sha256"
import bcrypt from "bcrypt";

export default async function handle(req, res) {
    if (req.method === "POST") {
        await handlePOST(res, req);
    } else {
        throw new Error(
            `The HTTP ${req.method} method is not supported at this route.`,
        );
    }
}

const hashPassword = (password) => {
    const saltRounds = 10
    return bcrypt.hashSync(password, saltRounds)
};

async function handlePOST(res, req) {

    const userSearch = await prisma.user.findFirst({
        where: {
            userId: req.body.userId
        },
    })
    if(userSearch){
        // ユーザーIDの重複は弾く
        res.status(500).end()

    } else {
        const user = await prisma.user.create({
            data: {...req.body, password: hashPassword(req.body.password)},
        });
        res.status(200).json(user);
    }
}
