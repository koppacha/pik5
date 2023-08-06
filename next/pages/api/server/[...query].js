import {logger} from "../../../lib/logger";
import fetch from "node-fetch";

export default async function handle(req, res){

    if(req.method === "POST") {
        try {
            const query = req.query.query.join("/")
            const post = await fetch(`http://laravel:8000/api/${query}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(req.body)
            })
            const data = await post.json()
            res.status(200).json({data})
        } catch (e) {
            logger.debug(e)
            res.status(404).json(e)
        }
    } else {
        try {
            const query = req.query.query.join("/")

            // URLパラメータが存在する場合の処理 TODO: 汎用性に欠けるのであとで書き直す
            let urlParam
            if(req.query.c){
                urlParam = `?c=${htmlspecialchars(req.query.c)}`
            } else if(req.query.t) {
                urlParam = `?t=${htmlspecialchars(req.query.t)}`
            } else {
                urlParam = ""
            }

            const get = await fetch(`http://laravel:8000/api/${query+urlParam}`)
            const data = await get.json()
            res.status(200).json({data})
        } catch (e) {
            logger.debug(e)
            res.status(404).end()
        }
    }
}

function htmlspecialchars(string) {
    return string.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#039;';
            default:
                return match;
        }
    });
}