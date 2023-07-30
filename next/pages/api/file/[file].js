
export default async function handler(req, res) {
    try {
        const filePath = `http://laravel:8000/api/img/${req.query.file}`
        const response = await fetch(filePath)

        const contentType = response.headers.get('content-type')
        res.setHeader('Content-Type', contentType)

        response.body.pipe(res)

    } catch (e) {
        res.status(500).json("error:" + e)
    }
}