import { getCachedUsersWithRole } from "../../lib/usersCache";

// ユーザー名を取得
export default async function getUserName(req, res) {

    const users = await getCachedUsersWithRole()
    return res.status(200).json(users)
}