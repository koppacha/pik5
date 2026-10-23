// Credentials authentication is owned by NextAuth; do not expose a second password oracle.
export default function handler(req, res) {
    return res.status(410).json({message: 'この認証APIは廃止されました'})
}
