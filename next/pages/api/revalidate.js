
export default async function handler(req, res) {
    await res.revalidate("/")
    res.status(200).json({status: "ok"})
}