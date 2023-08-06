import http from 'http';

export default async function handler(req, res) {
    try {
        const filePath = `http://laravel:8000/api/img/${req.query.file}`
        http.get(filePath, (response) => {
            const contentType = response.headers['content-type']
            res.setHeader('Content-Type', contentType)
            response.pipe(res)
        }).on('error', (err) => {
            console.error('Error fetching image:', err)
            res.status(500).json("error:" + err)
        });

    } catch (e) {
        console.error('Error in handler:', e)
        res.status(500).json("error:" + e)
    }
}