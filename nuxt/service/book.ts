import axios, { AxiosResponse } from "axios";

export interface BookResponse {
    id: number
    title: string
    author: string
}

export interface BookRequest {
    title: string
    author: string
}

export class BookService {
    static async fetchBooks(): Promise<BookResponse[]> {
        const { data } = await axios.get<AxiosResponse<BookResponse[]>>(
            '/api/books'
        )
        return data.data
    }

    static async postBookData(bookRequest: BookRequest) {
        await axios.post('api/books', bookRequest)
    }

    static async fetchBook(bookId: number) {
        const { data } = await axios.get<AxiosResponse<BookResponse>>(
            `/api/books/${bookId}`
        )
        return data.data
    }

    static async putBook(bookId: number, data: BookRequest) {
        await axios.put(`/api/books/${bookId}`, data)
    }

    static async deleteBook(bookId: number) {
        await axios.delete(`/api/books/${bookId}`)
    }
}