import {useCallback, useEffect, useMemo, useRef, useState} from "react"
import {faCheck, faClockRotateLeft, faShareFromSquare, faUserPen} from "@fortawesome/free-solid-svg-icons"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {
    cardLimitLabel,
    compareTricksFieldCards,
    isTricksCardLimitExpired,
    normalizeTricksState,
    orderTricksHand,
    shortenTricksText,
} from "../../lib/tricks"

const CARD_RATIO = 88 / 63
const HAND_CARD_WIDTH = 260
const HAND_CARD_HEIGHT = Math.round(HAND_CARD_WIDTH * CARD_RATIO)
const FIELD_CARD_WIDTH = 260
const FIELD_CARD_HEIGHT = Math.round(FIELD_CARD_WIDTH * CARD_RATIO)
const GAME_FPS = 30
const HAND_AREA_HEIGHT = 420
const HAND_AREA_EXTRA_DROP = 100
const HAND_AREA_DROP = Math.round(HAND_CARD_HEIGHT * 0.3) + HAND_AREA_EXTRA_DROP
const FIELD_START_Y = 164
const HEADER_HEIGHT = 128
const FIELD_COLUMN_GAP = 25
const FIELD_ROW_GAP = FIELD_CARD_HEIGHT + 32
const FIELD_SIDE_MARGIN = 24
const FIELD_MAX_STACK_BACKS = 5
const FIELD_STACK_OFFSET = 5
const FX_DURATION_MS = 520
const CARD_MOTION_MS = 620
const DRAW_FLIP_MS = 320
const DRAW_REVEAL_HOLD_MS = 200
const DRAW_MOTION_MS = DRAW_FLIP_MS + DRAW_REVEAL_HOLD_MS + CARD_MOTION_MS

const rarityLabels = {
    1: "C1",
    2: "U2",
    3: "R3",
    4: "E4",
    5: "L5",
}

const rarityColors = {
    1: "#b8b8b8",
    2: "#e6e6e6",
    3: "#4fb3ff",
    4: "#8be05e",
    5: "#ffd447",
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
    const edgeOffset = Math.max((count - 1) / 2, 1)
    const normalizedOffset = Math.abs(offset) / edgeOffset
    const maxAngle = Math.min(12, Math.max(0, count - 1) * 3)
    const maxArcDrop = Math.min(54, Math.max(0, count - 1) * 6)
    const angle = Math.sign(offset) * maxAngle * normalizedOffset
    const arc = maxArcDrop * (normalizedOffset ** 1.65)

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
        angle: 0,
    }
}

// 山札を擬似カードとして扱うための座標を返す。
function deckLayout(height) {
    return {
        x: 24,
        y: height - HAND_CARD_HEIGHT - 28 + HAND_AREA_DROP,
        angle: 0,
        zIndex: 130,
    }
}

// 選択中の手札カードを画面下部から300px上の中央位置へ置く座標を返す。
function selectedHandLayout(width, height) {
    return {
        x: width / 2 - HAND_CARD_WIDTH / 2,
        y: Math.max(HEADER_HEIGHT + 24, height - 300 - HAND_CARD_HEIGHT),
        angle: 0,
        zIndex: 310,
    }
}

// 現在のID順を最新カード一覧と同期する。
function syncCardOrder(currentOrder = [], cards = []) {
    const ids = cards.map((card) => card.id)

    return [
        ...currentOrder.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !currentOrder.includes(id)),
    ]
}

// 場札の目標表示順を算出する。
function targetFieldOrder(field = [], currentOrder = [], nowValue = Date.now()) {
    const cardsById = new Map(field.map((card) => [card.id, card]))
    const stableIndex = new Map(currentOrder.map((id, index) => [id, index]))

    return [...currentOrder].sort((aId, bId) => {
        const result = compareTricksFieldCards(cardsById.get(aId), cardsById.get(bId), nowValue)
        if (result !== 0) return result

        return (stableIndex.get(aId) ?? 0) - (stableIndex.get(bId) ?? 0)
    })
}

// ユーザーIDに対応する表示名を返す。
function displayName(usersById, userId) {
    if (!userId) return "-"
    return usersById?.[userId]?.name || userId
}

// DOM座標のtransform文字列を生成する。
function cardTransform(layout) {
    return `translate3d(${Math.round(layout.x)}px, ${Math.round(layout.y)}px, 0) rotate(${layout.angle || 0}deg)`
}

// 表示領域サイズを追跡する。
function useElementSize(ref) {
    const [size, setSize] = useState({width: 1280, height: 720})

    useEffect(() => {
        if (!ref.current) return undefined
        const update = () => {
            const rect = ref.current.getBoundingClientRect()
            setSize({
                width: Math.max(1, Math.round(rect.width)),
                height: Math.max(1, Math.round(rect.height)),
            })
        }
        const observer = new ResizeObserver(update)
        observer.observe(ref.current)
        update()

        return () => observer.disconnect()
    }, [ref])

    return size
}

