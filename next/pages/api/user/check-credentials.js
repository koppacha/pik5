import prisma from "../../../lib/prisma"
import { logger } from "../../../lib/logger"
import { omit } from "lodash"
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
function hashPassword(password){
    const saltRounds = 10
    if(password) {
        return bcrypt.hashSync(password, saltRounds)
    } else {
        return null
    }
}

async function handlePOST(res, req) {

    try{
        // Postmanで送信する際はbodyではなくqueryを参照するっぽい
        const {userId, password} = req.body
        const user = await prisma.user.findFirst({
            where: {
                userId: userId
            },
        });
        if (user && bcrypt.compareSync(password, user.password)) {
            res.json(omit(user, "password"))
        } else {
            res.status(400).end("Incorrect password")
        }
    } catch (e){
        logger.debug(e)
        res.status(400).end("DB ERROR")
    }
}
