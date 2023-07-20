import {logger} from "../../../lib/logger";
import * as fs from "fs";
import axios from "../../../lib/axios";

const formidable = require("formidable")

const axiosWrapper = () => {
    return {
        postFormData: (formData) => axios.post('/record', formData),
    }
}

const formatPostData = (fields) => {
    const formattedData = {}
    Object.entries(fields).forEach(([key, value]) => {
        formattedData[key] = value
    })
    return formattedData
}

const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm()
        form.parse(req, (err, fields, files) => {
            if (err) {
                logger(err)
                reject(err)
            } else {
                resolve({fields, files})
            }
        })
    })
}
export default async (req, res) => {
    const aw = axiosWrapper()
    const {files, fields} = await parseForm(req)
    const formData = new FormData()
    const param = formatPostData(fields)
    Object.entries(param).forEach(([key, value]) => {
        formData.append(key, value)
    })
    const f = files['file']
    if(f){
        const ff = fs.readFileSync(f['filepath'])
        formData.append('file', ff, f['originalFilename'])
    }
    await aw.postFormData(formData)
    res.status(200).json(null)
}