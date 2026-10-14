export const fieldDetailModalWidth = 560

export function fieldPanelPosition(anchor = {x: 24, y: 150, width: 295}, side = "right", viewportHeight = 900) {
    return {
        left: side === "left" ? Math.max(24, anchor.x - 28 - fieldDetailModalWidth) : anchor.x + anchor.width + 28,
        top: Math.max(116, Math.min(anchor.y, viewportHeight - 360)),
        transformOrigin: side === "left" ? "100% 50%" : "0 50%",
    }
}
