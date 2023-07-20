import formidable from "formidable";

export const config = {
    api: {
        bodyParser: false,
    },
}

const forms = async (req, res) => {
    if (req.method !== "POST") return

    const form = formidable({multiples: true, uploadDir: 'http://laravel:8000/api/record'})

    await form.parse(req, async function (err, fields, files) {
        if (err) {
            res.statusCode = 500
            res.json({
                method: req.method,
                error: err
            })
            res.end()
            return
        }
        const file = files.file

    })
}
export default forms