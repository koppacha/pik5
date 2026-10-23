import formidable from 'formidable'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function getFieldValue(value) {
    if (Array.isArray(value)) return value[0]
    return value
}

export async function parseForm(req) {
    const form = formidable({
        maxFields: 32,
        maxFieldsSize: 64 * 1024,
        maxFiles: 1,
        maxFileSize: MAX_UPLOAD_BYTES,
        maxTotalFileSize: MAX_UPLOAD_BYTES,
        filter: ({mimetype}) => !mimetype || [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
        ].includes(mimetype),
    })
    return new Promise((resolve, reject) => {
        form.parse(req, (error, fields, files) => {
            if (error) {
                reject(error)
                return
            }
            resolve({fields, files})
        })
    })
}
