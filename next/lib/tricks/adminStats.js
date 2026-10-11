// Creator names are free text; use the same canonical screen names as the UI.
export function withCreatorPopularity(stats, users = []) {
    if (!Array.isArray(stats?.users) || !Array.isArray(stats?.cards)) return stats
    const screenNames = new Map(users.map((user) => [user.userId, user.name]))
    const takenCards = stats.cards.filter((card) => Number(card.stage_id) > 0 && card.taker != null)
    return {
        ...stats,
        users: stats.users.map((user) => {
            const screenName = screenNames.get(user.user_id)
            const popularCreatorIndex = typeof screenName === "string" && screenName !== ""
                ? takenCards.reduce((total, card) => typeof card.creator === "string" && card.creator.includes(screenName)
                    ? total + new Set(card.participants || []).size : total, 0)
                : 0
            return {...user, popular_creator_index: popularCreatorIndex}
        }),
    }
}
