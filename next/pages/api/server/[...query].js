
// Next.jsのサーバーを経由してバックエンドにクエリを渡す
import {logger} from "../../../lib/logger";

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
            logger.debug(req.body)
            res.status(200).json({data})
        } catch (e) {
            logger.debug(e)
            res.status(404).end()
        }
    } else {
        try {
            const query = req.query.query.join("/")
            const get = await fetch(`http://laravel:8000/api/${query}`)
            const data = await get.json()
            res.status(200).json({data})
        } catch (e) {
            logger.debug(e)
            res.status(404).end()
        }
    }
}
