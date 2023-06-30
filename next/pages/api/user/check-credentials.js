import prisma from "../../../lib/prisma"
import { logger } from "../../../lib/logger"
import sha256 from "crypto-js/sha256"
import { omit } from "lodash"

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
    return sha256(password).toString();
};

// POST /api/user
async function handlePOST(res, req) {

    const user = await prisma.user.findUnique({
        where: { userId: req.body.userId },
        select: {
            id: true,
            name: true,
            userId: true,
            password: true,
        },
    });

    if (user && user.password === hashPassword(req.body.password)) {
        logger.debug("password correct")
        res.json(omit(user, "password"))
    } else {
        logger.debug("incorrect credentials")
        res.status(400).end("Invalid credentials")
    }
}
