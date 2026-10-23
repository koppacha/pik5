// Use the authenticated user-settings API; legacy arbitrary user mutations are retired.
export default function handler(req, res) {
    return res.status(410).json({message: 'このユーザーAPIは廃止されました'})
}
