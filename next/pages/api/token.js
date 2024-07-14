import {SignJWT} from "jose";

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const secret = new TextEncoder().encode(process.env.API_SECRET)

        const token = await new SignJWT({purpose: 'purge-cache'})
            .setProtectedHeader({alg: 'HS256'})
            .setExpirationTime('5m')
            .sign(secret)
        res.status(200).json({token});
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