// 下層Phaser canvasを生成し、背景・領域・軽量テキストだけを描画する。
function PhaserBaseLayer({state, size}) {
    const containerRef = useRef(null)
    const gameRef = useRef(null)
    const sceneRef = useRef(null)
    const stateRef = useRef(state)
    const sleepTimerRef = useRef(null)
    const renderKey = useMemo(() => JSON.stringify({
        title: state?.tournament?.title,
        endAt: state?.tournament?.end_at,
        eventState: state?.tournament?.state,
        debug: state?.tournament?.debug,
        fieldEmpty: !state?.field?.length,
    }), [state])

    useEffect(() => {
        stateRef.current = state
    }, [state])

    useEffect(() => {
        sceneRef.current?.requestRender?.(stateRef.current)
    }, [renderKey])

    useEffect(() => {
        sceneRef.current?.requestRender?.(stateRef.current)
    }, [size])

    useEffect(() => {
        let disposed = false

        async function boot() {
            const Phaser = await import("phaser")
            if (disposed || !containerRef.current || gameRef.current) return

            class TricksBaseScene extends Phaser.Scene {
                constructor() {
                    super("TricksBaseScene")
                }

                create() {
                    sceneRef.current = this
                    this.requestRender(stateRef.current)
                }

                requestRender(nextState) {
                    this.game.loop.wake()
                    window.__TRICKS_RENDER_METRICS__ = {
                        ...(window.__TRICKS_RENDER_METRICS__ || {}),
                        phaserLoopSleeping: false,
                    }
                    this.renderBase(nextState)
                    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current)
                    sleepTimerRef.current = window.setTimeout(() => {
                        this.game.loop.sleep()
                        window.__TRICKS_RENDER_METRICS__ = {
                            ...(window.__TRICKS_RENDER_METRICS__ || {}),
                            phaserLoopSleeping: true,
                        }
                        sleepTimerRef.current = null
                    }, 80)
                }

                renderBase(nextState) {
                    this.children.removeAll(true)
                    const width = this.scale.width
                    const height = this.scale.height
                    const view = normalizeTricksState(nextState || {}, {})
                    const tournament = view.tournament || {}

                    this.add.rectangle(0, 0, width, height, 0x0c1016, 1).setOrigin(0, 0)
                    this.add.rectangle(0, 0, width, HEADER_HEIGHT, 0x141b26, 0.82).setOrigin(0, 0)
                    this.add.rectangle(0, handAreaTop(height), width, HAND_AREA_HEIGHT, 0x121821, 0.58).setOrigin(0, 0)
                    this.add.text(24, 38, tournament.title || "第19回期間限定ランキング", {
                        fontFamily: "Arial",
                        fontSize: "24px",
                        color: "#ffffff",
                        fontStyle: "bold",
                    })
                    this.add.text(24, 72, tournament.subtitle || "トリックテイキング制", {
                        fontFamily: "Arial",
                        fontSize: "15px",
                        color: "#b7c1d8",
                    })

                    if (!view.field?.length) {
                        this.add.text(24, FIELD_START_Y, "場札はまだありません", {
                            fontFamily: "Arial",
                            fontSize: "14px",
                            color: "#778399",
                        })
                    }
                    if (typeof window !== "undefined") {
                        const current = window.__TRICKS_RENDER_METRICS__ || {}
                        window.__TRICKS_RENDER_METRICS__ = {
                            ...current,
                            phaserGameObjects: this.children.length,
                            phaserRenderCount: Number(current.phaserRenderCount || 0) + 1,
                        }
                    }
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
                scene: TricksBaseScene,
            })
        }

        boot()

        return () => {
            disposed = true
            sceneRef.current = null
            if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current)
            sleepTimerRef.current = null
            if (gameRef.current) {
                gameRef.current.destroy(true)
                gameRef.current = null
            }
        }
    }, [])

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

// カードの下層FX canvasで短時間の放射光だけを描画する。
function FxLayer({burst}) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return undefined

        const rect = canvas.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.max(1, Math.round(rect.width * dpr))
        canvas.height = Math.max(1, Math.round(rect.height * dpr))
        const context = canvas.getContext("2d")
        if (!context) return undefined
        context.setTransform(dpr, 0, 0, dpr, 0, 0)

        const rays = burst
            ? Array.from({length: burst.count || 18}, (_, index) => {
                const angle = (Math.PI * 2 * index) / (burst.count || 18)
                const distance = 38 + Math.random() * 46
                return {
                    angle,
                    distance,
                    width: 1.5 + Math.random() * 2.5,
                }
            })
            : []
        if (!burst) {
            window.__TRICKS_RENDER_METRICS__ = {
                ...(window.__TRICKS_RENDER_METRICS__ || {}),
                activeRaf: 0,
            }
            return () => context.clearRect(0, 0, rect.width, rect.height)
        }

        const start = performance.now()
        let frameId = 0

        const draw = (time) => {
            const t = Math.min(1, (time - start) / FX_DURATION_MS)
            context.clearRect(0, 0, rect.width, rect.height)
            rays.forEach((ray) => {
                const eased = 1 - Math.pow(1 - t, 3)
                context.globalAlpha = 1 - t
                context.strokeStyle = burst.color || "#ffd447"
                context.lineWidth = ray.width * (1 - t * 0.5)
                context.lineCap = "round"
                context.beginPath()
                context.moveTo(
                    burst.x + Math.cos(ray.angle) * 24,
                    burst.y + Math.sin(ray.angle) * 24
                )
                context.lineTo(
                    burst.x + Math.cos(ray.angle) * ray.distance * eased,
                    burst.y + Math.sin(ray.angle) * ray.distance * eased
                )
                context.stroke()
            })
            context.globalAlpha = 1
            if (t < 1) frameId = requestAnimationFrame(draw)
            else window.__TRICKS_RENDER_METRICS__ = {
                ...(window.__TRICKS_RENDER_METRICS__ || {}),
                activeRaf: 0,
            }
        }

        window.__TRICKS_RENDER_METRICS__ = {
            ...(window.__TRICKS_RENDER_METRICS__ || {}),
            activeRaf: 1,
        }
        frameId = requestAnimationFrame(draw)

        return () => {
            cancelAnimationFrame(frameId)
            window.__TRICKS_RENDER_METRICS__ = {
                ...(window.__TRICKS_RENDER_METRICS__ || {}),
                activeRaf: 0,
            }
            context.clearRect(0, 0, rect.width, rect.height)
        }
    }, [burst])

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
            }}
        />
    )
}

