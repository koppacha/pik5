import {defineEventHandler} from "h3";

let url: string = 'http://localhost:8000/api/product'

export default defineEventHandler(async (event) => {

    let data: unknown;

    data = "aaa";

    await $fetch(url, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip',
            'Accept-Charset': 'utf-8',
            'Content-Encoding': 'gzip',
        }
    }).then((response) => {
        data = response
    })

    return data;
})