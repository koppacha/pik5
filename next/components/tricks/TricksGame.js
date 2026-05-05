import {useEffect, useRef} from "react"
import {
    cardLimitLabel,
    formatRemaining,
    isTricksCardLimitExpired,
    normalizeTricksState,
    orderTricksHand,
    shortenTricksText,
    tricksActions,
} from "../../lib/tricks"

const CARD_RATIO = 88 / 63
const HAND_CARD_WIDTH = 240
const HAND_CARD_HEIGHT = Math.round(HAND_CARD_WIDTH * CARD_RATIO)
const FIELD_CARD_WIDTH = 295
const FIELD_CARD_HEIGHT = Math.round(FIELD_CARD_WIDTH * CARD_RATIO)
const FIELD_DETAIL_MODAL_WIDTH = 560
const FIELD_DETAIL_GAP = 28

const rarityColors = {
    1: 0xb8b8b8,
    2: 0xe6e6e6,
    3: 0x4fb3ff,
    4: 0x8be05e,
    5: 0xffd447,
}

function createCard(scene, card, width, height, nowValue, options = {}) {
    const rarity = Number(card?.rarity || 1)
    const border = rarityColors[rarity] || 0xb8b8b8
    const pad = Math.max(12, Math.round(width * 0.08))
    const titleSize = Math.max(16, Math.round(width * 0.09))
    const bodySize = Math.max(12, Math.round(width * 0.052))
    const group = scene.add.container(0, 0)
    const background = scene.add.graphics()

    background.fillStyle(border, 1)
    background.fillRoundedRect(0, 0, width, height, 10)
    background.fillStyle(0xffffff, 1)
    background.fillRoundedRect(4, 4, width - 8, height - 8, 8)
    if (options.backgroundInteractive !== false) {
        background.setInteractive(
            new scene.Phaser.Geom.Rectangle(0, 0, width, height),
            scene.Phaser.Geom.Rectangle.Contains
        )
    }
    group.add(background)

    group.add(scene.add.text(pad, pad, `#${card.stage_id || card.id}`, {
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

    group.cardBackground = background
    group.cardData = card
    group.cardSize = {width, height}
    return group
}

function drawDeck(scene, x, y, deckCount, onDraw) {
    const group = scene.add.container(x, y)
    const graphics = scene.add.graphics()
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
    button.fillRoundedRect(44, HAND_CARD_HEIGHT - 94, HAND_CARD_WIDTH - 88, 48, 8)
    button.lineStyle(1, 0x8db4ff, 1)
    button.strokeRoundedRect(44, HAND_CARD_HEIGHT - 94, HAND_CARD_WIDTH - 88, 48, 8)
    button.setInteractive(
        new scene.Phaser.Geom.Rectangle(44, HAND_CARD_HEIGHT - 94, HAND_CARD_WIDTH - 88, 48),
        scene.Phaser.Geom.Rectangle.Contains
    )
    button.on("pointerup", () => onDraw?.())
    group.add(button)
    group.add(scene.add.text(HAND_CARD_WIDTH / 2, HAND_CARD_HEIGHT - 70, "ドロー", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
    }).setOrigin(0.5))
}

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

function handLayout(width, height, count, index) {
    const centerX = width / 2 + 120
    const baseY = height - 54
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

function fieldLayout(index) {
    return {
        x: 24 + (index % 3) * 320,
        y: 164 + Math.floor(index / 3) * 440,
    }
}

function fieldDetailLayout(width) {
    const totalWidth = FIELD_CARD_WIDTH + FIELD_DETAIL_GAP + FIELD_DETAIL_MODAL_WIDTH

    return {
        x: Math.max(24, (width - totalWidth) / 2),
        y: 150,
    }
}

function createParticleBurst(scene, x, y, color = 0xffd447) {
    for (let i = 0; i < 18; i += 1) {
        const dot = scene.add.circle(x, y, 4 + Math.random() * 3, color, 0.95)
        dot.setDepth(340)
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

function dispatchAction(callbacks, type, payload) {
    if (type === tricksActions.draw) callbacks.current.onDraw?.(payload)
    if (type === tricksActions.take) callbacks.current.onTake?.(payload)
    if (type === tricksActions.selectField) callbacks.current.onSelectField?.(payload)
}

function pointerPosition(pointer) {
    return {
        x: pointer.worldX ?? pointer.x,
        y: pointer.worldY ?? pointer.y,
    }
}

function pointToCardLocal(point, rect) {
    const angle = -(rect.angle || 0) * Math.PI / 180
    const dx = point.x - rect.x
    const dy = point.y - rect.y

    return {
        x: dx * Math.cos(angle) - dy * Math.sin(angle),
        y: dx * Math.sin(angle) + dy * Math.cos(angle),
    }
}

function hitRotatedCard(point, rect) {
    const local = pointToCardLocal(point, rect)

    return local.x >= 0
        && local.x <= rect.width
        && local.y >= 0
        && local.y <= rect.height
}

function shortestAngleDelta(fromAngle, toAngle) {
    return ((toAngle - fromAngle + 540) % 360) - 180
}

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

export default function TricksGame({state, selectedFieldId, onDraw, onTake, onSelectField}) {
    const containerRef = useRef(null)
    const gameRef = useRef(null)
    const sceneRef = useRef(null)
    const callbacksRef = useRef({onDraw, onTake, onSelectField})

    useEffect(() => {
        callbacksRef.current = {onDraw, onTake, onSelectField}
    }, [onDraw, onSelectField, onTake])

    useEffect(() => {
        let disposed = false

        async function boot() {
            const Phaser = await import("phaser")
            if (disposed || !containerRef.current || gameRef.current) return

            class TricksPrototypeScene extends Phaser.Scene {
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
                }

                create() {
                    sceneRef.current = this
                    this.input.on("pointerdown", (pointer) => this.handlePointerDown(pointer))
                    this.input.on("pointermove", (pointer) => this.handlePointerMove(pointer))
                    this.input.on("pointerup", (pointer) => this.handlePointerUp(pointer))
                    this.renderState(null)
                }

                isHandAreaPoint(x, y) {
                    return y >= this.scale.height - 420 && y <= this.scale.height
                }

                registerInteractiveCard(entry) {
                    this.interactiveCards.push(entry)
                }

                hitTestCards(point, type = null) {
                    return this.interactiveCards
                        .filter((entry) => (!type || entry.type === type) && !entry.disabled && hitRotatedCard(point, entry))
                        .sort((a, b) => {
                            if (a.depth !== b.depth) return b.depth - a.depth
                            return b.order - a.order
                        })[0] || null
                }

                handlePointerDown(pointer) {
                    if (this.handDetail || this.fieldDetail) return

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

                liftDraggedCard(drag, point) {
                    if (drag.lifted) return
                    drag.hit.group.activeMoveTween?.stop()
                    drag.hit.group.setDepth(220)
                    drag.hit.group.setPosition(point.x - drag.grabX, point.y - drag.grabY)
                    drag.hit.group.setAngle(0)
                    drag.lifted = true
                }

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

                handlePointerUp(pointer) {
                    const drag = this.dragState
                    if (!drag || this.handDetail || this.fieldDetail) return

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

                openHandDetail(card, group, restorePosition = null) {
                    if (this.handDetail) return

                    const width = this.scale.width
                    const targetX = width / 2 - HAND_CARD_WIDTH / 2 - 70
                    const targetY = 132
                    const startX = restorePosition?.startX ?? group.x
                    const startY = restorePosition?.startY ?? group.y
                    const startAngle = restorePosition?.startAngle ?? group.angle

                    const shade = this.add.rectangle(0, 0, width, this.scale.height, 0x03060c, 0.54).setOrigin(0, 0)
                    shade.setDepth(300)
                    shade.setInteractive()

                    const takeButton = drawButton(this, targetX + HAND_CARD_WIDTH - 130, targetY + 78, "場に出す", 0x1f7a43, () => {
                        this.animateTakeToField(card, group)
                    })
                    const cancelButton = drawButton(this, targetX + HAND_CARD_WIDTH - 130, targetY + 136, "キャンセル", 0x253044, () => this.closeHandDetail(true))
                    takeButton.setDepth(304)
                    cancelButton.setDepth(304)
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
                    group.setDepth(310)
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

                animateTakeToField(card, group) {
                    const detail = this.handDetail
                    if (!detail) return

                    detail.takeButton.disableInteractive?.()
                    detail.cancelButton.disableInteractive?.()

                    const fieldCount = Math.min((this.lastView?.field || []).length, 15)
                    const target = fieldLayout(fieldCount)
                    const targetX = target.x
                    const targetY = target.y
                    const midX = (group.x + targetX) / 2
                    const midY = Math.min(group.y, targetY) - 170

                    this.tweens.add({
                        targets: group,
                        x: midX,
                        y: midY,
                        angle: -8,
                        duration: 170,
                        ease: "Sine.Out",
                        onComplete: () => {
                            this.tweens.add({
                                targets: group,
                                x: targetX,
                                y: targetY,
                                angle: 0,
                                duration: 210,
                                ease: "Sine.In",
                                onComplete: () => {
                                    createParticleBurst(this, targetX + HAND_CARD_WIDTH / 2, targetY + HAND_CARD_HEIGHT / 2)
                                    this.closeHandDetail(false)
                                    dispatchAction(callbacksRef, tricksActions.take, card)
                                },
                            })
                        },
                    })
                }

                animateFieldSelect(card, group) {
                    if (this.fieldDetail) return
                    const startX = group.x
                    const startY = group.y
                    const startAngle = group.angle
                    const target = fieldDetailLayout(this.scale.width)

                    group.disableInteractive()
                    group.cardBackground.disableInteractive()
                    group.setDepth(320)
                    this.fieldDetail = {
                        card,
                        group,
                        startX,
                        startY,
                        startAngle,
                    }
                    this.tweens.add({
                        targets: group,
                        x: target.x,
                        y: target.y,
                        angle: 0,
                        duration: 160,
                        ease: "Cubic.Out",
                        onComplete: () => dispatchAction(callbacksRef, tricksActions.selectField, card),
                    })
                }

                closeFieldDetail() {
                    const detail = this.fieldDetail
                    if (!detail) return
                    this.fieldDetail = null
                    this.tweens.killTweensOf(detail.group)
                    this.tweens.add({
                        targets: detail.group,
                        x: detail.startX,
                        y: detail.startY,
                        angle: detail.startAngle,
                        duration: 150,
                        ease: "Cubic.Out",
                        onComplete: () => this.renderState(this.lastState),
                    })
                }

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

                renderState(nextState) {
                    if (this.handDetail) return
                    if (this.fieldDetail) {
                        this.lastState = nextState
                        return
                    }
                    this.lastState = nextState
                    const previousView = this.lastView
                    const view = normalizeTricksState(nextState, {handOrder: this.handOrder})
                    this.handOrder = view.handOrder
                    this.lastView = view
                    this.interactiveCards = []
                    this.dragState = null
                    this.children.removeAll()
                    const width = this.scale.width
                    const height = this.scale.height
                    const nowValue = Date.now()
                    const tournament = view.tournament
                    const field = view.field
                    const hand = view.hand

                    this.add.rectangle(0, 0, width, height, 0x0c1016, 1).setOrigin(0, 0)
                    this.add.rectangle(0, 0, width, 112, 0x141b26, 0.82).setOrigin(0, 0)
                    this.add.rectangle(0, height - 420, width, 420, 0x121821, 1).setOrigin(0, 0)

                    this.add.text(24, 18, tournament.title || "第19回期間限定ランキング", {
                        fontFamily: "Arial",
                        fontSize: "24px",
                        color: "#ffffff",
                        fontStyle: "bold",
                    })
                    this.add.text(24, 52, tournament.subtitle || "トリックテイキング制", {
                        fontFamily: "Arial",
                        fontSize: "15px",
                        color: "#b7c1d8",
                    })
                    this.add.text(24, 76, `残り時間 ${formatRemaining(tournament.end_at, nowValue)}${tournament.debug ? " / DEBUG" : ""}`, {
                        fontFamily: "Arial",
                        fontSize: "14px",
                        color: tournament.debug ? "#88f0b0" : "#ffcf6e",
                    })

                    this.add.text(24, 132, "場札", {
                        fontFamily: "Arial",
                        fontSize: "18px",
                        color: "#ffffff",
                        fontStyle: "bold",
                    })
                    if (field.length === 0) {
                        this.add.text(24, 168, "場札はまだありません", {
                            fontFamily: "Arial",
                            fontSize: "14px",
                            color: "#778399",
                        })
                    }
                    field.slice(0, 16).forEach((card, index) => {
                        const {x, y} = fieldLayout(index)
                        const group = createCard(this, card, FIELD_CARD_WIDTH, FIELD_CARD_HEIGHT, nowValue, {
                            compact: false,
                        })
                        group.setPosition(x, y)
                        if (!isTricksCardLimitExpired(card, nowValue)) {
                            const hitZone = this.add.zone(x, y, FIELD_CARD_WIDTH, FIELD_CARD_HEIGHT)
                            hitZone.setOrigin(0, 0)
                            hitZone.setDepth(40)
                            hitZone.setInteractive()
                            hitZone.on("pointerup", () => this.animateFieldSelect(card, group))
                        }
                    })

                    drawDeck(this, 24, height - HAND_CARD_HEIGHT - 28, view.deckCount, () => dispatchAction(callbacksRef, tricksActions.draw))

                    hand.forEach((card, index, list) => {
                        const pos = handLayout(width, height, list.length, index)
                        const group = createCard(this, card, HAND_CARD_WIDTH, HAND_CARD_HEIGHT, nowValue, {
                            isHand: true,
                            compact: true,
                            backgroundInteractive: false,
                        })
                        group.setPosition(pos.x, pos.y)
                        group.setAngle(pos.angle)
                        group.setDepth(index)
                        group.homePosition = pos
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
                        })
                        ghost.setDepth(330)
                        ghost.setAlpha(0.9)
                        ghost.setPosition(24, this.scale.height - HAND_CARD_HEIGHT - 28)
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
                        const index = view.field.findIndex((item) => item.id === card.id)
                        const target = fieldLayout(index)
                        createParticleBurst(this, target.x + FIELD_CARD_WIDTH / 2, target.y + FIELD_CARD_HEIGHT / 2, 0x8be05e)
                    })
                }
            }

            gameRef.current = new Phaser.Game({
                type: Phaser.CANVAS,
                parent: containerRef.current,
                backgroundColor: "#0c1016",
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
