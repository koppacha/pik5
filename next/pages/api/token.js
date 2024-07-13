import jwt from 'jsonwebtoken';

export default function handler(req, res) {
    if (req.method === 'GET') {
        const token = jwt.sign(
            { purpose: 'purge-cache' },
            process.env.API_SECRET,
            { expiresIn: '5m' }
        );
        res.status(200).json({ token });
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
