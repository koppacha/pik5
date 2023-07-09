
// Next.jsのサーバーを経由してバックエンドにクエリを渡す
import {logger} from "../../../lib/logger";

export default async function handle(req, res){

    const query = req.query.query.join("/")

    try {
        const response = await fetch(`http://laravel:8000/api/${query}`)
        const data = await response.json()
        res.status(200).json({ data })
    } catch (e) {
        logger.debug(e)
        res.status(404).end()
    }
}