// DOMカード1枚を表示する。
function TricksDomCard({card, type, layout, usersById, selected, disabled, hidden, motionStyle, motionType, nowValue, onClick}) {
    const rarity = Number(card?.rarity || 1)
    const isField = type === "field"
    const stackCount = Math.max(Number(card?.stack_count || 1), 1)
    const stackBacks = isField ? Math.min(Math.max(stackCount - 1, 0), FIELD_MAX_STACK_BACKS) : 0
    const width = isField ? FIELD_CARD_WIDTH : HAND_CARD_WIDTH
    const height = isField ? FIELD_CARD_HEIGHT : HAND_CARD_HEIGHT
    const borderColor = rarityColors[rarity] || rarityColors[1]
    const expired = isField && isTricksCardLimitExpired(card, nowValue)

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (!disabled) onClick?.()
            }}
            data-tricks-motion={motionType}
            className={`tricks-dom-card tricks-dom-card-${type} rarity-${rarity}${selected ? " is-selected" : ""}${expired ? " is-expired" : ""}`}
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width,
                height,
                transform: cardTransform(layout),
                zIndex: layout.zIndex,
                "--card-border": borderColor,
                ...motionStyle,
                opacity: hidden ? 0 : undefined,
                pointerEvents: disabled ? "none" : "auto",
            }}
        >
            {Array.from({length: stackBacks}, (_, index) => (
                <span
                    key={index}
                    className="tricks-dom-card-back"
                    style={{
                        transform: `translate(${(stackBacks - index) * FIELD_STACK_OFFSET}px, ${(stackBacks - index) * FIELD_STACK_OFFSET}px)`,
                    }}
                />
            ))}
            <span className="tricks-dom-card-face">
                <span className="tricks-dom-card-meta">
                    <span>#{card.stage_id || card.card_id || card.id}</span>
                    <span>★{card.difficulty || 1} {rarityLabels[rarity] || `R${rarity}`}</span>
                </span>
                <span className="tricks-dom-card-title">{shortenTricksText(card.title || "Untitled", isField ? 22 : 18)}</span>
                <span className="tricks-dom-card-rule">{shortenTricksText(card.rule_name || "", isField ? 28 : 20)}</span>
                <span className="tricks-dom-card-text">{shortenTricksText(card.text || "", isField ? 120 : 74)}</span>
                {isField && (
                    <>
                        <span className="tricks-dom-card-users">
                            <span><FontAwesomeIcon icon={faUserPen} /> {shortenTricksText(displayName(usersById, card.creator), 12)}</span>
                            <span><FontAwesomeIcon icon={faShareFromSquare} /> {shortenTricksText(displayName(usersById, card.taker), 12)}</span>
                        </span>
                        <span className="tricks-dom-card-footer">
                            <span>{cardLimitLabel(card, nowValue)}{!expired && card.my_can_post && card.my_initial_post_cost === 0 && (
                                <span data-tricks-free style={{marginLeft: 6, color: "#237a39", fontWeight: 700}}>無料！</span>
                            )}</span>
                            {card.my_has_record && <FontAwesomeIcon icon={faCheck} data-tricks-posted title="投稿済み" aria-label="投稿済み" style={{marginLeft: "auto", marginRight: 6, color: "#237a39"}} />}
                            <span className={`tricks-dom-stack${stackCount >= 7 ? " has-gradient" : ""}`}>
                                <span className="tricks-dom-stack-value">{stackCount}</span>
                            </span>
                        </span>
                    </>
                )}
                {!isField && (
                    <span className="tricks-dom-card-footer">
                        <span>手札</span>
                        {card.was_returned && (
                            <span
                                className="tricks-return-history-icon"
                                title="このカードは以前誰かの手札から山札へ戻されています"
                                aria-label="返却履歴あり"
                            >
                                <FontAwesomeIcon icon={faClockRotateLeft} />
                            </span>
                        )}
                        <span>{rarityLabels[rarity] || `R${rarity}`}</span>
                    </span>
                )}
                {expired && <span className="tricks-dom-card-expired">回収待ち</span>}
            </span>
        </button>
    )
}

// 山札DOMを表示する。
function TricksDeck({layout, deckCount, trashCount, disabled, disabledReason, onDraw}) {
    return (
        <div
            className="tricks-dom-deck"
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: HAND_CARD_WIDTH,
                height: HAND_CARD_HEIGHT,
                transform: cardTransform(layout),
                zIndex: layout.zIndex,
                pointerEvents: "auto",
            }}
        >
            <div className="tricks-dom-deck-title">山札</div>
            <button type="button" disabled={disabled} title={disabledReason} onClick={onDraw}>ドロー</button>
            <div className="tricks-dom-deck-count">残り {deckCount ?? 0}枚</div>
            <div className="tricks-dom-deck-trash">捨て札 {trashCount ?? 0}枚</div>
            {disabledReason && <div className="tricks-dom-deck-reason">{disabledReason}</div>}
        </div>
    )
}

