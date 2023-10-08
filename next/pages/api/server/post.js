/*
 *  バイナリデータを含むPOST専用のAPI
 */
import {getServerSession} from "next-auth/next";
const formidable = require("formidable");
const parser = require('ua-parser-js');
import fetch from "node-fetch";
import FormData from "form-data";
import * as fs from "fs";
import {authOptions} from "../auth/[...nextauth]";
import {getIpAddress, prismaLogging} from "./[...query]";

export const config = {
    api: {
        bodyParser: false,
    },
}
export default async function handler(req, res){

    const session = await getServerSession(req, res, authOptions)
    if(!session) return res.status(500).json({err: "Session Error"})

    if(req.method === "POST"){
        const form = new formidable.IncomingForm()
        await form.parse(req, async (error, fields, files) => {
            if (error) {
                await prismaLogging(session.user.id, "PostsReqError", error)
                res.status(500).json({err: error})
            } else {
                try {
                    const formData = new FormData()
                    formData.append('stage_id', fields.stage_id[0]);
                    formData.append('rule', fields.rule[0]);
                    formData.append('region', fields.region[0]);
                    formData.append('score', fields.score[0]);
                    formData.append('user_id', fields.user_id[0]);
                    formData.append('console', fields.console[0]);
                    formData.append('video_url', fields.video_url[0]);
                    formData.append('team', 0);
                    formData.append('post_comment', fields.post_comment[0]);
                    formData.append('created_at', fields.created_at[0]);
                    formData.append('user_ip', getIpAddress());
                    formData.append('user_agent', fields.user_agent[0]);

                    // 画像の処理
                    if (files?.file) {
                        const file = files.file[0]
                        const {filepath} = file
                        formData.append('file', fs.createReadStream(filepath));
                    }

                    const response = await fetch("http://laravel:8000/api/record", {
                        method: "POST",
                        body: formData,
                    });
                    // レスポンスをJSONに変換して返す
                    const data = await response.json();
                    res.status(200).json(data);

                } catch (error) {
                    // エラー処理
                    await prismaLogging(session.user.id, "PostsResError", error)
                    return res.status(500).json({errors: error});
                }
            }
        })
    } else {
        res.status(405).json({error: "Method not allowed"})
    }
}