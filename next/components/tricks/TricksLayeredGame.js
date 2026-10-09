import {useCallback, useEffect, useId, useMemo, useRef, useState} from "react"
import {faCheck, faSquareCheck, faMedal, faShareFromSquare, faUserPen} from "@fortawesome/free-solid-svg-icons"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {useLocale} from "../../lib/pik5"
import TricksCardBorder, {TricksCardBorderStyles} from "./TricksCardBorder"
import {
    cardLimitLabel,
    compareTricksFieldCards,
    isTricksCardLimitExpired,
    normalizeTricksState,
    orderTricksHand,
    shortenTricksText,
    tricksRarityColors,
    tricksStackBonus,
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
const FIELD_START_Y = 190
const HEADER_HEIGHT = 174
const FIELD_COLUMN_GAP = 25
const FIELD_ROW_GAP = FIELD_CARD_HEIGHT + 32
const FIELD_SIDE_MARGIN = 24
const FIELD_MAX_STACK_BACKS = 5
// 最大5枚の裏札でも隣のカードに2px以上の余白を残す。
const FIELD_STACK_OFFSET = Math.min(4, (FIELD_COLUMN_GAP - 2) / FIELD_MAX_STACK_BACKS)
const FX_DURATION_MS = 520
const FIELD_SHIFT_MS = 240
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

const rarityColors = tricksRarityColors

function cardTextFontSize(text) {
    const length = Array.from(text || "").length
    if (length <= 140) return 14
    if (length <= 200) return 12
    return 10
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

// 手札・デッキ領域の上端Y座標を返す。
function handAreaTop(height) {
    return height - HAND_AREA_HEIGHT + HAND_AREA_DROP
}

// 切り札スクロール領域の下端Y座標を返す。
function fieldViewportBottom(height, handVisible = true) {
    return handVisible ? handAreaTop(height) - 24 : height
}

// 画面幅から切り札の列数を計算する。
function fieldColumnCount(width) {
    const availableWidth = Math.max(FIELD_CARD_WIDTH, width - FIELD_SIDE_MARGIN * 2)
    return Math.max(1, Math.floor((availableWidth + FIELD_COLUMN_GAP) / (FIELD_CARD_WIDTH + FIELD_COLUMN_GAP)))
}

// 切り札領域の最大スクロール量を計算する。
function fieldMaxScroll(width, height, count, handVisible = true, startY = FIELD_START_Y) {
    if (count <= 0) return 0
    const rows = Math.ceil(count / fieldColumnCount(width))
    const contentBottom = startY + (rows - 1) * FIELD_ROW_GAP + FIELD_CARD_HEIGHT

    return Math.max(0, contentBottom - fieldViewportBottom(height, handVisible) + 24)
}

// 切り札カードの表示座標を計算する。
function fieldLayout(index, scrollY = 0, width = 0, startY = FIELD_START_Y) {
    const columns = fieldColumnCount(width)

    return {
        x: FIELD_SIDE_MARGIN + (index % columns) * (FIELD_CARD_WIDTH + FIELD_COLUMN_GAP),
        y: startY + Math.floor(index / columns) * FIELD_ROW_GAP - scrollY,
        angle: 0,
    }
}

// デッキを擬似カードとして扱うための座標を返す。
function deckLayout(height) {
    return {
        x: 24,
        y: height - HAND_CARD_HEIGHT - 54 + HAND_AREA_DROP,
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
        ...ids.filter((id) => !currentOrder.includes(id)),
        ...currentOrder.filter((id) => ids.includes(id)),
    ]
}

// 切り札の目標表示順を算出する。
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
                transparent: true,
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
export function TricksDomCard({
    card,
    type,
    layout = {x: 0, y: 0},
    usersById,
    selected,
    disabled,
    hidden,
    motionStyle,
    motionType,
    nowValue,
    onClick,
    staticLayout = false,
    showStackBacks = true,
    footerLabel,
    footerValue,
    holderLabel,
}) {
    const iconTitleId = useId()
    const rarity = Number(card?.rarity || 1)
    const isField = type === "field"
    const stackCount = Math.max(Number(card?.stack_count || 1), 1)
    const stackBacks = isField && showStackBacks ? Math.min(Math.max(stackCount - 1, 0), FIELD_MAX_STACK_BACKS) : 0
    const width = isField ? FIELD_CARD_WIDTH : HAND_CARD_WIDTH
    const height = isField ? FIELD_CARD_HEIGHT : HAND_CARD_HEIGHT
    const borderColor = rarityColors[rarity] || rarityColors[1]
    const rewardPoints = Number(footerValue ?? card.live_total_reward ?? 0)
    const expired = isField && !staticLayout && isTricksCardLimitExpired(card, nowValue)

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (!disabled) onClick?.(event)
            }}
            data-tricks-card-id={card.id}
            data-tricks-motion={motionType}
            className={`tricks-dom-card tricks-dom-card-${type} rarity-${rarity}${selected ? " is-selected" : ""}${expired ? " is-expired" : ""}`}
            style={{
                position: staticLayout ? "relative" : "absolute",
                left: 0,
                top: 0,
                width,
                height,
                transform: staticLayout ? "none" : cardTransform(layout),
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
            <TricksCardBorder rarity={rarity} cardId={card.id} active={!hidden} hoverOnly={staticLayout} />
            <span className="tricks-dom-card-face">
                <span className="tricks-dom-card-meta">
                    <TricksCardIdentity card={card} isField={isField} />
                    <span>★{card.difficulty ?? "-"} {rarityLabels[rarity] || `R${rarity}`}</span>
                </span>
                <span className="tricks-dom-card-title">{shortenTricksText(card.title || "Untitled", isField ? 22 : 18)}</span>
                <span className="tricks-dom-card-rule">{shortenTricksText(card.rule_name || "", isField ? 28 : 20)}</span>
                <span className="tricks-dom-card-text" style={{fontSize: cardTextFontSize(card.text)}}>{card.text || ""}</span>
                {isField && (
                    <>
                        <span className="tricks-dom-card-users">
                            <span className="tricks-dom-card-user tricks-dom-card-creator" title={card.creator || "-"}><FontAwesomeIcon icon={faUserPen} /> {shortenTricksText((card.creator || "-"), 12)}</span>
                            <span className="tricks-dom-card-user tricks-dom-card-taker"><FontAwesomeIcon icon={faShareFromSquare} /><span style={{minWidth: 0, overflow: "hidden", textOverflow: "ellipsis"}}>{shortenTricksText(displayName(usersById, card.taker), 10)}</span></span>
                            {holderLabel && <span className="tricks-dom-card-user tricks-dom-card-holder" data-tricks-card-holder><FontAwesomeIcon icon={faMedal} title="ホルダー" titleId={`${iconTitleId}-holder`} aria-label="ホルダー" /> {shortenTricksText(holderLabel, 18)}</span>}
                        </span>
                        <span className="tricks-dom-card-footer">
                            <span>{footerLabel ?? cardLimitLabel(card, nowValue)}</span>
                            {!footerLabel && (card.my_has_record || (!expired && card.my_can_post && card.my_initial_post_cost === 0)) && (
                                <span className="tricks-dom-post-status" style={{display: "inline-flex", alignItems: "center", gap: 4, width: "5em", flexShrink: 0, marginLeft: "auto", marginRight: 6, color: "#237a39", fontWeight: 700, whiteSpace: "nowrap"}}>
                                    {card.my_has_record ? (
                                        <span data-tricks-posted><FontAwesomeIcon icon={faCheck} aria-hidden="true" /> 投稿済み</span>
                                    ) : (
                                        <span data-tricks-free style={{marginLeft: "auto"}}>無料！</span>
                                    )}
                                </span>
                            )}
                            <span className="tricks-dom-stack" style={{color: rewardColor(rewardPoints), fontSize: rewardPoints >= 100 ? "calc(17px - 1pt)" : undefined}} title={footerLabel ? undefined : "総還元P"} aria-label={footerLabel ? undefined : `総還元P ${card.live_total_reward ?? 0}`}>
                                <span className="tricks-dom-stack-value">{footerValue ?? card.live_total_reward ?? 0}</span>
                            </span>
                        </span>
                    </>
                )}
                {!isField && (
                    <span className="tricks-dom-card-footer">
                        <span className="tricks-dom-card-user tricks-dom-card-creator" title={(card.creator || "-")}><FontAwesomeIcon icon={faUserPen} /> {shortenTricksText((card.creator || "-"), 12)}</span>
                        {card.was_opened && (
                            <span className="tricks-opened-history" data-tricks-opened style={{marginLeft: "auto", flexShrink: 0}}>
                                <FontAwesomeIcon icon={faSquareCheck} /> 開封済み
                            </span>
                        )}
                    </span>
                )}
                {expired && <span className="tricks-dom-card-expired">回収待ち</span>}
            </span>
        </button>
    )
}

// クリエイト元ステージのシリーズを、カード番号と並べて表示する。
function TricksCardIdentity({card, isField = false}) {
    const {t: locale} = useLocale()
    const series = Math.floor(Number(card.origin_stage_id) / 100)
    const label = series >= 1 && series <= 4 && locale.title[series]
    const id = isField ? (card.stage_id || card.card_id || card.id) : (card.card_id || card.id)

    return (
        <span style={{display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"}}>
            <span>#{id || "-"}</span>
            {label && <span data-tricks-series={series} style={{borderRadius: 999, padding: "1px 5px", background: `var(--series-theme-${series})`, color: "#141923", fontSize: 10, lineHeight: 1.3}}>{label}</span>}
        </span>
    )
}

function rewardColor(points) {
    if (points <= 5) return "#d1d1d1"
    if (points <= 10) return "#ffffff"
    if (points <= 15) return "#97e0ff"
    if (points <= 20) return "#5b9fff"
    if (points <= 30) return "#a794ff"
    if (points <= 50) return "#df76fd"
    if (points <= 99) return "#fb7272"
    return "#ffb56c"
}

// デッキDOMを表示する。
function TricksDeck({layout, size, usersById, deckCount, deckDifficultyCounts, deckSeriesCounts, deckCreatorCounts, trashCount, disabled, disabledReason, handVisible, spectatorMode, onExitSpectator, onDraw, onToggleHand, onShowHowToPlay}) {
    const [open, setOpen] = useState(true)
    const [spectatorCommandOpen, setSpectatorCommandOpen] = useState(false)
    useEffect(() => setSpectatorCommandOpen(false), [spectatorMode])
    const commandOpen = spectatorMode ? spectatorCommandOpen : open
    const [tooltipOpen, setTooltipOpen] = useState(false)
    const deckRef = useRef(null)
    const tooltipRef = useRef(null)

    useEffect(() => {
        if (!handVisible) setTooltipOpen(false)
    }, [handVisible])

    useEffect(() => {
        if (!tooltipOpen) return
        const closeOutside = (event) => {
            if (!deckRef.current?.contains(event.target) && !tooltipRef.current?.contains(event.target)) {
                setTooltipOpen(false)
            }
        }
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setTooltipOpen(false)
        }
        document.addEventListener("pointerdown", closeOutside, true)
        document.addEventListener("keydown", closeOnEscape)
        return () => {
            document.removeEventListener("pointerdown", closeOutside, true)
            document.removeEventListener("keydown", closeOnEscape)
        }
    }, [tooltipOpen])

    return (
        <>
            <button ref={deckRef} type="button" className="tricks-dom-deck tricks-deck-object" aria-label={`デッキ 残り${deckCount ?? 0}枚`} aria-hidden={!handVisible} tabIndex={handVisible ? 0 : -1} aria-expanded={tooltipOpen} aria-controls="tricks-deck-tooltip" onClick={() => setTooltipOpen(true)} style={{position: "absolute", left: 0, top: 0, width: HAND_CARD_WIDTH, height: HAND_CARD_HEIGHT, transform: cardTransform({...layout, y: layout.y + (handVisible ? 0 : size.height)}), transition: "transform 240ms ease", zIndex: layout.zIndex, pointerEvents: handVisible ? "auto" : "none", cursor: "pointer", boxShadow: "5px -5px 0 #32435e, 10px -10px 0 #182338, 15px -15px 0 #32435e"}}>
                <div className="tricks-deck-pattern" />
            </button>
            {tooltipOpen && handVisible && (
                <div ref={tooltipRef} id="tricks-deck-tooltip" className="tricks-deck-tooltip" role="tooltip" aria-label="デッキ情報" style={{position: "absolute", left: Math.max(16, Math.min(layout.x + HAND_CARD_WIDTH + 24, size.width - 576)), top: Math.max(16, Math.min(layout.y, size.height - 310)), width: 560, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)", overflow: "auto", boxSizing: "border-box", zIndex: 450, pointerEvents: "auto", padding: "12px 16px", border: "1px solid var(--color-border-base)", borderRadius: 8, background: "var(--color-bg-base)", color: "var(--color-text-base)", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)", fontSize: 16, lineHeight: 1.8, whiteSpace: "nowrap"}}>
                    <strong style={{display: "block", marginBottom: 8}}>デッキ 残り{deckCount ?? 0}枚</strong>
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 24, minWidth: 450}}>
                        <div data-tricks-deck-difficulty>
                            <strong>難易度別</strong>
                            {[1, 2, 3, 4, 5].map((difficulty) => <div key={difficulty}>★{difficulty}：{deckDifficultyCounts[difficulty] ?? 0}枚</div>)}
                        </div>
                        <div data-tricks-deck-series>
                            <strong>シリーズ別</strong>
                            {[1, 2, 3, 4].map((series) => <div key={series}>ピクミン{series}：{deckSeriesCounts[series] ?? 0}枚</div>)}
                            {Number(deckSeriesCounts[0]) > 0 && <div>その他：{deckSeriesCounts[0]}枚</div>}
                        </div>
                        <div data-tricks-deck-creators>
                            <strong>クリエイター上位5名</strong>
                            {deckCreatorCounts.map(({creator, count}) => <div key={creator} style={{whiteSpace: "normal", overflowWrap: "anywhere"}}>{creator}：{count}枚</div>)}
                            {deckCreatorCounts.length === 0 && <div>なし</div>}
                        </div>
                    </div>
                </div>
            )}
            <aside className="tricks-command-window" style={{position: "absolute", left: 0, bottom: handVisible ? HAND_CARD_HEIGHT + 54 - HAND_AREA_DROP + 24 : 0, zIndex: 140, display: "flex", pointerEvents: "auto", transform: commandOpen ? "translateX(0)" : "translateX(calc(-100% + 44px))", transition: "transform 240ms ease", maxWidth: "100vw"}}>
                <div id="tricks-command-body" className="tricks-command-body" style={{visibility: commandOpen ? "visible" : "hidden", transition: commandOpen ? "visibility 0s" : "visibility 0s 240ms"}}>
                    <button type="button" disabled={disabled} title={disabledReason} onClick={onDraw}>ドロー</button>
                    <button type="button" data-tricks-hand-toggle onClick={spectatorMode ? onExitSpectator : onToggleHand}>{spectatorMode ? "観戦モードを終了" : handVisible ? "手札非表示" : "手札を表示"}</button>
                    <button type="button" data-tricks-how-to-play onClick={onShowHowToPlay}>遊び方</button>
                    {disabledReason && <div className="tricks-dom-deck-reason">{disabledReason}</div>}
                </div>
                <button className="tricks-command-toggle" type="button" aria-expanded={commandOpen} aria-controls="tricks-command-body" onClick={() => spectatorMode ? setSpectatorCommandOpen((value) => !value) : setOpen((value) => !value)}>コマンド</button>
            </aside>
        </>
    )
}

