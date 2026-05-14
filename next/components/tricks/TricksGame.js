import {useEffect, useRef} from "react"
import {
    cardLimitLabel,
    compareTricksFieldCards,
    formatRemaining,
    isTricksCardLimitExpired,
    normalizeTricksState,
    orderTricksHand,
    shortenTricksText,
    tricksActions,
} from "../../lib/tricks"

const CARD_RATIO = 88 / 63
const HAND_CARD_WIDTH = 260
const HAND_CARD_HEIGHT = Math.round(HAND_CARD_WIDTH * CARD_RATIO)
const FIELD_CARD_WIDTH = 260
const FIELD_CARD_HEIGHT = Math.round(FIELD_CARD_WIDTH * CARD_RATIO)
const GAME_FPS = 30
const CARD_BORDER_WIDTH = 8
const FIELD_STACK_OFFSET = 5
const FIELD_MAX_STACK_BACKS = 5
const HAND_AREA_HEIGHT = 420
const HAND_AREA_EXTRA_DROP = 100
const HAND_AREA_DROP = Math.round(HAND_CARD_HEIGHT * 0.3) + HAND_AREA_EXTRA_DROP
const FIELD_START_Y = 164
const HEADER_HEIGHT = 128
const FIELD_COLUMN_GAP = 25
const FIELD_ROW_GAP = FIELD_CARD_HEIGHT + 32
const FIELD_SIDE_MARGIN = 24
const FIELD_DEPTH = 20
const HAND_DEPTH = 120
const DECK_DEPTH = 130
const HEADER_DEPTH = 170
const EFFECT_DEPTH = 240
const SHADE_DEPTH = 280
const HAND_DETAIL_DEPTH = 310
const FIELD_DETAIL_DEPTH = 330
const CARD_EFFECT_SLOW_THRESHOLD = 4
const CARD_EFFECT_SLOW_FACTOR = 1.9
const CARD_FX_FRAME_WIDTH = 260
const CARD_FX_FRAME_HEIGHT = Math.round(CARD_FX_FRAME_WIDTH * CARD_RATIO)
const EPIC_BORDER_FRAMES = 8
const LEGENDARY_BORDER_FRAMES = 10
const EPIC_BORDER_KEY = "tricks-card-border-epic"
const LEGENDARY_BORDER_KEY = "tricks-card-border-legendary"

const rarityColors = {
    1: 0xb8b8b8,
    2: 0xe6e6e6,
    3: 0x4fb3ff,
    4: 0x8be05e,
    5: 0xffd447,
}

