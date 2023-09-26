import prisma from "../../lib/prisma";

// ユーザー名を取得
export default async function getUserName(req, res) {

    const users = await prisma.user.findMany({
        select: [
            "userId", "name", "role"
        ],
    });
    return res.status(200).json(users)
}