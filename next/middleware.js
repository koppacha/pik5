import { NextResponse } from 'next/server';
import {jwtVerify} from "jose";

const secret = new TextEncoder().encode(process.env.API_SECRET)

export async function middleware(request) {

    const {authorization} = request.headers.get('Authorization')
    if (!authorization) {
        return new NextResponse(JSON.stringify({message: 'Unauthorized'}), {status: 401});
    }
    const token = authorization.split(' ')[1];

    try {
        await jwtVerify(token, secret)
        return NextResponse.next(); // トークンが有効なら次の処理に進む
    } catch (err) {
        return new NextResponse(JSON.stringify({message: 'Unauthorized'}), {status: 401});
    }
}

export const config = {
    matcher: '/api/auth-test', // ミドルウェアを適用するパスを指定
};