// デッキ上で表返り、静止後に手札へ移動するゴーストカードを表示する。
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
                <TricksCardBorder rarity={rarity} cardId={card.id} active={false} />
                <span className="tricks-dom-card-face tricks-dom-draw-face">
                    <span className="tricks-dom-card-meta">
                        <TricksCardIdentity card={card} />
                        <span>★{card.difficulty || 1} {rarityLabels[rarity] || `R${rarity}`}</span>
                    </span>
                    <span className="tricks-dom-card-title">{shortenTricksText(card.title || "Untitled", 18)}</span>
                    <span className="tricks-dom-card-rule">{shortenTricksText(card.rule_name || "", 20)}</span>
                    <span className="tricks-dom-card-text" style={{fontSize: cardTextFontSize(card.text)}}>{card.text || ""}</span>
                    <span className="tricks-dom-card-footer">
                        <span className="tricks-dom-card-creator" title={card.creator || "-"} style={{minWidth: 0, overflow: "hidden", whiteSpace: "nowrap"}}><FontAwesomeIcon icon={faUserPen} /> {shortenTricksText(card.creator || "-", 12)}</span>
                        {card.was_opened && <span className="tricks-opened-history" data-tricks-opened style={{marginLeft: "auto", flexShrink: 0}}><FontAwesomeIcon icon={faSquareCheck} /> 開封済み</span>}
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
    fieldTop,
    fieldTopClip,
    fieldBottom,
    onExitSpectator,
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
    handVisible,
    spectatorMode,
    onToggleHand,
    onShowHowToPlay,
    nowValue,
}) {
    const fieldById = useMemo(() => new Map((view.field || []).map((card) => [card.id, card])), [view.field])
    const orderedField = fieldOrder.map((id) => fieldById.get(id)).filter((card) => card && card.id !== takingMotion?.card?.id)
    const reservedFieldSlots = takingMotion ? 1 : 0
    const selectedHandId = selectedHand?.id
    const selectedHandStackBonus = selectedHand ? tricksStackBonus(selectedHand.rarity, view.hand.length) : 0
    const selectedFieldIndex = orderedField.findIndex((card) => card.id === selectedFieldId)
    const selectedFieldCard = selectedFieldIndex >= 0 ? orderedField[selectedFieldIndex] : null
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
                    clipPath: `inset(${fieldTopClip}px 0 ${Math.max(0, size.height - fieldBottom)}px 0)`,
                    pointerEvents: "none",
                }}
            >
                {Array.from({length: Math.max(operation.fieldCap || 0, orderedField.length + reservedFieldSlots)}, (_, index) => {
                    const slot = fieldLayout(index, fieldScrollY, size.width, fieldTop)
                    if (slot.y + FIELD_CARD_HEIGHT < fieldTopClip || slot.y > fieldBottom + 48) return null
                    const slotCard = orderedField[index - reservedFieldSlots]
                    const slotBorder = Number(slotCard?.rarity) >= 3 ? "transparent" : "var(--color-border-base)"
                    return <div key={index} className="tricks-field-slot" style={{position: "absolute", left: slot.x, top: slot.y, width: FIELD_CARD_WIDTH, height: FIELD_CARD_HEIGHT, boxSizing: "border-box", border: `1px solid ${slotBorder}`, borderRadius: 18, background: "color-mix(in srgb, var(--color-bg-base) 50%, transparent)", color: "var(--color-text-sub)"}}><span className="tricks-field-slot-number" style={{position: "absolute", right: 10, top: 6}}>{index + 1}</span></div>
                })}
                {orderedField.map((card, index) => {
                    const base = fieldLayout(index + reservedFieldSlots, fieldScrollY, size.width, fieldTop)
                    const previousBase = fieldLayout(index, fieldScrollY, size.width, fieldTop)
                    const visible = (base.y + FIELD_CARD_HEIGHT >= fieldTopClip
                        && base.y <= fieldBottom + 48)
                        || (takingMotion && previousBase.y + FIELD_CARD_HEIGHT >= fieldTopClip
                            && previousBase.y <= fieldBottom + 48)
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
                            selected={false}
                            hidden={selectedFieldId === card.id}
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
                    deckDifficultyCounts={view.deckDifficultyCounts}
                    deckSeriesCounts={view.deckSeriesCounts}
                    deckCreatorCounts={view.deckCreatorCounts}
                    usersById={usersById}
                    size={size}
                    trashCount={view.trashCount}
                    disabled={busy || (!spectatorMode && !operation.canDraw)}
                    disabledReason={operation.drawReason}
                    onDraw={onDraw}
                    handVisible={handVisible && !spectatorMode}
                    spectatorMode={spectatorMode}
                    onExitSpectator={onExitSpectator}
                    onToggleHand={onToggleHand}
                    onShowHowToPlay={onShowHowToPlay}
                />
            )}
            {!spectatorMode && <DrawGhost motion={drawMotion} />}
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
                        y: home.y + (handVisible && !spectatorMode ? 0 : size.height),
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
                        disabled={busy || !handVisible || spectatorMode}
                        nowValue={nowValue}
                        onClick={() => onSelectHand(card)}
                    />
                )
            })}
            {!spectatorMode && takingMotion && (
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
                    motionType="take"
                    motionStyle={{
                        transform: takingMotion.phase === "prepare" ? cardTransform(takingMotion.from) : undefined,
                        offsetPath: takingMotion.phase === "flight" ? `path("${takingMotion.path}")` : undefined,
                        offsetAnchor: "0 0",
                        offsetRotate: "0deg",
                        animation: takingMotion.phase === "flight" ? `tricksTakePlace ${CARD_MOTION_MS}ms linear forwards` : undefined,
                    }}
                />
            )}
            {!spectatorMode && returningMotion && (
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
            {selectedFieldId && !selectedHand && (
                <button
                    type="button"
                    data-tricks-card-backdrop="field"
                    aria-label="切り札詳細を閉じる"
                    onClick={() => onSelectField?.(null)}
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 280,
                        border: 0,
                        background: "transparent",
                        pointerEvents: "auto",
                    }}
                />
            )}
            {selectedFieldCard && !selectedHand && (
                <TricksDomCard
                    card={selectedFieldCard}
                    type="field"
                    layout={{
                        ...fieldLayout(selectedFieldIndex + reservedFieldSlots, fieldScrollY, size.width, fieldTop),
                        zIndex: 330,
                    }}
                    usersById={usersById}
                    selected
                    disabled
                    nowValue={nowValue}
                />
            )}
            {selectedHand && (
                <>
                    <button
                        type="button"
                        data-tricks-card-backdrop="hand"
                        aria-label="手札詳細を閉じる"
                        onClick={onCancelHand}
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 280,
                            border: 0,
                            background: "transparent",
                            pointerEvents: "auto",
                        }}
                    />
                    <div
                        data-tricks-hand-actions
                        style={{
                            position: "absolute",
                            left: size.width / 2 + HAND_CARD_WIDTH / 2 + 16,
                            top: selectedHandLayout(size.width, size.height).y + 78,
                            display: "grid",
                            gap: 14,
                            padding: 16,
                            borderRadius: 10,
                            background: "rgba(0, 0, 0, 0.7)",
                            zIndex: 320,
                            pointerEvents: "auto",
                        }}
                    >
                        <div
                            data-tricks-take-summary
                            style={{
                                maxWidth: 220,
                                color: "#ffffff",
                                fontSize: 14,
                                fontWeight: 800,
                                lineHeight: 1.5,
                                textAlign: "center",
                            }}
                        >
                            <div>投稿コスト {Math.max(1, Number(selectedHand.difficulty || 1))}P</div>
                            <div data-tricks-take-stack-count>トリック {view.hand.length + selectedHandStackBonus}</div>
                            {selectedHandStackBonus > 0 && <div data-tricks-take-stack-bonus>（レア度ボーナス {selectedHandStackBonus}）</div>}
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
                            デッキに戻す
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
    spectatorMode = false,
    headerBottom = HEADER_HEIGHT,
    onExitSpectator,
    onRequestSpectatorExit,
    state,
    selectedFieldId,
    usersById = {},
    sortTick = 0,
    onDraw,
    onTake,
    onReturnToDeck,
    onSelectField,
    onFieldSortingChange,
    onHandSelectionChange,
    onShowHowToPlay,
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
    const [handVisible, setHandVisible] = useState(true)
    const visibleHand = handVisible && !spectatorMode
    const fieldTopClip = spectatorMode ? headerBottom : HEADER_HEIGHT
    const fieldTop = spectatorMode ? headerBottom + 16 : FIELD_START_Y
    const fieldBottom = fieldViewportBottom(size.height, visibleHand)
    const [fxBurst, setFxBurst] = useState(null)
    const [drawMotion, setDrawMotion] = useState(null)
    const [takingMotion, setTakingMotion] = useState(null)
    const [returningMotion, setReturningMotion] = useState(null)
    const motionTimersRef = useRef(new Set())
    useEffect(() => {
        if (spectatorMode) setSelectedHand(null)
        setHandVisible(!spectatorMode)
    }, [spectatorMode])
    useEffect(() => setFieldScrollY(0), [fieldTop, visibleHand])
    const fieldMotionActive = Boolean(takingMotion)
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
        setFieldOrder((current) => {
            const next = targetFieldOrder(view.field, syncCardOrder(current, view.field), nowValue)
            return current.length === next.length && current.every((id, index) => id === next[index]) ? current : next
        })
    }, [fieldIdsKey, nowValue, sortTick, view.field])

    useEffect(() => {
        setFieldScrollY((current) => Math.max(0, Math.min(
            current,
            fieldMaxScroll(size.width, size.height, Math.max(view.field?.length || 0, operation.fieldCap || 0), visibleHand, fieldTop)
        )))
    }, [size.height, size.width, view.field, operation.fieldCap, visibleHand, fieldTop])

    const handleWheel = useCallback((event) => {
        if (selectedHand || selectedFieldId || takingMotion) return
        const text = event.target.closest?.(".tricks-dom-card-text")
        if (text && text.scrollHeight > text.clientHeight) {
            const canScrollUp = event.deltaY < 0 && text.scrollTop > 0
            const canScrollDown = event.deltaY > 0 && text.scrollTop + text.clientHeight < text.scrollHeight - 1
            if (canScrollUp || canScrollDown) return
        }
        const rect = rootRef.current?.getBoundingClientRect()
        if (!rect) return
        const y = event.clientY - rect.top
        if (y < fieldTopClip || y > fieldBottom) return
        const maxScroll = fieldMaxScroll(size.width, size.height, Math.max(view.field?.length || 0, operation.fieldCap || 0), visibleHand, fieldTop)
        if (maxScroll <= 0) return
        event.preventDefault()
        setFieldScrollY((current) => Math.max(0, Math.min(maxScroll, current + event.deltaY)))
    }, [selectedFieldId, selectedHand, takingMotion, size.height, size.width, view.field, operation.fieldCap, visibleHand, fieldTop, fieldTopClip, fieldBottom])

    useEffect(() => {
        const root = rootRef.current
        if (!root) return undefined
        root.addEventListener("wheel", handleWheel, {passive: false})
        return () => root.removeEventListener("wheel", handleWheel)
    }, [handleWheel])

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
        if (spectatorMode) {
            onRequestSpectatorExit?.()
            return
        }
        if (!operation.canDraw || interactionBusy) return
        let motionStarted = false
        const result = await onDraw?.((drawResult) => {
            motionStarted = beginDrawMotion(drawResult)
        })
        if (!motionStarted) beginDrawMotion(result)
    }, [beginDrawMotion, interactionBusy, onDraw, operation.canDraw, spectatorMode, onRequestSpectatorExit])

    const beginTakeMotion = useCallback((card, result) => {
        const popupElement = rootRef.current?.querySelector(".tricks-dom-card-hand.is-selected")
        const popup = popupElement?.getBoundingClientRect()
        const layer = popupElement?.offsetParent?.getBoundingClientRect()
        const start = layer && popup
            ? {x: popup.left - layer.left, y: popup.top - layer.top, angle: 0}
            : selectedHandLayout(size.width, size.height)
        const target = fieldLayout(0, 0, size.width)
        const id = `take-${card.id}-${Date.now()}`
        const arcHeight = Math.min(170, Math.max(80, Math.abs(start.y - target.y) * 0.4))
        const control = {
            x: (start.x + target.x) / 2,
            y: (start.y + target.y) / 2 - 2 * arcHeight,
        }
        setFieldScrollY(0)
        setSelectedHand(null)
        setTakingMotion({
            id,
            phase: "prepare",
            card: result?.card || card,
            from: start,
            path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`,
            to: target,
        })
        // Existing field cards finish shifting before the selected card takes off.
        scheduleMotionEnd(() => {
            setTakingMotion((current) => current?.id === id ? {...current, phase: "flight"} : current)
            scheduleMotionEnd(() => {
                setTakingMotion((current) => current?.id === id ? null : current)
            })
        }, FIELD_SHIFT_MS + 32)
    }, [scheduleMotionEnd, size.height, size.width])

    const handleTake = useCallback(async (card) => {
        if (!operation.canTake || interactionBusy) return
        let motionStarted = false
        const result = await onTake?.(card, (takeResult) => {
            motionStarted = true
            beginTakeMotion(card, takeResult)
        })
        if (result && !motionStarted) beginTakeMotion(card, result)
    }, [beginTakeMotion, interactionBusy, onTake, operation.canTake])

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
        onFieldSortingChange?.(fieldMotionActive)
        return () => onFieldSortingChange?.(false)
    }, [onFieldSortingChange, fieldMotionActive])

    useEffect(() => {
        onHandSelectionChange?.(Boolean(selectedHand))

        return () => onHandSelectionChange?.(false)
    }, [onHandSelectionChange, selectedHand])

    const toggleHand = useCallback(() => {
        setSelectedHand(null)
        setHandVisible((visible) => !visible)
    }, [])

    return (
        <div
            ref={rootRef}
            data-tricks-game-layer
            data-tricks-take-phase={takingMotion?.phase}
            style={{
                position: "absolute",
                inset: 0,
                // フォーカス移動によるネイティブスクロールでカード座標がずれないようにする。
                overflow: "clip",
                zIndex: selectedHand || selectedFieldId ? 30 : 0,
            }}
        >
            <PhaserBaseLayer state={state} size={size} />
            <FxLayer burst={fxBurst} />
            <DomCardsLayer
                view={view}
                size={size}
                usersById={usersById}
                selectedHand={spectatorMode ? null : selectedHand}
                selectedFieldId={selectedFieldId}
                fieldScrollY={fieldScrollY}
                fieldOrder={fieldOrder}
                fieldTop={fieldTop}
                fieldTopClip={fieldTopClip}
                fieldBottom={fieldBottom}
                onExitSpectator={onExitSpectator}
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
                spectatorMode={spectatorMode}
                handVisible={handVisible}
                onToggleHand={toggleHand}
                onShowHowToPlay={onShowHowToPlay}
                nowValue={nowValue}
            />
            <TricksCardBorderStyles />
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
                    border-radius: 18px;
                    background: #e4e8ef;
                    border: 10px solid #8994a8;
                }
                .tricks-dom-card-back:nth-child(even) {
                    background: #f2f4f8;
                    border-color: #718097;
                }
                .tricks-dom-card-face {
                    border-radius: 18px;
                    display: grid;
                    grid-template-rows: auto auto auto minmax(0, 1fr) auto;
                    gap: 8px;
                    padding: 16px;
                    overflow: hidden;
                    background: #ffffff;
                    color: #141923;
                    border: 10px solid var(--card-border);
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.26);
                }
                .tricks-dom-card:is(.rarity-3, .rarity-4, .rarity-5) .tricks-dom-card-face {
                    border-color: transparent;
                }
                .tricks-dom-card-field .tricks-dom-card-face {
                    padding: 10px;
                    gap: 5px;
                    grid-template-rows: auto auto auto minmax(0, 1fr) auto auto;
                }
                .tricks-dom-card.is-selected .tricks-dom-card-face {
                    filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.34));
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
                .tricks-opened-history {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    color: #808080;
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
                    line-height: 1.3;
                    min-height: 0;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    overflow: auto;
                }
                .tricks-dom-card-field .tricks-dom-card-text {
                    line-height: 1.2;
                }
                .tricks-dom-card-users {
                    border-top: 1px solid #d5dae2;
                    padding-top: 10px;
                    font-size: 12px;
                    font-weight: 600;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 6px 10px;
                }
                .tricks-dom-card-user {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-width: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }
                .tricks-dom-card-creator {
                    color: #667085;
                    font-size: 12px;
                    font-weight: 600;
                }
                .tricks-dom-card-user svg { flex-shrink: 0; }
                .tricks-dom-card-taker { grid-column: 2; justify-content: flex-end; text-align: right; }
                .tricks-dom-card-holder { grid-column: 1 / -1; }
                .tricks-dom-card-footer {
                    align-items: center;
                    color: #9a5f00;
                    font-size: 14px;
                }
                .tricks-dom-card-footer > :first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                .tricks-dom-stack {
                    display: inline-grid;
                    place-items: center;
                    min-width: 36px;
                    height: 36px;
                    border-radius: 999px;
                    background: #000000;
                    color: #ffffff;
                    border: 0;
                    font-size: 17px;
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
                .tricks-dom-card-field .tricks-dom-card-face { background: #ffffff; }
                .tricks-dom-card.rarity-5 .tricks-dom-card-face {
                    background: rgba(255, 255, 255, .9);
                    background-clip: padding-box;
                    border-color: transparent;
                    z-index: 1;
                }
                .tricks-dom-card-field .tricks-dom-card-title,
                .tricks-dom-card-field .tricks-dom-card-rule,
                .tricks-dom-card-field .tricks-dom-card-text { color: #141923; }
                .tricks-dom-card-field .tricks-dom-card-meta,
                .tricks-dom-card-field .tricks-dom-card-users,
                .tricks-dom-card-field .tricks-dom-card-footer { color: #667085; }
                .tricks-command-body { padding: 12px; background: var(--color-bg-base); border: 1px solid var(--color-border-base); display: grid; gap: 4px; width: 220px; box-sizing: border-box; }
                .tricks-command-toggle { width: 44px; border: 1px solid var(--color-border-base); border-radius: 0 8px 8px 0; background: var(--color-bg-base); color: var(--color-text-base); writing-mode: vertical-rl; cursor: pointer; }
                .tricks-deck-pattern,
                .tricks-dom-draw-back::after {
                    position: absolute;
                    inset: 0;
                    border: 0;
                    border-radius: 8px;
                    background: repeating-linear-gradient(45deg, transparent 0 12px, rgba(131, 154, 226, .32) 12px 14px), repeating-linear-gradient(-45deg, transparent 0 12px, rgba(88, 114, 196, .22) 12px 14px), linear-gradient(135deg, #253b80, #172451 55%, #233771);
                }
                .tricks-dom-deck[hidden] { display: none; }
                @media (max-width: 480px) {
                    .tricks-deck-tooltip {
                        transform: translateX(-8px);
                        padding: 10px 8px !important;
                        font-size: 14px !important;
                    }
                }
                .tricks-dom-deck {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 16px 12px 0;
                    border-radius: 18px;
                    background: #172451;
                    border: 10px solid ${rarityColors[1]};
                    box-sizing: border-box;
                    color: #141923;
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
                    background: #172451;
                    border: 10px solid ${rarityColors[1]};
                    box-shadow: 0 20px 42px rgba(0, 0, 0, 0.34);
                }
                .tricks-dom-draw-back::after {
                    content: "";
                    position: absolute;

                }
                .tricks-dom-draw-face {
                    transform: rotateY(0deg);
                }
                .tricks-dom-deck-title {
                    font-size: 24px;
                    font-weight: 800;
                }
                .tricks-command-body button,
                .tricks-hand-action {
                    border: 1px solid var(--color-border-base);
                    border-radius: 8px;
                    background: color-mix(in srgb, var(--color-bg-base) 80%, var(--color-page-main));
                    color: var(--color-text-base);
                    min-width: 128px;
                    min-height: 44px;
                    padding: 0 18px;
                    font-size: 16px;
                    font-weight: 800;
                    cursor: pointer;
                }
                .tricks-command-body button {
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
                    color: var(--color-text-sub);
                    font-size: 11px;
                    line-height: 1.3;
                    text-align: center;
                }
                .tricks-command-body button:disabled,
                .tricks-hand-action:disabled {
                    cursor: not-allowed;
                    opacity: 0.45;
                }
                .tricks-hand-action {
                    background: var(--color-bg-base);
                    color: var(--color-text-base);
                    border-color: var(--color-border-base);
                }
                .tricks-command-body button,
                .tricks-hand-action-take {
                    background: #1976d2;
                    color: #ffffff;
                    border-color: #1565c0;
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
                .tricks-dom-card-field {
                    transition: none;
                }
                [data-tricks-take-phase="prepare"] .tricks-dom-card-field {
                    transition: transform ${FIELD_SHIFT_MS}ms ease;
                }
                .tricks-dom-card[data-tricks-motion="take"] {
                    transition: none;
                    transform-origin: center center;
                    will-change: transform;
                }
                @keyframes tricksTakePlace {
                    0% {
                        offset-distance: 0%;
                        transform: perspective(900px) translateZ(0) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
                    }
                    25% {
                        offset-distance: 25%;
                        transform: perspective(900px) translateZ(45px) rotateX(-12deg) rotateY(8deg) rotateZ(-4deg);
                    }
                    50% {
                        offset-distance: 50%;
                        transform: perspective(900px) translateZ(60px) rotateX(-18deg) rotateY(12deg) rotateZ(-6deg);
                    }
                    75% {
                        offset-distance: 75%;
                        transform: perspective(900px) translateZ(45px) rotateX(-12deg) rotateY(8deg) rotateZ(-4deg);
                    }
                    100% {
                        offset-distance: 100%;
                        transform: perspective(900px) translateZ(0) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
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