const rarityLabels = {
    1: "C1",
    2: "U2",
    3: "R3",
    4: "E4",
    5: "L5",
}
// 16進カラー値をRGB成分へ分解する。
function colorToRgb(color) {
    return {
        r: (color >> 16) & 255,
        g: (color >> 8) & 255,
        b: color & 255,
    }
}
// 2色の中間色を指定比率で算出する。
function interpolateColor(from, to, t) {
    const a = colorToRgb(from)
    const b = colorToRgb(to)

    return (Math.round(a.r + (b.r - a.r) * t) << 16)
        + (Math.round(a.g + (b.g - a.g) * t) << 8)
        + Math.round(a.b + (b.b - a.b) * t)
}
// 複数色をなめらかにつないだ色を算出する。
function gradientColorAt(colors, t) {
    if (colors.length <= 1) return colors[0] || 0xffffff
    const clamped = Math.max(0, Math.min(1, t))
    const scaled = clamped * (colors.length - 1)
    const index = Math.min(colors.length - 2, Math.floor(scaled))

    return interpolateColor(colors[index], colors[index + 1], scaled - index)
}
// カード縁に角丸を維持した疑似グラデーションを描画する。
function drawGradientBorder(graphics, width, height, radius, borderWidth, colors) {
    graphics.fillStyle(colors[0] || 0xffffff, 1)
    graphics.fillRoundedRect(0, 0, width, height, radius)

    const layers = Math.max(3, Math.min(borderWidth, colors.length + 2))
    for (let i = 0; i < layers; i += 1) {
        const inset = i + 0.5
        const color = gradientColorAt(colors, i / Math.max(layers - 1, 1))
        graphics.lineStyle(2, color, 0.9)
        graphics.strokeRoundedRect(inset, inset, width - inset * 2, height - inset * 2, Math.max(2, radius - inset))
    }
}
// カードの枠と内側背景を共通描画する。
function addCardFrame(scene, group, width, height, rarity, options = {}) {
    const border = rarityColors[rarity] || 0xb8b8b8
    const background = scene.add.graphics()
    const radius = 10
    const rareGradient = [0x1a66ff, 0x4fb3ff, 0x8fd7ff]

    if (rarity === 3) {
        drawGradientBorder(background, width, height, radius, CARD_BORDER_WIDTH, rareGradient)
    } else if (rarity === 4) {
        background.fillStyle(rarityColors[4], 0.84)
        background.fillRoundedRect(0, 0, width, height, radius)
    } else if (rarity >= 5) {
        background.fillStyle(rarityColors[5], 0.92)
        background.fillRoundedRect(0, 0, width, height, radius)
    } else {
        background.fillStyle(border, 1)
        background.fillRoundedRect(0, 0, width, height, radius)
    }

    background.fillStyle(0xffffff, 1)
    background.fillRoundedRect(CARD_BORDER_WIDTH, CARD_BORDER_WIDTH, width - CARD_BORDER_WIDTH * 2, height - CARD_BORDER_WIDTH * 2, 8)
    if (options.backgroundInteractive !== false) {
        background.setInteractive(
            new scene.Phaser.Geom.Rectangle(0, 0, width, height),
            scene.Phaser.Geom.Rectangle.Contains
        )
    }
    group.add(background)
    group.cardBackground = background

    return background
}
// エフェクト用Tweenをカードコンテナへ紐づける。
function trackCardEffectTween(group, tween) {
    if (!group.effectTweens) group.effectTweens = []
    group.effectTweens.push(tween)

    return tween
}
// カードコンテナに紐づくエフェクトTweenを停止する。
function stopCardEffects(group) {
    group.effectTweens?.forEach((tween) => tween?.stop?.())
    group.effectTimers?.forEach((timer) => timer?.remove?.())
    group.effectTweens = []
    group.effectTimers = []
}
// エフェクト用TimerEventをカードコンテナへ紐づける。
function trackCardEffectTimer(group, timer) {
    if (!group.effectTimers) group.effectTimers = []
    group.effectTimers.push(timer)

    return timer
}
// spritesheetの縁エフェクトをカードに重ねて再生する。
function addSpriteBorderAnimation(scene, group, key, frameCount, width, height, speedFactor = 1) {
    if (!scene.textures.exists(key)) return false

    const image = scene.add.image(0, 0, key, 0).setOrigin(0, 0)
    image.setDisplaySize(width, height)
    const backgroundIndex = group.getIndex?.(group.cardBackground) ?? -1
    group.addAt(image, Math.max(0, backgroundIndex + 1))

    let frame = 0
    trackCardEffectTimer(group, scene.time.addEvent({
        delay: Math.round(120 * speedFactor),
        loop: true,
        callback: () => {
            frame = (frame + 1) % frameCount
            image.setFrame(frame)
        },
    }))

    return true
}
// エピックカードの流れる縁アニメーションを付与する。
function addEpicBorderAnimation(scene, group, width, height, speedFactor = 1) {
    addSpriteBorderAnimation(scene, group, EPIC_BORDER_KEY, EPIC_BORDER_FRAMES, width, height, speedFactor)
}
// レジェンダリーカードの爆発風グローアニメーションを付与する。
function addLegendaryBorderAnimation(scene, group, width, height, speedFactor = 1) {
    addSpriteBorderAnimation(scene, group, LEGENDARY_BORDER_KEY, LEGENDARY_BORDER_FRAMES, width, height, speedFactor)
}
// スタック数が多いカードのバッジ周辺に抽象的な炎を付与する。
function addStackFlameAnimation(scene, group, x, y, speedFactor = 1) {
    const count = 9
    const radius = 21
    for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2
        const baseX = x + Math.cos(angle) * radius
        const baseY = y + Math.sin(angle) * radius
        const flame = scene.add.ellipse(baseX, baseY, 8 + (i % 3), 14 + (i % 2) * 3, [0xff593d, 0xff9f1a, 0xffdf4d][i % 3], 0.36)
        flame.setOrigin(0.5)
        flame.setRotation(angle)
        group.add(flame)
        trackCardEffectTween(group, scene.tweens.add({
            targets: flame,
            x: x + Math.cos(angle) * (radius + 8),
            y: y + Math.sin(angle) * (radius + 8),
            alpha: 0.08,
            scaleY: 1.32,
            scaleX: 0.72,
            duration: Math.round((520 + i * 45) * speedFactor),
            delay: i * 70,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        }))
    }
}
// レア度とスタック状態に応じたカード演出を付与する。
function addCardEffects(scene, group, card, width, height, options = {}) {
    const rarity = Number(card?.rarity || 1)
    const speedFactor = options.slowEffects ? CARD_EFFECT_SLOW_FACTOR : 1
    if (rarity === 4) addEpicBorderAnimation(scene, group, width, height, speedFactor)
    if (rarity >= 5) addLegendaryBorderAnimation(scene, group, width, height, speedFactor)
    if (options.stackCount >= 6 && options.stackBadge) {
        addStackFlameAnimation(scene, group, options.stackBadge.x, options.stackBadge.y, speedFactor)
    }
}
// カード共通の基本表示コンテナを生成する。
function createCard(scene, card, width, height, nowValue, options = {}) {
    const rarity = Number(card?.rarity || 1)
    const pad = Math.max(12, Math.round(width * 0.08))
    const titleSize = Math.max(16, Math.round(width * 0.09))
    const bodySize = Math.max(12, Math.round(width * 0.052))
    const group = scene.add.container(0, 0)
    addCardFrame(scene, group, width, height, rarity, options)

    group.add(scene.add.text(pad, pad, `#${card.stage_id || card.card_id || card.id}`, {
        fontFamily: "Arial",
        fontSize: `${bodySize}px`,
        color: "#526071",
    }))
    group.add(scene.add.text(pad, pad + bodySize + 8, shortenTricksText(card.title || "Untitled", options.compact ? 18 : 34), {
        fontFamily: "Arial",
        fontSize: `${titleSize}px`,
        color: "#141923",
        fontStyle: "bold",
        wordWrap: {width: width - pad * 2, useAdvancedWrap: true},
        maxLines: 2,
    }))
    group.add(scene.add.text(pad, pad + bodySize + titleSize * 2.35, shortenTricksText(card.rule_name || "", options.compact ? 18 : 30), {
        fontFamily: "Arial",
        fontSize: `${bodySize}px`,
        color: "#4f5a68",
        wordWrap: {width: width - pad * 2, useAdvancedWrap: true},
        maxLines: 2,
    }))
    group.add(scene.add.text(pad, pad + bodySize + titleSize * 3.55, shortenTricksText(card.text || "", options.compact ? 70 : 135), {
        fontFamily: "Arial",
        fontSize: `${bodySize}px`,
        color: "#243044",
        lineSpacing: 3,
        wordWrap: {width: width - pad * 2, useAdvancedWrap: true},
        maxLines: options.compact ? 5 : 8,
    }))
    group.add(scene.add.text(pad, height - pad - bodySize * 2.7, `★${card.difficulty || 1}  R${rarity}`, {
        fontFamily: "Arial",
        fontSize: `${bodySize}px`,
        color: "#202938",
    }))

    if (!options.isHand) {
        group.add(scene.add.text(pad, height - pad - bodySize * 1.35, cardLimitLabel(card, nowValue), {
            fontFamily: "Arial",
            fontSize: `${bodySize}px`,
            color: isTricksCardLimitExpired(card, nowValue) ? "#8a1f1f" : "#9a5f00",
        }))
        if (isTricksCardLimitExpired(card, nowValue)) {
            const overlay = scene.add.graphics()
            overlay.fillStyle(0x111827, 0.68)
            overlay.fillRoundedRect(4, 4, width - 8, height - 8, 8)
            group.add(overlay)
            group.add(scene.add.text(width / 2, height / 2, "回収待ち", {
                fontFamily: "Arial",
                fontSize: "22px",
                color: "#ffffff",
                fontStyle: "bold",
            }).setOrigin(0.5))
        }
    }

    addCardEffects(scene, group, card, width, height, options)
    group.cardData = card
    group.cardSize = {width, height}
    return group
}
// ユーザーIDに対応する表示名を取得する。
function fieldDisplayName(usersById, userId) {
    if (!userId) return "-"
    return usersById?.[userId]?.name || userId
}
// 左右寄せを指定できるPhaserテキストを生成する。
function addAlignedText(scene, x, y, text, style, align = "left") {
    const item = scene.add.text(x, y, text, style)
    if (align === "right") item.setOrigin(1, 0)
    return item
}
// 場札コンテナへテキストを追加する。
function addFieldText(group, scene, x, y, text, style, align = "left") {
    const item = addAlignedText(scene, x, y, text, style, align)
    group.add(item)
    return item
}
// 場札専用レイアウトのカード表示コンテナを生成する。
function createFieldCard(scene, card, nowValue, usersById = {}) {
    const width = FIELD_CARD_WIDTH
    const height = FIELD_CARD_HEIGHT
    const rarity = Number(card?.rarity || 1)
    const border = rarityColors[rarity] || 0xb8b8b8
    const pad = 22
    const group = scene.add.container(0, 0)
    const stackCount = Math.max(Number(card?.stack_count || 1), 1)
    const stackBacks = Math.min(Math.max(stackCount - 1, 0), FIELD_MAX_STACK_BACKS)

    for (let i = stackBacks; i >= 1; i -= 1) {
        const back = scene.add.graphics()
        const offset = i * FIELD_STACK_OFFSET
        back.fillStyle(0xd9dde5, 1)
        back.fillRoundedRect(offset, offset, width, height, 10)
        back.lineStyle(2, 0x8d96a6, 1)
        back.strokeRoundedRect(offset, offset, width, height, 10)
        group.add(back)
    }

    addCardFrame(scene, group, width, height, rarity, {
        backgroundInteractive: false,
    })

    const bodyColor = "#243044"
    const mutedColor = "#677386"
    const rightX = width - pad
    const stageId = card?.stage_id
        ? String(card.stage_id).padStart(5, "0")
        : `card-${card?.card_id || card?.id || ""}`
    const rarityLabel = rarityLabels[rarity] || `R${rarity}`

    addFieldText(group, scene, pad, 22, `#${stageId}`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#6b7280",
    })
    addFieldText(group, scene, rightX, 22, `★${card?.difficulty || 0}  ${rarityLabel}`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: `#${border.toString(16).padStart(6, "0")}`,
        fontStyle: "bold",
    }, "right")

    addFieldText(group, scene, pad, 50, shortenTricksText(card?.title || "Untitled", 20), {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#141923",
        fontStyle: "bold",
        wordWrap: {width: width - pad * 2, useAdvancedWrap: true},
        maxLines: 2,
    })
    addFieldText(group, scene, pad, 82, shortenTricksText(card?.rule_name || "", 24), {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#4f5a68",
        fontStyle: "bold",
        wordWrap: {width: width - pad * 2, useAdvancedWrap: true},
        maxLines: 1,
    })
    addFieldText(group, scene, pad, 110, shortenTricksText(card?.text || "", 115), {
        fontFamily: "Arial",
        fontSize: "14px",
        color: bodyColor,
        lineSpacing: 3,
        wordWrap: {width: width - pad * 2, useAdvancedWrap: true},
        maxLines: 6,
    })

    const line = scene.add.graphics()
    line.lineStyle(1, 0xd5dae2, 1)
    line.lineBetween(pad, height - 96, width - pad, height - 96)
    group.add(line)

    addFieldText(group, scene, pad, height - 82, `✎ ${shortenTricksText(fieldDisplayName(usersById, card?.creator), 12)}`, {
        fontFamily: "Arial",
        fontSize: "13px",
        color: mutedColor,
    })
    addFieldText(group, scene, rightX, height - 82, `✈ ${shortenTricksText(fieldDisplayName(usersById, card?.taker), 12)}`, {
        fontFamily: "Arial",
        fontSize: "13px",
        color: mutedColor,
    }, "right")

    const limitText = addFieldText(group, scene, pad, height - 44, cardLimitLabel(card, nowValue), {
        fontFamily: "Arial",
        fontSize: "14px",
        color: isTricksCardLimitExpired(card, nowValue) ? "#8a1f1f" : "#9a5f00",
        fontStyle: "bold",
    })
    group.limitText = limitText
    addCardEffects(scene, group, card, width, height, {
        slowEffects: scene.slowCardEffects,
        stackCount,
        stackBadge: {x: rightX - 16, y: height - 38},
    })

    const badge = scene.add.graphics()
    badge.fillStyle(0x172033, 1)
    badge.lineStyle(2, 0x6b7280, 1)
    badge.fillCircle(rightX - 16, height - 38, 18)
    badge.strokeCircle(rightX - 16, height - 38, 18)
    group.add(badge)
    group.add(scene.add.text(rightX - 16, height - 48, String(stackCount), {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        fontStyle: "bold",
    }).setOrigin(0.5, 0))

    if (isTricksCardLimitExpired(card, nowValue)) {
        const overlay = scene.add.graphics()
        overlay.fillStyle(0x111827, 0.68)
        overlay.fillRoundedRect(CARD_BORDER_WIDTH, CARD_BORDER_WIDTH, width - CARD_BORDER_WIDTH * 2, height - CARD_BORDER_WIDTH * 2, 8)
        group.add(overlay)
        group.add(scene.add.text(width / 2, height / 2, "回収待ち", {
            fontFamily: "Arial",
            fontSize: "22px",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5))
    }

    group.cardData = card
    group.cardSize = {width, height}
    group.stackBacks = stackBacks
    return group
}
// 山札とドローボタンの表示コンテナを生成する。
function drawDeck(scene, x, y, deckCount, onDraw) {
    const group = scene.add.container(x, y)
    group.setDepth(DECK_DEPTH)
    const graphics = scene.add.graphics()
    const buttonY = HAND_CARD_HEIGHT - 94 - HAND_AREA_DROP
    const buttonLabelY = buttonY + 24
    graphics.fillStyle(0x263247, 1)
    graphics.fillRoundedRect(0, 0, HAND_CARD_WIDTH, HAND_CARD_HEIGHT, 10)
    graphics.fillStyle(0x101620, 1)
    graphics.fillRoundedRect(10, 10, HAND_CARD_WIDTH - 20, HAND_CARD_HEIGHT - 20, 8)
    group.add(graphics)
    group.add(scene.add.text(HAND_CARD_WIDTH / 2, 82, `山札 ${deckCount ?? 0}枚`, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
    }).setOrigin(0.5))

    const button = scene.add.graphics()
    button.fillStyle(0x2556a3, 1)
    button.fillRoundedRect(44, buttonY, HAND_CARD_WIDTH - 88, 48, 8)
    button.lineStyle(1, 0x8db4ff, 1)
    button.strokeRoundedRect(44, buttonY, HAND_CARD_WIDTH - 88, 48, 8)
    button.setInteractive(
        new scene.Phaser.Geom.Rectangle(44, buttonY, HAND_CARD_WIDTH - 88, 48),
        scene.Phaser.Geom.Rectangle.Contains
    )
    button.on("pointerup", () => onDraw?.())
    group.add(button)
    group.add(scene.add.text(HAND_CARD_WIDTH / 2, buttonLabelY, "ドロー", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
    }).setOrigin(0.5))
}
// Phaser内の操作ボタン表示コンテナを生成する。
function drawButton(scene, x, y, label, color, onClick) {
    const group = scene.add.container(x, y)
    const bg = scene.add.graphics()
    bg.fillStyle(color, 1)
    bg.fillRoundedRect(0, 0, 128, 44, 8)
    bg.setInteractive(new scene.Phaser.Geom.Rectangle(0, 0, 128, 44), scene.Phaser.Geom.Rectangle.Contains)
    bg.on("pointerup", () => onClick?.())
    group.add(bg)
    group.add(scene.add.text(64, 22, label, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
    }).setOrigin(0.5))
    return group
}
// 手札カードの扇状配置座標を計算する。
function handLayout(width, height, count, index) {
    const centerX = width / 2 + 120
    const baseY = height - 54 + HAND_AREA_DROP
    const visibleWidth = Math.max(width - 360, HAND_CARD_WIDTH)
    const spacing = count <= 1
        ? 0
        : Math.min(HAND_CARD_WIDTH * 0.62, visibleWidth / Math.max(count - 1, 1))
    const offset = index - (count - 1) / 2
    const angle = Math.max(-18, Math.min(18, offset * 4.5))
    const arc = Math.abs(offset) * 12

    return {
        x: centerX + offset * spacing,
        y: baseY - HAND_CARD_HEIGHT + arc,
        angle,
    }
}
// 手札・山札領域の上端Y座標を返す。
function handAreaTop(height) {
    return height - HAND_AREA_HEIGHT + HAND_AREA_DROP
}
// 場札スクロール領域の下端Y座標を返す。
function fieldViewportBottom(height) {
    return handAreaTop(height) - 24
}
// 画面幅から場札の列数を計算する。
function fieldColumnCount(width) {
    const availableWidth = Math.max(FIELD_CARD_WIDTH, width - FIELD_SIDE_MARGIN * 2)
    return Math.max(1, Math.floor((availableWidth + FIELD_COLUMN_GAP) / (FIELD_CARD_WIDTH + FIELD_COLUMN_GAP)))
}
// 場札領域の最大スクロール量を計算する。
function fieldMaxScroll(width, height, count) {
    if (count <= 0) return 0
    const rows = Math.ceil(count / fieldColumnCount(width))
    const contentBottom = FIELD_START_Y + (rows - 1) * FIELD_ROW_GAP + FIELD_CARD_HEIGHT

    return Math.max(0, contentBottom - fieldViewportBottom(height) + 24)
}
// 場札カードの表示座標を計算する。
function fieldLayout(index, scrollY = 0, width = 0) {
    const columns = fieldColumnCount(width)

    return {
        x: FIELD_SIDE_MARGIN + (index % columns) * (FIELD_CARD_WIDTH + FIELD_COLUMN_GAP),
        y: FIELD_START_Y + Math.floor(index / columns) * FIELD_ROW_GAP - scrollY,
    }
}
// 現在の場札順を最新の場札ID一覧と同期する。
function syncFieldOrder(currentOrder = [], field = []) {
    const ids = field.map((card) => card.id)

    return [
        ...currentOrder.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !currentOrder.includes(id)),
    ]
}
// 場札比較ルールに基づいて目標表示順を算出する。
function targetFieldOrder(field = [], currentOrder = [], nowValue = Date.now()) {
    const cardsById = new Map(field.map((card) => [card.id, card]))
    const stableIndex = new Map(currentOrder.map((id, index) => [id, index]))

    return [...currentOrder].sort((aId, bId) => {
        const result = compareTricksFieldCards(cardsById.get(aId), cardsById.get(bId), nowValue)
        if (result !== 0) return result

        return (stableIndex.get(aId) ?? 0) - (stableIndex.get(bId) ?? 0)
    })
}
// シェーカーソートの隣接交換手順を生成する。
function buildShakerSortSteps(currentOrder = [], nextOrder = []) {
    const rank = new Map(nextOrder.map((id, index) => [id, index]))
    const order = [...currentOrder]
    const steps = []
    let left = 0
    let right = order.length - 1
    let swapped = true

    while (swapped && steps.length < 240) {
        swapped = false
        for (let i = left; i < right; i += 1) {
            if ((rank.get(order[i]) ?? i) > (rank.get(order[i + 1]) ?? i + 1)) {
                const tmp = order[i]
                order[i] = order[i + 1]
                order[i + 1] = tmp
                steps.push([i, i + 1])
                swapped = true
            }
        }
        right -= 1
        if (!swapped) break
        swapped = false
        for (let i = right; i > left; i -= 1) {
            if ((rank.get(order[i - 1]) ?? i - 1) > (rank.get(order[i]) ?? i)) {
                const tmp = order[i - 1]
                order[i - 1] = order[i]
                order[i] = tmp
                steps.push([i - 1, i])
                swapped = true
            }
        }
        left += 1
    }

    return steps
}
// 着地や追加演出用の軽量パーティクルを生成する。
function createParticleBurst(scene, x, y, color = 0xffd447) {
    for (let i = 0; i < 18; i += 1) {
        const dot = scene.add.circle(x, y, 4 + Math.random() * 3, color, 0.95)
        dot.setDepth(EFFECT_DEPTH)
        const angle = (Math.PI * 2 * i) / 18
        const distance = 36 + Math.random() * 44
        scene.tweens.add({
            targets: dot,
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance,
            alpha: 0,
            scale: 0.25,
            duration: 360,
            ease: "Cubic.Out",
            onComplete: () => dot.destroy(),
        })
    }
}
// Phaser SceneからReact側の操作コールバックを呼び出す。
function dispatchAction(callbacks, type, payload) {
    if (type === tricksActions.draw) callbacks.current.onDraw?.(payload)
    if (type === tricksActions.take) callbacks.current.onTake?.(payload)
    if (type === tricksActions.selectField) callbacks.current.onSelectField?.(payload)
}
// Phaserポインタからワールド座標を取得する。
function pointerPosition(pointer) {
    return {
        x: pointer.worldX ?? pointer.x,
        y: pointer.worldY ?? pointer.y,
    }
}
// 画面座標をカードローカル座標へ変換する。
function pointToCardLocal(point, rect) {
    const angle = -(rect.angle || 0) * Math.PI / 180
    const dx = point.x - rect.x
    const dy = point.y - rect.y

    return {
        x: dx * Math.cos(angle) - dy * Math.sin(angle),
        y: dx * Math.sin(angle) + dy * Math.cos(angle),
    }
}
// 回転を考慮したカード矩形ヒットテストを行う。
function hitRotatedCard(point, rect) {
    const local = pointToCardLocal(point, rect)
    const hitPadding = rect.hitPadding || 0

    return local.x >= -hitPadding
        && local.x <= rect.width + hitPadding
        && local.y >= -hitPadding
        && local.y <= rect.height + hitPadding
}
// 角度差を近い回転方向の差分へ正規化する。
function shortestAngleDelta(fromAngle, toAngle) {
    return ((toAngle - fromAngle + 540) % 360) - 180
}
// カードを直線補間で移動し角度も同時に補間する。
function moveCardLinear(scene, group, target, options = {}) {
    group.activeMoveTween?.stop()
    const start = {
        x: group.x,
        y: group.y,
        angle: group.angle || 0,
    }
    const deltaAngle = shortestAngleDelta(start.angle, target.angle || 0)
    const progress = {t: 0}

    group.activeMoveTween = scene.tweens.add({
        targets: progress,
        t: 1,
        duration: options.duration || 180,
        ease: "Back.easeInOut",
        onUpdate: () => {
            group.setPosition(
                start.x + (target.x - start.x) * progress.t,
                start.y + (target.y - start.y) * progress.t
            )
            group.setAngle(start.angle + deltaAngle * progress.t)
        },
        onComplete: () => {
            group.setPosition(target.x, target.y)
            group.setAngle(target.angle || 0)
            group.activeMoveTween = null
            options.onComplete?.()
        },
    })
}
// カードを二次ベジェの弧で移動し角度も同時に補間する。
function moveCardArc(scene, group, target, control, options = {}) {
    group.activeMoveTween?.stop()
    const start = {
        x: group.x,
        y: group.y,
        angle: group.angle || 0,
    }
    const deltaAngle = shortestAngleDelta(start.angle, target.angle || 0)
    const progress = {t: 0}

    group.activeMoveTween = scene.tweens.add({
        targets: progress,
        t: 1,
        duration: options.duration || 460,
        ease: "Back.easeInOut",
        onUpdate: () => {
            const t = progress.t
            const inv = 1 - t
            group.setPosition(
                inv * inv * start.x + 2 * inv * t * control.x + t * t * target.x,
                inv * inv * start.y + 2 * inv * t * control.y + t * t * target.y
            )
            group.setAngle(start.angle + deltaAngle * t)
        },
        onComplete: () => {
            group.setPosition(target.x, target.y)
            group.setAngle(target.angle || 0)
            group.activeMoveTween = null
            options.onComplete?.()
        },
    })
}
// トリックテイキング画面のPhaserキャンバスを管理するReactコンポーネント。
export default function TricksGame({
    state,
    selectedFieldId,
    usersById = {},
    sortTick = 0,
    onDraw,
    onTake,
    onSelectField,
    onFieldSortingChange,
}) {
    const containerRef = useRef(null)
    const gameRef = useRef(null)
    const sceneRef = useRef(null)
    const stateRef = useRef(state)
    const callbacksRef = useRef({onDraw, onTake, onSelectField, onFieldSortingChange})
    const usersByIdRef = useRef(usersById)

    useEffect(() => {
        stateRef.current = state
    }, [state])

    useEffect(() => {
        callbacksRef.current = {onDraw, onTake, onSelectField, onFieldSortingChange}
    }, [onDraw, onFieldSortingChange, onSelectField, onTake])

    useEffect(() => {
        usersByIdRef.current = usersById
    }, [usersById])

    useEffect(() => {
        let disposed = false
        // Phaserを遅延読み込みしてゲームインスタンスを起動する。
        async function boot() {
            const Phaser = await import("phaser")
            if (disposed || !containerRef.current || gameRef.current) return

            class TricksPrototypeScene extends Phaser.Scene {
                // Scene内で使う一時状態を初期化する。
                constructor() {
                    super("TricksPrototypeScene")
                    this.Phaser = Phaser
                    this.handOrder = []
                    this.draggingCard = null
                    this.lastState = null
                    this.previousView = null
                    this.handDetail = null
                    this.fieldDetail = null
                    this.interactiveCards = []
                    this.dragState = null
                    this.handEntries = []
                    this.fieldScrollY = 0
                    this.suppressFieldOpenUntil = 0
                    this.fieldOrder = []
                    this.fieldGroupsById = new Map()
                    this.fieldSorting = false
                    this.fieldSortSteps = []
                    this.pendingState = null
                    this.fieldCountdownEntries = new Map()
                    this.tournamentCountdownText = null
                }
                // カード演出用のspritesheetを読み込む。
                preload() {
                    this.load.spritesheet(EPIC_BORDER_KEY, "/limited/tricks/fx/card-border-epic.png", {
                        frameWidth: CARD_FX_FRAME_WIDTH,
                        frameHeight: CARD_FX_FRAME_HEIGHT,
                    })
                    this.load.spritesheet(LEGENDARY_BORDER_KEY, "/limited/tricks/fx/card-border-legendary.png", {
                        frameWidth: CARD_FX_FRAME_WIDTH,
                        frameHeight: CARD_FX_FRAME_HEIGHT,
                    })
                }
                // Phaser入力イベントを登録し初期描画を行う。
                create() {
                    sceneRef.current = this
                    this.input.on("pointerdown", (pointer) => this.handlePointerDown(pointer))
                    this.input.on("pointermove", (pointer) => this.handlePointerMove(pointer))
                    this.input.on("pointerup", (pointer) => this.handlePointerUp(pointer))
                    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => this.handleWheel(pointer, deltaY))
                    this.time.addEvent({
                        delay: 1000,
                        loop: true,
                        callback: () => this.updateCountdownLabels(),
                    })
                    this.renderState(stateRef.current)
                }
                // 指定座標が手札・山札領域内か判定する。
                isHandAreaPoint(x, y) {
                    return y >= handAreaTop(this.scale.height) && y <= this.scale.height
                }
                // クリック対象にできるカード情報を登録する。
                registerInteractiveCard(entry) {
                    this.interactiveCards.push(entry)
                }
                // カウントダウン表示だけを軽量に更新する。
                updateCountdownLabels() {
                    const nowValue = Date.now()
                    if (this.tournamentCountdownText && this.lastView?.tournament) {
                        const tournament = this.lastView.tournament
                        this.tournamentCountdownText.setText(`残り時間 ${formatRemaining(tournament.end_at, nowValue)}${tournament.debug ? " / DEBUG" : ""}`)
                    }

                    let shouldRefreshExpiredCards = false
                    this.fieldCountdownEntries?.forEach((entry) => {
                        if (!entry.text?.scene) return
                        const expired = isTricksCardLimitExpired(entry.card, nowValue)
                        entry.text.setText(cardLimitLabel(entry.card, nowValue))
                        entry.text.setColor(expired ? "#8a1f1f" : "#9a5f00")
                        if (expired && !entry.expired) {
                            shouldRefreshExpiredCards = true
                        }
                        entry.expired = expired
                    })

                    if (shouldRefreshExpiredCards && !this.handDetail && !this.fieldDetail && !this.fieldSorting) {
                        this.renderState(this.lastState)
                    }
                }
                // Scene上の既存GameObjectとTweenを破棄する。
                clearSceneObjects() {
                    const children = [...this.children.list]
                    children.forEach((child) => {
                        stopCardEffects(child)
                        this.tweens.killTweensOf(child)
                        if (child?.scene) {
                            child.destroy()
                        }
                    })
                }
                // 指定座標で最前面にあるカードを検索する。
                hitTestCards(point, type = null) {
                    return this.interactiveCards
                        .filter((entry) => (!type || entry.type === type) && !entry.disabled && hitRotatedCard(point, entry))
                        .sort((a, b) => {
                            if (a.depth !== b.depth) return b.depth - a.depth
                            return b.order - a.order
                        })[0] || null
                }
                // 場札領域のホイールスクロールを処理する。
                handleWheel(pointer, deltaY) {
                    if (this.handDetail || this.fieldDetail || this.fieldSorting) return
                    const point = pointerPosition(pointer)
                    if (point.y < HEADER_HEIGHT || point.y > fieldViewportBottom(this.scale.height)) return
                    const maxScroll = fieldMaxScroll(this.scale.width, this.scale.height, this.lastView?.field?.length || 0)
                    if (maxScroll <= 0) return
                    const nextScroll = Math.max(0, Math.min(maxScroll, this.fieldScrollY + deltaY))
                    if (nextScroll === this.fieldScrollY) return
                    this.fieldScrollY = nextScroll
                    this.renderState(this.lastState)
                }
                // 手札ドラッグ開始候補のポインタ押下を処理する。
                handlePointerDown(pointer) {
                    if (this.handDetail || this.fieldDetail || this.fieldSorting) return

                    const point = pointerPosition(pointer)
                    const hit = this.hitTestCards(point, "hand")
                    if (!hit) return

                    const local = pointToCardLocal(point, hit)
                    this.dragState = {
                        hit,
                        downX: point.x,
                        downY: point.y,
                        grabX: local.x,
                        grabY: local.y,
                        startX: hit.group.x,
                        startY: hit.group.y,
                        startAngle: hit.group.angle,
                        lifted: false,
                        moved: false,
                    }
                }
                // ドラッグ中カードを前面に持ち上げる。
                liftDraggedCard(drag, point) {
                    if (drag.lifted) return
                    drag.hit.group.activeMoveTween?.stop()
                    drag.hit.group.setDepth(HAND_DETAIL_DEPTH)
                    drag.hit.group.setPosition(point.x - drag.grabX, point.y - drag.grabY)
                    drag.hit.group.setAngle(0)
                    drag.lifted = true
                }
                // 手札ドラッグ中の移動を処理する。
                handlePointerMove(pointer) {
                    const drag = this.dragState
                    if (!drag || this.handDetail || this.fieldDetail) return

                    const point = pointerPosition(pointer)
                    const distance = Math.hypot(point.x - drag.downX, point.y - drag.downY)
                    if (distance <= 8 && !drag.lifted) return
                    drag.moved = true
                    this.liftDraggedCard(drag, point)
                    drag.hit.group.setPosition(point.x - drag.grabX, point.y - drag.grabY)
                }
                // ポインタ解放時のクリック、ドラッグ完了、詳細表示を処理する。
                handlePointerUp(pointer) {
                    const drag = this.dragState
                    if (!drag) {
                        if (this.handDetail || this.fieldDetail || this.fieldSorting) return
                        if (Date.now() < this.suppressFieldOpenUntil) return
                        const point = pointerPosition(pointer)
                        if (this.isHandAreaPoint(point.x, point.y)) return
                        const fieldHit = this.hitTestCards(point, "field")
                        if (fieldHit) {
                            this.openFieldDetail(fieldHit)
                        }
                        return
                    }
                    if (this.handDetail || this.fieldDetail || this.fieldSorting) return

                    this.dragState = null
                    const point = pointerPosition(pointer)
                    const moved = Math.hypot(point.x - drag.downX, point.y - drag.downY)
                    if (drag.moved || moved > 8) {
                        this.liftDraggedCard(drag, point)
                        if (!this.isHandAreaPoint(point.x, point.y)) {
                            this.openHandDetail(drag.hit.card, drag.hit.group, {
                                startX: drag.startX,
                                startY: drag.startY,
                                startAngle: drag.startAngle,
                            })
                            return
                        }
                        this.reorderHand(drag.hit.card.id, point.x)
                        const nextHand = orderTricksHand(this.lastState?.hand || [], this.handOrder).hand
                        const nextIndex = nextHand.findIndex((item) => item.id === drag.hit.card.id)
                        const target = handLayout(this.scale.width, this.scale.height, nextHand.length, nextIndex)
                        moveCardLinear(this, drag.hit.group, target, {
                            duration: 170,
                            onComplete: () => this.renderState(this.lastState),
                        })
                        return
                    }

                    this.openHandDetail(drag.hit.card, drag.hit.group)
                }
                // 手札詳細表示へカードを移動し操作ボタンを表示する。
                openHandDetail(card, group, restorePosition = null) {
                    if (this.handDetail) return

                    const width = this.scale.width
                    const targetX = width / 2 - HAND_CARD_WIDTH / 2 - 70
                    const targetY = 132
                    const startX = restorePosition?.startX ?? group.x
                    const startY = restorePosition?.startY ?? group.y
                    const startAngle = restorePosition?.startAngle ?? group.angle

                    const shade = this.add.rectangle(0, 0, width, this.scale.height, 0x03060c, 0.54).setOrigin(0, 0)
                    shade.setDepth(SHADE_DEPTH)
                    shade.setInteractive()

                    const takeButton = drawButton(this, targetX + HAND_CARD_WIDTH - 130, targetY + 78, "場に出す", 0x1f7a43, () => {
                        this.animateTakeToField(card, group)
                    })
                    const cancelButton = drawButton(this, targetX + HAND_CARD_WIDTH - 130, targetY + 136, "キャンセル", 0x253044, () => this.closeHandDetail(true))
                    takeButton.setDepth(HAND_DETAIL_DEPTH - 2)
                    cancelButton.setDepth(HAND_DETAIL_DEPTH - 2)
                    takeButton.setAlpha(0)
                    cancelButton.setAlpha(0)

                    this.handDetail = {
                        card,
                        group,
                        shade,
                        takeButton,
                        cancelButton,
                        startX,
                        startY,
                        startAngle,
                    }

                    shade.on("pointerup", () => this.closeHandDetail(true))
                    group.disableInteractive()
                    group.setDepth(HAND_DETAIL_DEPTH)
                    group.setAngle(0)

                    moveCardLinear(this, group, {
                        x: targetX,
                        y: targetY,
                        angle: 0,
                    }, {
                        duration: 160,
                        onComplete: () => {
                            this.tweens.add({
                                targets: takeButton,
                                x: targetX + HAND_CARD_WIDTH + 14,
                                alpha: 1,
                                duration: 130,
                                ease: "Back.easeInOut",
                            })
                            this.tweens.add({
                                targets: cancelButton,
                                x: targetX + HAND_CARD_WIDTH + 14,
                                alpha: 1,
                                duration: 130,
                                delay: 35,
                                ease: "Back.easeInOut",
                            })
                        },
                    })
                }
                // 手札から場札へ出す集合演出と放物線移動を実行する。
                animateTakeToField(card, group) {
                    const detail = this.handDetail
                    if (!detail) return

                    detail.takeButton.disableInteractive?.()
                    detail.cancelButton.disableInteractive?.()

                    const fieldCount = Math.min((this.lastView?.field || []).length, 15)
                    const target = fieldLayout(fieldCount, this.fieldScrollY, this.scale.width)
                    const targetX = target.x
                    const targetY = target.y
                    const targetAngle = 0
                    const others = (this.handEntries || []).filter((entry) => entry.card.id !== card.id)
                    let pending = others.length
                    const afterGather = () => {
                        const control = {
                            x: (group.x + targetX) / 2,
                            y: Math.min(group.y, targetY) - 260,
                        }
                        others.forEach((entry) => {
                            this.tweens.add({
                                targets: entry.group,
                                alpha: 0,
                                duration: 120,
                                ease: "Back.easeInOut",
                            })
                        })
                        moveCardArc(this, group, {
                            x: targetX,
                            y: targetY,
                            angle: targetAngle,
                        }, control, {
                            duration: 520,
                            onComplete: () => {
                                createParticleBurst(this, targetX + FIELD_CARD_WIDTH / 2, targetY + FIELD_CARD_HEIGHT / 2)
                                this.closeHandDetail(false)
                                dispatchAction(callbacksRef, tricksActions.take, card)
                            },
                        })
                    }

                    if (pending === 0) {
                        afterGather()
                        return
                    }

                    others.forEach((entry, index) => {
                        entry.group.setDepth(HAND_DETAIL_DEPTH - 5 + index)
                        moveCardLinear(this, entry.group, {
                            x: group.x + (index - (others.length - 1) / 2) * 6,
                            y: group.y + 10 + index * 3,
                            angle: (index - (others.length - 1) / 2) * 4,
                        }, {
                            duration: 220,
                            onComplete: () => {
                                pending -= 1
                                if (pending === 0) afterGather()
                            },
                        })
                    })
                }
                // 場札選択処理を詳細表示へ委譲する。
                animateFieldSelect(card, group) {
                    this.openFieldDetail({card, group, x: group.x, y: group.y, width: FIELD_CARD_WIDTH, height: FIELD_CARD_HEIGHT, angle: group.angle})
                }
                // 場札詳細表示を開きReact側へ選択情報を通知する。
                openFieldDetail(hit) {
                    if (this.fieldDetail || this.handDetail || this.fieldSorting || Date.now() < this.suppressFieldOpenUntil) return
                    const centerX = hit.x + hit.width / 2
                    const side = centerX > this.scale.width / 2 ? "left" : "right"
                    const shade = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x03060c, 0.56).setOrigin(0, 0)
                    shade.setDepth(SHADE_DEPTH)
                    shade.setInteractive()
                    shade.on("pointerup", () => dispatchAction(callbacksRef, tricksActions.selectField, null))
                    hit.group.setDepth(FIELD_DETAIL_DEPTH)
                    this.fieldDetail = {
                        card: hit.card,
                        group: hit.group,
                        shade,
                    }
                    dispatchAction(callbacksRef, tricksActions.selectField, {
                        card: hit.card,
                        anchor: {
                            x: hit.x,
                            y: hit.y,
                            width: hit.width,
                            height: hit.height,
                        },
                        side,
                    })
                }
                // 場札詳細表示を閉じてSceneを再描画する。
                closeFieldDetail() {
                    const detail = this.fieldDetail
                    if (!detail) return
                    this.fieldDetail = null
                    this.suppressFieldOpenUntil = Date.now() + 180
                    detail.shade?.destroy()
                    this.renderState(this.lastState)
                }
                // 手札詳細表示を閉じ、必要に応じて元の位置へ戻す。
                closeHandDetail(restore) {
                    const detail = this.handDetail
                    if (!detail) return
                    this.handDetail = null

                    detail.shade.destroy()
                    detail.takeButton.destroy()
                    detail.cancelButton.destroy()

                    if (!restore) {
                        return
                    }

                    moveCardLinear(this, detail.group, {
                        x: detail.startX,
                        y: detail.startY,
                        angle: detail.startAngle,
                    }, {
                        duration: 170,
                        onComplete: () => this.renderState(this.lastState),
                    })
                }
                // ドラッグ後の手札表示順を更新する。
                reorderHand(cardId, pointerX) {
                    const hand = orderTricksHand(this.lastState?.hand || [], this.handOrder).hand
                    const without = hand.filter((card) => card.id !== cardId)
                    const insertAt = without.findIndex((card, index) => {
                        const pos = handLayout(this.scale.width, this.scale.height, without.length, index)
                        return pointerX < pos.x
                    })
                    const next = without.map((card) => card.id)
                    next.splice(insertAt < 0 ? next.length : insertAt, 0, cardId)
                    this.handOrder = next
                }
                // 場札の目標順を確認し必要ならソート演出を開始する。
                checkFieldSort() {
                    if (this.fieldSorting || this.handDetail || this.fieldDetail || !this.lastView?.field) return false
                    this.fieldOrder = syncFieldOrder(this.fieldOrder, this.lastView.field)
                    const nextOrder = targetFieldOrder(this.lastView.field, this.fieldOrder, Date.now())
                    if (nextOrder.length !== this.fieldOrder.length) return false
                    if (nextOrder.every((id, index) => id === this.fieldOrder[index])) return false
                    const steps = buildShakerSortSteps(this.fieldOrder, nextOrder)
                    if (steps.length === 0) {
                        this.fieldOrder = nextOrder
                        this.renderState(this.lastState)
                        return false
                    }
                    this.startFieldSort(steps)
                    return true
                }
                // 場札のシェーカーソート演出を開始する。
                startFieldSort(steps) {
                    this.fieldSorting = true
                    this.fieldSortSteps = [...steps]
                    this.interactiveCards = this.interactiveCards.filter((entry) => entry.type !== "field")
                    callbacksRef.current.onFieldSortingChange?.(true)
                    this.runNextFieldSortStep()
                }
                // シェーカーソートの次の隣接交換Tweenを実行する。
                runNextFieldSortStep() {
                    const step = this.fieldSortSteps.shift()
                    if (!step) {
                        this.fieldSorting = false
                        callbacksRef.current.onFieldSortingChange?.(false)
                        const nextState = this.pendingState || this.lastState
                        this.pendingState = null
                        this.renderState(nextState)
                        return
                    }

                    const [leftIndex, rightIndex] = step
                    const leftId = this.fieldOrder[leftIndex]
                    const rightId = this.fieldOrder[rightIndex]
                    const leftGroup = this.fieldGroupsById.get(leftId)
                    const rightGroup = this.fieldGroupsById.get(rightId)
                    const leftTarget = fieldLayout(leftIndex, this.fieldScrollY, this.scale.width)
                    const rightTarget = fieldLayout(rightIndex, this.fieldScrollY, this.scale.width)
                    const finishSwap = () => {
                        const tmp = this.fieldOrder[leftIndex]
                        this.fieldOrder[leftIndex] = this.fieldOrder[rightIndex]
                        this.fieldOrder[rightIndex] = tmp
                        this.runNextFieldSortStep()
                    }

                    if (!leftGroup || !rightGroup) {
                        finishSwap()
                        return
                    }

                    let completed = 0
                    const onComplete = () => {
                        completed += 1
                        if (completed === 2) finishSwap()
                    }
                    leftGroup.setDepth(EFFECT_DEPTH)
                    rightGroup.setDepth(EFFECT_DEPTH + 1)
                    moveCardLinear(this, leftGroup, {
                        x: rightTarget.x,
                        y: rightTarget.y,
                        angle: 0,
                    }, {
                        duration: 220,
                        onComplete,
                    })
                    moveCardLinear(this, rightGroup, {
                        x: leftTarget.x,
                        y: leftTarget.y,
                        angle: 0,
                    }, {
                        duration: 220,
                        onComplete,
                    })
                }
                // API状態をPhaser表示へ反映する。
                renderState(nextState) {
                    if (this.handDetail) return
                    if (this.fieldSorting) {
                        this.pendingState = nextState
                        return
                    }
                    if (this.fieldDetail) {
                        this.lastState = nextState
                        return
                    }
                    this.lastState = nextState
                    const previousView = this.lastView
                    const view = normalizeTricksState(nextState, {handOrder: this.handOrder})
                    this.handOrder = view.handOrder
                    this.fieldOrder = syncFieldOrder(this.fieldOrder, view.field)
                    this.lastView = view
                    const width = this.scale.width
                    const height = this.scale.height
                    this.fieldScrollY = Math.max(0, Math.min(
                        this.fieldScrollY,
                        fieldMaxScroll(width, height, view.field?.length || 0)
                    ))
                    this.interactiveCards = []
                    this.dragState = null
                    this.handEntries = []
                    this.fieldGroupsById = new Map()
                    this.fieldCountdownEntries = new Map()
                    this.tournamentCountdownText = null
                    this.clearSceneObjects()
                    const nowValue = Date.now()
                    const tournament = view.tournament
                    const field = view.field
                    const hand = view.hand

                    this.add.rectangle(0, 0, width, height, 0x0c1016, 1).setOrigin(0, 0).setDepth(0)
                    this.add.rectangle(0, 0, width, HEADER_HEIGHT, 0x141b26, 0.82).setOrigin(0, 0).setDepth(HEADER_DEPTH)
                    this.add.rectangle(0, handAreaTop(height), width, HAND_AREA_HEIGHT, 0x121821, 0.58).setOrigin(0, 0).setDepth(HAND_DEPTH - 10)

                    this.add.text(24, 38, tournament.title || "第19回期間限定ランキング", {
                        fontFamily: "Arial",
                        fontSize: "24px",
                        color: "#ffffff",
                        fontStyle: "bold",
                    }).setDepth(HEADER_DEPTH + 1)
                    this.add.text(24, 72, tournament.subtitle || "トリックテイキング制", {
                        fontFamily: "Arial",
                        fontSize: "15px",
                        color: "#b7c1d8",
                    }).setDepth(HEADER_DEPTH + 1)
                    this.tournamentCountdownText = this.add.text(24, 96, `残り時間 ${formatRemaining(tournament.end_at, nowValue)}${tournament.debug ? " / DEBUG" : ""}`, {
                        fontFamily: "Arial",
                        fontSize: "14px",
                        color: tournament.debug ? "#88f0b0" : "#ffcf6e",
                    }).setDepth(HEADER_DEPTH + 1)

                    if (field.length === 0) {
                        this.add.text(24, FIELD_START_Y, "場札はまだありません", {
                            fontFamily: "Arial",
                            fontSize: "14px",
                            color: "#778399",
                        }).setDepth(FIELD_DEPTH + 1)
                    }
                    const fieldById = new Map(field.map((card) => [card.id, card]))
                    const orderedField = this.fieldOrder
                        .map((id) => fieldById.get(id))
                        .filter(Boolean)
                    const visibleField = orderedField.map((card, index) => ({
                        card,
                        index,
                        layout: fieldLayout(index, this.fieldScrollY, width),
                    })).filter((entry) => (
                        entry.layout.y + FIELD_CARD_HEIGHT >= HEADER_HEIGHT
                        && entry.layout.y <= fieldViewportBottom(height) + 48
                    ))
                    const animatedVisibleCount = visibleField.filter((entry) => Number(entry.card?.rarity || 1) >= 4).length
                        + hand.filter((card) => Number(card?.rarity || 1) >= 4).length
                    this.slowCardEffects = animatedVisibleCount >= CARD_EFFECT_SLOW_THRESHOLD
                    visibleField.forEach(({card, index, layout}) => {
                        const {x, y} = layout
                        const group = createFieldCard(this, card, nowValue, usersByIdRef.current)
                        const angle = 0
                        group.setPosition(x, y)
                        group.setAngle(angle)
                        group.setDepth(FIELD_DEPTH + Math.min(index, HAND_DEPTH - FIELD_DEPTH - 20))
                        this.fieldGroupsById.set(card.id, group)
                        if (group.limitText) {
                            this.fieldCountdownEntries.set(card.id, {
                                card,
                                text: group.limitText,
                                expired: isTricksCardLimitExpired(card, nowValue),
                            })
                        }
                        this.registerInteractiveCard({
                            type: "field",
                            card,
                            group,
                            x,
                            y,
                            width: FIELD_CARD_WIDTH,
                            height: FIELD_CARD_HEIGHT,
                            angle,
                            hitPadding: 24,
                            depth: group.depth,
                            order: index,
                            disabled: isTricksCardLimitExpired(card, nowValue),
                        })
                    })

                    drawDeck(this, 24, height - HAND_CARD_HEIGHT - 28 + HAND_AREA_DROP, view.deckCount, () => dispatchAction(callbacksRef, tricksActions.draw))

                    hand.forEach((card, index, list) => {
                        const pos = handLayout(width, height, list.length, index)
                        const group = createCard(this, card, HAND_CARD_WIDTH, HAND_CARD_HEIGHT, nowValue, {
                            isHand: true,
                            compact: true,
                            backgroundInteractive: false,
                            slowEffects: this.slowCardEffects,
                        })
                        group.setPosition(pos.x, pos.y)
                        group.setAngle(pos.angle)
                        group.setDepth(HAND_DEPTH + index)
                        group.homePosition = pos
                        this.handEntries.push({card, group})
                        this.registerInteractiveCard({
                            type: "hand",
                            card,
                            group,
                            x: pos.x,
                            y: pos.y,
                            width: HAND_CARD_WIDTH,
                            height: HAND_CARD_HEIGHT,
                            angle: pos.angle,
                            depth: group.depth,
                            order: index,
                        })
                    })

                    this.playStateTransition(previousView, view)
                }
                // 状態差分に応じた追加演出を再生する。
                playStateTransition(previousView, view) {
                    if (!previousView) return

                    const previousHandIds = new Set((previousView.hand || []).map((card) => card.id))
                    const addedHandCards = (view.hand || []).filter((card) => !previousHandIds.has(card.id))
                    addedHandCards.slice(0, 3).forEach((card) => {
                        const targetIndex = view.hand.findIndex((item) => item.id === card.id)
                        const target = handLayout(this.scale.width, this.scale.height, view.hand.length, targetIndex)
                        const ghost = createCard(this, card, HAND_CARD_WIDTH, HAND_CARD_HEIGHT, Date.now(), {
                            isHand: true,
                            compact: true,
                            backgroundInteractive: false,
                            slowEffects: this.slowCardEffects,
                        })
                        ghost.setDepth(EFFECT_DEPTH)
                        ghost.setAlpha(0.9)
                        ghost.setPosition(24, this.scale.height - HAND_CARD_HEIGHT - 28 + HAND_AREA_DROP)
                        ghost.setScale(0.82)
                        this.tweens.add({
                            targets: ghost,
                            x: target.x,
                            y: target.y,
                            angle: target.angle,
                            scale: 1,
                            alpha: 0,
                            duration: 420,
                            ease: "Cubic.Out",
                            onComplete: () => ghost.destroy(),
                        })
                    })

                    const previousFieldIds = new Set((previousView.field || []).map((card) => card.id))
                    const addedFieldCards = (view.field || []).filter((card) => !previousFieldIds.has(card.id))
                    addedFieldCards.slice(0, 2).forEach((card) => {
                        const index = this.fieldOrder.findIndex((id) => id === card.id)
                        const target = fieldLayout(index, this.fieldScrollY, this.scale.width)
                        createParticleBurst(this, target.x + FIELD_CARD_WIDTH / 2, target.y + FIELD_CARD_HEIGHT / 2, 0x8be05e)
                    })
                }
            }

            gameRef.current = new Phaser.Game({
                type: Phaser.CANVAS,
                parent: containerRef.current,
                backgroundColor: "#0c1016",
                autoFocus: false,
                fps: {
                    target: GAME_FPS,
                    limit: GAME_FPS,
                },
                scale: {
                    mode: Phaser.Scale.RESIZE,
                    width: "100%",
                    height: "100%",
                },
                scene: TricksPrototypeScene,
            })
        }

        boot()

        return () => {
            disposed = true
            sceneRef.current = null
            if (gameRef.current) {
                gameRef.current.destroy(true)
                gameRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (sceneRef.current && state) {
            sceneRef.current.renderState(state)
        }
    }, [state])

    useEffect(() => {
        if (sceneRef.current && sortTick) {
            sceneRef.current.checkFieldSort()
        }
    }, [sortTick])

    useEffect(() => {
        if (!selectedFieldId) {
            sceneRef.current?.closeFieldDetail()
        }
    }, [selectedFieldId])

    return (
        <div
            ref={containerRef}
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
            }}
        />
    )
}