// 山札上で表返り、静止後に手札へ移動するゴーストカードを表示する。
function DrawGhost({motion}) {
    if (!motion) return null
    const card = motion.card || {}
    const rarity = Number(card.rarity || 1)

    return (
        <div
            className="tricks-dom-draw-ghost"
            data-tricks-draw-motion
            style={{
                "--from-x": `${motion.from.x}px`,
                "--from-y": `${motion.from.y}px`,
                "--from-angle": `${motion.from.angle || 0}deg`,
                "--mid-x": `${motion.mid.x}px`,
                "--mid-y": `${motion.mid.y}px`,
                "--to-x": `${motion.to.x}px`,
                "--to-y": `${motion.to.y}px`,
                "--to-angle": `${motion.to.angle || 0}deg`,
                "--card-border": rarityColors[rarity] || rarityColors[1],
                zIndex: 360,
            }}
        >
            <span className="tricks-dom-draw-flipper" data-tricks-draw-flipper>
                <span className="tricks-dom-card-back tricks-dom-draw-back" />
                <span className="tricks-dom-card-face tricks-dom-draw-face">
                    <span className="tricks-dom-card-meta">
                        <span>#{card.stage_id || card.card_id || card.id || "-"}</span>
                        <span>★{card.difficulty || 1} {rarityLabels[rarity] || `R${rarity}`}</span>
                    </span>
                    <span className="tricks-dom-card-title">{shortenTricksText(card.title || "Untitled", 18)}</span>
                    <span className="tricks-dom-card-rule">{shortenTricksText(card.rule_name || "", 20)}</span>
                    <span className="tricks-dom-card-text">{shortenTricksText(card.text || "", 74)}</span>
                    <span className="tricks-dom-card-footer">
                        <span>手札</span>
                        <span>{rarityLabels[rarity] || `R${rarity}`}</span>
                    </span>
                </span>
            </span>
        </div>
    )
}

