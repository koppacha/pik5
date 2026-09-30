import {stagingAccessCookie, stagingAccessEnabled, stagingAccessReady, STAGING_CLOSE_AT, validStagingPassword} from "../../lib/tricks/stagingAccess"

export default function handler(req, res) {
    res.setHeader("Cache-Control", "no-store")
    if (!stagingAccessEnabled() || Date.now() >= STAGING_CLOSE_AT) return res.status(404).json({message: "Not found"})
    if (!stagingAccessReady()) return res.status(503).json({message: "大会の公開設定が未完了です"})
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST")
        return res.status(405).json({message: "Method not allowed"})
    }
    const origin = req.headers.origin
    const host = req.headers["x-forwarded-host"] || req.headers.host
    const protocol = req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http")
    let publicOrigin = null
    try {
        publicOrigin = new URL(process.env.NEXTAUTH_URL).origin
    } catch {
        // The request host remains the only accepted origin if no public URL is configured.
    }
    if (!host || (origin !== `${protocol}://${host}` && origin !== publicOrigin)
        || req.headers["sec-fetch-site"] === "cross-site") {
        return res.status(403).json({message: "Forbidden"})
    }
    if (!validStagingPassword(req.body?.password)) return res.status(401).json({message: "パスワードが違います"})
    res.setHeader("Set-Cookie", stagingAccessCookie())
    return res.status(200).json({ok: true})
}
