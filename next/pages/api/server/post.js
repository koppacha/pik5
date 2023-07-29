/*
 *  バイナリデータを含むPOST専用のAPI
 */
import {logger} from "../../../lib/logger";
const formidable = require("formidable");
import fetch from "node-fetch";
import FormData from "form-data";
import * as fs from "fs";

export const config = {
    api: {
        bodyParser: false,
    },
}
export default async function handler(req, res){
    if(req.method === "POST"){
        const form = new formidable.IncomingForm()
        await form.parse(req, async (err, fields, files) => {
            if (err) {
                res.status(500).json({err: err})
            } else {
                try {
                    // ここでフォームデータをLaravel APIに送信する処理を実行
                    const formData = new FormData()
                    formData.append('stage_id', fields.stage_id[0]);
                    formData.append('rule', fields.rule[0]);
                    formData.append('region', fields.region[0]);
                    formData.append('score', fields.score[0]);
                    formData.append('user_id', fields.user_id[0]);
                    formData.append('console', fields.console[0]);
                    formData.append('video_url', fields.video_url[0]);
                    formData.append('post_comment', fields.post_comment[0]);
                    formData.append('created_at', fields.created_at[0]);

                    logger.debug(files)
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
                    logger.debug(error)
                    return res.status(500).json({error: error});
                }
            }
        })
    } else {
        res.status(405).json({error: "Method not allowed"})
    }
}