// DOMカードと操作パネルを表示する中間レイヤー。
function DomCardsLayer({
    view,
    size,
    usersById,
    selectedHand,
    selectedFieldId,
    fieldScrollY,
    fieldOrder,
    onDraw,
    onSelectHand,
    onCancelHand,
    onTake,
    onReturnToDeck,
    onSelectField,
    drawMotion,
    takingMotion,
    returningMotion,
    operation,
    busy,
    nowValue,
}) {
    const fieldById = useMemo(() => new Map((view.field || []).map((card) => [card.id, card])), [view.field])
    const orderedField = fieldOrder.map((id) => fieldById.get(id)).filter(Boolean)
    const selectedHandId = selectedHand?.id
    const baseDeckLayout = deckLayout(size.height)

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
            }}
        >
            <div
                className="tricks-field-viewport"
                style={{
                    position: "absolute",
                    inset: 0,
                    clipPath: `inset(${HEADER_HEIGHT}px 0 ${Math.max(0, size.height - fieldViewportBottom(size.height))}px 0)`,
                    pointerEvents: "none",
                }}
            >
                {orderedField.map((card, index) => {
                    const base = fieldLayout(index, fieldScrollY, size.width)
                    const visible = base.y + FIELD_CARD_HEIGHT >= HEADER_HEIGHT
                        && base.y <= fieldViewportBottom(size.height) + 48
                    if (!visible) return null

                    return (
                        <TricksDomCard
                            key={card.id}
                            card={card}
                            type="field"
                            layout={{
                                ...base,
                                zIndex: selectedFieldId === card.id ? 330 : 20 + index,
                            }}
                            usersById={usersById}
                            selected={selectedFieldId === card.id}
                            disabled={!card.limit_at}
                            nowValue={nowValue}
                            onClick={() => {
                                const side = base.x + FIELD_CARD_WIDTH / 2 > size.width / 2 ? "left" : "right"
                                onSelectField?.({
                                    card,
                                    anchor: {
                                        x: base.x,
                                        y: base.y,
                                        width: FIELD_CARD_WIDTH,
                                        height: FIELD_CARD_HEIGHT,
                                    },
                                    side,
                                })
                            }}
                        />
                    )
                })}
            </div>
            {view.tournament?.state !== "ended" && (
                <TricksDeck
                    layout={baseDeckLayout}
                    deckCount={view.deckCount}
                    trashCount={view.trashCount}
                    disabled={busy || !operation.canDraw}
                    disabledReason={operation.drawReason}
                    onDraw={onDraw}
                />
            )}
            <DrawGhost motion={drawMotion} />
            {(view.hand || []).map((card, index, list) => {
                const home = handLayout(size.width, size.height, list.length, index)
                const isSelected = selectedHandId === card.id
                const isTaking = takingMotion?.card?.id === card.id
                const isDrawing = drawMotion?.card?.id === card.id
                const isReturning = returningMotion?.card?.id === card.id
                const layout = isSelected
                    ? selectedHandLayout(size.width, size.height)
                    : {
                        ...home,
                        zIndex: 120 + index,
                    }

                return (
                    <TricksDomCard
                        key={card.id}
                        card={card}
                        type="hand"
                        layout={layout}
                        usersById={usersById}
                        selected={isSelected}
                        hidden={isTaking || isDrawing || isReturning}
                        disabled={busy}
                        nowValue={nowValue}
                        onClick={() => onSelectHand(card)}
                    />
                )
            })}
            {takingMotion && (
                <TricksDomCard
                    card={takingMotion.card}
                    type="hand"
                    layout={{
                        x: 0,
                        y: 0,
                        angle: 0,
                        zIndex: 370,
                    }}
                    usersById={usersById}
                    disabled
                    nowValue={nowValue}
                    motionStyle={{
                        "--from-x": `${takingMotion.from.x}px`,
                        "--from-y": `${takingMotion.from.y}px`,
                        "--from-angle": `${takingMotion.from.angle || 0}deg`,
                        "--arc-x": `${takingMotion.arc.x}px`,
                        "--arc-y": `${takingMotion.arc.y}px`,
                        "--to-x": `${takingMotion.to.x}px`,
                        "--to-y": `${takingMotion.to.y}px`,
                        "--to-angle": `${takingMotion.to.angle || 0}deg`,
                        animation: `tricksTakePlace ${CARD_MOTION_MS}ms cubic-bezier(0.22, 0.84, 0.22, 1) forwards`,
                    }}
                />
            )}
            {returningMotion && (
                <TricksDomCard
                    card={returningMotion.card}
                    type="hand"
                    layout={{
                        x: 0,
                        y: 0,
                        angle: 0,
                        zIndex: 370,
                    }}
                    usersById={usersById}
                    disabled
                    motionType="return-to-deck"
                    nowValue={nowValue}
                    motionStyle={{
                        "--from-x": `${returningMotion.from.x}px`,
                        "--from-y": `${returningMotion.from.y}px`,
                        "--from-angle": `${returningMotion.from.angle || 0}deg`,
                        "--arc-x": `${returningMotion.arc.x}px`,
                        "--arc-y": `${returningMotion.arc.y}px`,
                        "--to-x": `${returningMotion.to.x}px`,
                        "--to-y": `${returningMotion.to.y}px`,
                        "--to-angle": `${returningMotion.to.angle || 0}deg`,
                        animation: `tricksReturnToDeck ${CARD_MOTION_MS}ms cubic-bezier(0.22, 0.84, 0.22, 1) forwards`,
                    }}
                />
            )}
            {selectedHand && (
                <>
                    <button
                        type="button"
                        aria-label="手札詳細を閉じる"
                        onClick={onCancelHand}
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 280,
                            border: 0,
                            background: "rgba(3, 6, 12, 0.54)",
                            pointerEvents: "auto",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            left: size.width / 2 + HAND_CARD_WIDTH / 2 + 16,
                            top: selectedHandLayout(size.width, size.height).y + 78,
                            display: "grid",
                            gap: 14,
                            zIndex: 320,
                            pointerEvents: "auto",
                        }}
                    >
                        <div
                            data-tricks-take-summary
                            style={{
                                maxWidth: 220,
                                color: "#fff",
                                fontSize: 14,
                                fontWeight: 800,
                                lineHeight: 1.5,
                                textAlign: "center",
                                textShadow: "0 1px 4px rgba(0, 0, 0, 0.85)",
                            }}
                        >
                            <div>投稿コスト {Math.max(1, Number(selectedHand.rarity || 1))}P</div>
                            <div>スタック数 {view.hand.length}</div>
                        </div>
                        <button
                            type="button"
                            className="tricks-hand-action tricks-hand-action-take"
                            disabled={busy || !operation.canTake}
                            title={operation.takeReason}
                            onClick={() => onTake(selectedHand)}
                        >
                            場に出す
                        </button>
                        {!operation.canTake && (
                            <div style={{maxWidth: 220, color: "#ffcf6e", fontSize: 12}}>{operation.takeReason}</div>
                        )}
                        <button
                            type="button"
                            className="tricks-hand-action tricks-hand-action-return"
                            disabled={busy || !operation.canReturnToDeck}
                            title={operation.returnReason}
                            onClick={() => onReturnToDeck(selectedHand)}
                        >
                            山札に戻す
                        </button>
                        <button type="button" className="tricks-hand-action" onClick={onCancelHand}>
                            キャンセル
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

