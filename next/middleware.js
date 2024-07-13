import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request) {
    const { authorization } = request.headers;

    if (!authorization) {
        return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    }

    const token = authorization.split(' ')[1];

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        return NextResponse.next(); // トークンが有効なら次の処理に進む
    } catch (err) {
        return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    }
}

export const config = {
    matcher: '/api/revalidate', // ミドルウェアを適用するパスを指定
};