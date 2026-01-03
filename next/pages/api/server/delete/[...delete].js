import fetch from "node-fetch";
import {getServerSession} from "next-auth/next";
import {authOptions} from "../../auth/[...nextauth]";
import {prismaLogging} from "../[...query]";

export default async function handler(req, res){

    const session = await getServerSession(req, res, authOptions)

    if(!session){
        res.status(405).json({error: "ログインしていません。"})
    }

    if(req.method === "GET"){

        const [uniqueId, userId] = req.query.delete
        await prismaLogging(session.user.userId, "delete", uniqueId)

        const del = await fetch(`http://laravel:8000/api/record/${uniqueId}`,
            {method: "DELETE"})

        const data = await del.json()
        res.status(200).json({data})

    } else {
        res.status(405).json({error: "Method not allowed"})
    }
}