// 3レイヤー構成のトリック画面本体を管理する。
export default function TricksLayeredGame({
    state,
    selectedFieldId,
    usersById = {},
    sortTick = 0,
    onDraw,
    onTake,
    onReturnToDeck,
    onSelectField,
    onFieldSortingChange,
    operation,
    busy = false,
    nowValue = Date.now(),
}) {
    const rootRef = useRef(null)
    const size = useElementSize(rootRef)
    const [handOrder, setHandOrder] = useState([])
    const [fieldOrder, setFieldOrder] = useState([])
    const [fieldScrollY, setFieldScrollY] = useState(0)
    const [selectedHand, setSelectedHand] = useState(null)
    const [fxBurst, setFxBurst] = useState(null)
    const [drawMotion, setDrawMotion] = useState(null)
    const [takingMotion, setTakingMotion] = useState(null)
    const [returningMotion, setReturningMotion] = useState(null)
    const motionTimersRef = useRef(new Set())
    const interactionBusy = busy || Boolean(drawMotion) || Boolean(takingMotion) || Boolean(returningMotion)
    const view = useMemo(() => normalizeTricksState(state || {}, {handOrder, nowValue}), [handOrder, nowValue, state])
    const handOrderKey = view.handOrder.join(",")
    const fieldIdsKey = (view.field || []).map((card) => card.id).join(",")

    const scheduleMotionEnd = useCallback((callback, duration = CARD_MOTION_MS) => {
        const timer = window.setTimeout(() => {
            motionTimersRef.current.delete(timer)
            window.__TRICKS_RENDER_METRICS__ = {
                ...(window.__TRICKS_RENDER_METRICS__ || {}),
                activeTimers: motionTimersRef.current.size,
            }
            callback()
        }, duration)
        motionTimersRef.current.add(timer)
        window.__TRICKS_RENDER_METRICS__ = {
            ...(window.__TRICKS_RENDER_METRICS__ || {}),
            activeTimers: motionTimersRef.current.size,
        }
    }, [])

    useEffect(() => {
        const timers = motionTimersRef.current

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer))
            timers.clear()
            window.__TRICKS_RENDER_METRICS__ = {
                ...(window.__TRICKS_RENDER_METRICS__ || {}),
                activeTimers: 0,
            }
        }
    }, [])

    useEffect(() => {
        setHandOrder((current) => {
            if (current.length === view.handOrder.length && current.every((id, index) => id === view.handOrder[index])) {
                return current
            }

            return view.handOrder
        })
    }, [handOrderKey, view.handOrder])

    useEffect(() => {
        setFieldOrder((current) => targetFieldOrder(view.field, syncCardOrder(current, view.field), nowValue))
    }, [fieldIdsKey, nowValue, sortTick, view.field])

    useEffect(() => {
        setFieldScrollY((current) => Math.max(0, Math.min(
            current,
            fieldMaxScroll(size.width, size.height, view.field?.length || 0)
        )))
    }, [size.height, size.width, view.field])

    const handleWheel = useCallback((event) => {
        if (selectedHand || selectedFieldId) return
        const rect = rootRef.current?.getBoundingClientRect()
        if (!rect) return
        const y = event.clientY - rect.top
        if (y < HEADER_HEIGHT || y > fieldViewportBottom(size.height)) return
        const maxScroll = fieldMaxScroll(size.width, size.height, view.field?.length || 0)
        if (maxScroll <= 0) return
        event.preventDefault()
        setFieldScrollY((current) => Math.max(0, Math.min(maxScroll, current + event.deltaY)))
    }, [selectedFieldId, selectedHand, size.height, size.width, view.field])

    const beginDrawMotion = useCallback((result) => {
        if (!result?.card) return false
        const from = deckLayout(size.height)
        const to = handLayout(size.width, size.height, Math.max(view.hand.length + 1, 1), view.hand.length)
        const id = `draw-${Date.now()}`
        setDrawMotion({
            id,
            card: result.card,
            from,
            mid: {
                x: (from.x + to.x) / 2,
                y: Math.min(from.y, to.y) - 120,
            },
            to,
        })
        scheduleMotionEnd(() => {
            setDrawMotion((current) => (current?.id === id ? null : current))
        }, DRAW_MOTION_MS)

        return true
    }, [scheduleMotionEnd, size.height, size.width, view.hand.length])

    const handleDraw = useCallback(async () => {
        if (!operation.canDraw || interactionBusy) return
        let motionStarted = false
        const result = await onDraw?.((drawResult) => {
            motionStarted = beginDrawMotion(drawResult)
        })
        if (!motionStarted) beginDrawMotion(result)
    }, [beginDrawMotion, interactionBusy, onDraw, operation.canDraw])

    const handleTake = useCallback(async (card) => {
        if (!operation.canTake || interactionBusy) return
        const succeeded = await onTake?.(card)
        if (!succeeded) return
        const fieldIndex = Math.min(view.field.length, 15)
        const target = fieldLayout(fieldIndex, fieldScrollY, size.width)
        const start = selectedHandLayout(size.width, size.height)
        const stackCount = Math.max(Number(card?.stack_count || view.hand.length || 1), 1)
        const id = `take-${card.id}-${Date.now()}`
        const arc = {
            x: (start.x + target.x) / 2,
            y: Math.max(24, Math.min(start.y, target.y) - 190),
        }
        setTakingMotion({
            id,
            card,
            from: start,
            arc,
            to: {
                x: target.x,
                y: target.y,
                angle: 0,
            },
        })
        const rarity = Number(card?.rarity || 1)
        setFxBurst(rarity >= 3 ? {
            id,
            x: target.x + FIELD_CARD_WIDTH / 2,
            y: target.y + FIELD_CARD_HEIGHT / 2,
            color: rarityColors[rarity] || "#ffd447",
            count: Math.min(30, 14 + stackCount * 2),
        } : null)
        scheduleMotionEnd(() => {
            setTakingMotion((current) => (current?.id === id ? null : current))
            setFxBurst((current) => (current?.id === id ? null : current))
            setSelectedHand(null)
        })
    }, [fieldScrollY, interactionBusy, onTake, operation.canTake, scheduleMotionEnd, size.height, size.width, view.field.length, view.hand.length])

    const beginReturnMotion = useCallback((card) => {
        if (!card) return false
        const from = selectedHandLayout(size.width, size.height)
        const to = deckLayout(size.height)
        const id = `return-${card.id}-${Date.now()}`
        setReturningMotion({
            id,
            card,
            from,
            arc: {
                x: (from.x + to.x) / 2,
                y: Math.min(from.y, to.y) - 120,
            },
            to,
        })
        scheduleMotionEnd(() => {
            setReturningMotion((current) => (current?.id === id ? null : current))
            setSelectedHand(null)
        })

        return true
    }, [scheduleMotionEnd, size.height, size.width])

    const handleReturnToDeck = useCallback(async (card) => {
        if (!operation.canReturnToDeck || interactionBusy) return
        let motionStarted = false
        const result = await onReturnToDeck?.(card, (returnResult) => {
            motionStarted = beginReturnMotion(returnResult?.card || card)
        })
        if (result && !motionStarted) beginReturnMotion(result.card || card)
    }, [beginReturnMotion, interactionBusy, onReturnToDeck, operation.canReturnToDeck])

    useEffect(() => {
        onFieldSortingChange?.(false)
    }, [onFieldSortingChange])

    return (
        <div
            ref={rootRef}
            onWheel={handleWheel}
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                zIndex: 0,
            }}
        >
            <PhaserBaseLayer state={state} size={size} />
            <FxLayer burst={fxBurst} />
            <DomCardsLayer
                view={view}
                size={size}
                usersById={usersById}
                selectedHand={selectedHand}
                selectedFieldId={selectedFieldId}
                fieldScrollY={fieldScrollY}
                fieldOrder={fieldOrder}
                onDraw={handleDraw}
                onSelectHand={setSelectedHand}
                onCancelHand={() => setSelectedHand(null)}
                onTake={handleTake}
                onReturnToDeck={handleReturnToDeck}
                onSelectField={onSelectField}
                drawMotion={drawMotion}
                takingMotion={takingMotion}
                returningMotion={returningMotion}
                operation={operation}
                busy={interactionBusy}
                nowValue={nowValue}
            />
            <style jsx global>{`
                .tricks-dom-card {
                    border: 0;
                    padding: 0;
                    background: transparent;
                    color: inherit;
                    cursor: pointer;
                    text-align: left;
                    transform-origin: 0 0;
                    transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 160ms ease;
                }
                .tricks-dom-card:disabled {
                    cursor: default;
                }
                .tricks-dom-card-face,
                .tricks-dom-card-back {
                    position: absolute;
                    inset: 0;
                    border-radius: 10px;
                    box-sizing: border-box;
                }
                .tricks-dom-card-back {
                    background: #d9dde5;
                    border: 2px solid #8d96a6;
                }
                .tricks-dom-card-face {
                    display: grid;
                    grid-template-rows: auto auto auto 1fr auto;
                    gap: 8px;
                    padding: 16px;
                    overflow: hidden;
                    background: #ffffff;
                    border: 8px solid var(--card-border);
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.26);
                }
                .tricks-dom-card-field .tricks-dom-card-face {
                    padding: 18px;
                    gap: 9px;
                }
                .tricks-dom-card.is-selected .tricks-dom-card-face {
                    filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.34));
                }
                .tricks-dom-card.rarity-3 .tricks-dom-card-face {
                    border-color: #4fb3ff;
                    box-shadow: inset 0 0 0 2px rgba(26, 102, 255, 0.26), 0 12px 30px rgba(0, 0, 0, 0.26);
                }
                .tricks-dom-card.rarity-4 .tricks-dom-card-face {
                    box-shadow: inset 0 0 14px rgba(139, 224, 94, 0.34), 0 12px 30px rgba(0, 0, 0, 0.26);
                }
                .tricks-dom-card.rarity-5 .tricks-dom-card-face {
                    box-shadow: inset 0 0 18px rgba(255, 212, 71, 0.46), 0 12px 30px rgba(0, 0, 0, 0.26);
                }
                .tricks-dom-card-meta,
                .tricks-dom-card-users,
                .tricks-dom-card-footer {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    color: #667085;
                    font-size: 13px;
                    font-weight: 700;
                }
                .tricks-return-history-icon {
                    display: inline-grid;
                    place-items: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 999px;
                    background: #7c3aed;
                    color: #ffffff;
                }
                .tricks-dom-card-title,
                .tricks-dom-card-rule,
                .tricks-dom-card-text {
                    display: block;
                    color: #141923;
                    overflow: hidden;
                }
                .tricks-dom-card-title {
                    font-size: 22px;
                    line-height: 1.12;
                    font-weight: 800;
                }
                .tricks-dom-card-hand .tricks-dom-card-title {
                    font-size: 20px;
                }
                .tricks-dom-card-rule {
                    color: #4f5a68;
                    font-size: 15px;
                    line-height: 1.25;
                    font-weight: 800;
                }
                .tricks-dom-card-text {
                    color: #243044;
                    font-size: 14px;
                    line-height: 1.45;
                }
                .tricks-dom-card-users {
                    border-top: 1px solid #d5dae2;
                    padding-top: 10px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .tricks-dom-card-users span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-width: 0;
                }
                .tricks-dom-card-footer {
                    align-items: center;
                    color: #9a5f00;
                    font-size: 14px;
                }
                .tricks-dom-stack {
                    display: inline-grid;
                    place-items: center;
                    min-width: 36px;
                    height: 36px;
                    border-radius: 999px;
                    background: #172033;
                    color: #ffffff;
                    border: 2px solid #6b7280;
                    font-size: 17px;
                }
                .tricks-dom-stack.has-gradient .tricks-dom-stack-value {
                    color: transparent;
                    background-image: linear-gradient(90deg, #ffffff 0%, #ffb347 50%, #ffffff 100%);
                    background-clip: text;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .tricks-dom-card-expired {
                    position: absolute;
                    inset: 8px;
                    display: grid;
                    place-items: center;
                    border-radius: 8px;
                    background: rgba(17, 24, 39, 0.68);
                    color: #ffffff;
                    font-size: 22px;
                    font-weight: 800;
                }
                .tricks-dom-deck {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 16px 12px 0;
                    border-radius: 10px;
                    background: #263247;
                    border: 10px solid #101620;
                    box-sizing: border-box;
                    color: #ffffff;
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.26);
                }
                .tricks-dom-draw-ghost {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: ${HAND_CARD_WIDTH}px;
                    height: ${HAND_CARD_HEIGHT}px;
                    pointer-events: none;
                    transform-origin: 0 0;
                    perspective: 900px;
                    animation: tricksDrawToHand ${DRAW_MOTION_MS}ms linear forwards;
                }
                .tricks-dom-draw-flipper {
                    content: "";
                    position: absolute;
                    inset: 0;
                    transform-style: preserve-3d;
                    animation: tricksDrawFlip ${DRAW_MOTION_MS}ms ease-in-out forwards;
                }
                .tricks-dom-draw-face,
                .tricks-dom-draw-back {
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }
                .tricks-dom-draw-back {
                    transform: rotateY(180deg);
                    background: #263247;
                    border: 10px solid #101620;
                    box-shadow: 0 20px 42px rgba(0, 0, 0, 0.34);
                }
                .tricks-dom-draw-back::after {
                    content: "";
                    position: absolute;
                    inset: 10px;
                    border-radius: 8px;
                    border: 1px solid rgba(141, 180, 255, 0.62);
                    background: linear-gradient(135deg, rgba(141, 180, 255, 0.18), rgba(255, 255, 255, 0.04));
                }
                .tricks-dom-draw-face {
                    transform: rotateY(0deg);
                }
                .tricks-dom-deck-title {
                    font-size: 24px;
                    font-weight: 800;
                }
                .tricks-dom-deck button,
                .tricks-hand-action {
                    border: 1px solid #8db4ff;
                    border-radius: 8px;
                    background: #2556a3;
                    color: #ffffff;
                    min-width: 128px;
                    min-height: 44px;
                    padding: 0 18px;
                    font-size: 16px;
                    font-weight: 800;
                    cursor: pointer;
                }
                .tricks-dom-deck button {
                    margin-top: 4px;
                }
                .tricks-dom-deck-count {
                    color: #c7d2e6;
                    font-size: 15px;
                    font-weight: 800;
                    margin-top: 6px;
                }
                .tricks-dom-deck-trash {
                    color: #9aa8bd;
                    font-size: 13px;
                    font-weight: 700;
                }
                .tricks-dom-deck-reason {
                    max-width: 210px;
                    margin-top: 2px;
                    color: #ffcf6e;
                    font-size: 11px;
                    line-height: 1.3;
                    text-align: center;
                }
                .tricks-dom-deck button:disabled,
                .tricks-hand-action:disabled {
                    cursor: not-allowed;
                    opacity: 0.45;
                }
                .tricks-hand-action {
                    background: #253044;
                    border-color: #7f8da3;
                }
                .tricks-hand-action-take {
                    background: #1f7a43;
                    border-color: #6edb9a;
                }
                @keyframes tricksDrawToHand {
                    0% {
                        opacity: 1;
                        transform: translate3d(var(--from-x), var(--from-y), 0) rotate(var(--from-angle)) scale(0.94);
                    }
                    46% {
                        opacity: 1;
                        transform: translate3d(var(--from-x), var(--from-y), 0) rotate(var(--from-angle)) scale(0.98);
                    }
                    74% {
                        opacity: 1;
                        transform: translate3d(var(--mid-x), var(--mid-y), 0) rotate(-7deg) scale(1.05);
                    }
                    100% {
                        opacity: 1;
                        transform: translate3d(var(--to-x), var(--to-y), 0) rotate(var(--to-angle)) scale(1);
                    }
                }
                @keyframes tricksDrawFlip {
                    0%, 2% {
                        transform: rotateY(180deg);
                    }
                    28%, 100% {
                        transform: rotateY(0deg);
                    }
                }
                @keyframes tricksTakePlace {
                    0% {
                        opacity: 1;
                        transform: translate3d(var(--from-x), var(--from-y), 0) rotate(var(--from-angle)) scale(1);
                        filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.28));
                    }
                    52% {
                        opacity: 1;
                        transform: translate3d(var(--arc-x), var(--arc-y), 0) rotate(-9deg) scale(1.08);
                        filter: drop-shadow(0 46px 38px rgba(0, 0, 0, 0.36));
                    }
                    100% {
                        opacity: 0;
                        transform: translate3d(var(--to-x), var(--to-y), 0) rotate(var(--to-angle)) scale(1);
                        filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.24));
                    }
                }
                @keyframes tricksReturnToDeck {
                    0% {
                        opacity: 1;
                        transform: translate3d(var(--from-x), var(--from-y), 0) rotate(var(--from-angle)) scale(1);
                        filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.28));
                    }
                    52% {
                        opacity: 1;
                        transform: translate3d(var(--arc-x), var(--arc-y), 0) rotate(8deg) scale(1.04);
                        filter: drop-shadow(0 42px 34px rgba(0, 0, 0, 0.34));
                    }
                    100% {
                        opacity: 1;
                        transform: translate3d(var(--to-x), var(--to-y), 0) rotate(var(--to-angle)) scale(0.94);
                        filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.24));
                    }
                }
            `}</style>
        </div>
    )
}
