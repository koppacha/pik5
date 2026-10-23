export async function fetcher(url) {
    const response = await fetch(url)
    if (!response.ok) {
        // Nginx errors can be HTML. Keep the HTTP status without parsing or logging the body.
        const error = new Error(`Request failed with status ${response.status}`)
        error.status = response.status
        throw error
    }
    return response.json()
}
