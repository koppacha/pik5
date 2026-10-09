import {useEffect, useRef} from "react"

const watchedBorders = new Map()
let borderObserver = null

function updateBorder(node, entry) {
    node.dataset.borderActive = String(entry.enabled && entry.visible && !document.hidden)
}

function publishBorderMetrics() {
    window.__TRICKS_BORDER_METRICS__ = {
        observed: watchedBorders.size,
        eligible: [...watchedBorders.keys()].filter((node) => node.dataset.borderActive === "true").length,
        visibilityListeners: borderObserver ? 1 : 0,
    }
}

function updateTabVisibility() {
    watchedBorders.forEach((entry, node) => updateBorder(node, entry))
    publishBorderMetrics()
}

function observeBorder(node, enabled) {
    if (!borderObserver) {
        borderObserver = new IntersectionObserver((entries) => {
            entries.forEach(({target, isIntersecting}) => {
                const entry = watchedBorders.get(target)
                if (!entry) return
                entry.visible = isIntersecting
                updateBorder(target, entry)
            })
            publishBorderMetrics()
        })
        document.addEventListener("visibilitychange", updateTabVisibility)
    }
    const entry = {enabled, visible: false}
    watchedBorders.set(node, entry)
    updateBorder(node, entry)
    borderObserver.observe(node)
    publishBorderMetrics()

    return () => {
        borderObserver?.unobserve(node)
        watchedBorders.delete(node)
        if (!watchedBorders.size) {
            borderObserver?.disconnect()
            borderObserver = null
            document.removeEventListener("visibilitychange", updateTabVisibility)
        }
        publishBorderMetrics()
    }
}

export default function TricksCardBorder({rarity = 1, cardId = 0, active = true, hoverOnly = false, mini = false}) {
    const ref = useRef(null)
    const level = Math.min(5, Math.max(1, Number(rarity) || 1))
    const delay = -((Number(cardId) || 0) % 997) / 997 * 12

    useEffect(() => {
        if (mini || level < 3 || !ref.current) return undefined
        return observeBorder(ref.current, active)
    }, [active, level, mini])

    return (
        <span
            ref={ref}
            className="tricks-card-border"
            aria-hidden="true"
            data-rarity={level}
            data-border-mode={hoverOnly ? "hover" : "always"}
            data-border-mini={mini || undefined}
            style={{"--border-delay": `${delay.toFixed(3)}s`}}
        >
            {!mini && level >= 3 && level < 5 && <span className="tricks-border-flow" />}
            {!mini && level === 5 && (
                <>
                    <span className="tricks-legendary-current" />
                    <span className="tricks-legendary-refraction" />
                    <span className="tricks-legendary-caustics" />
                    <span className="tricks-legendary-light" />
                </>
            )}
        </span>
    )
}

export function TricksCardBorderStyles() {
    return <style jsx global>{`
        :root { --tricks-edge-common: #808080; --tricks-edge-uncommon: #262626; }
        .tricks-card-border {
            position: absolute;
            inset: 0;
            padding: 10px;
            border-radius: 18px;
            box-sizing: border-box;
            pointer-events: none;
            overflow: hidden;
            z-index: 2;
            background: var(--card-border);
            mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            mask-composite: exclude;
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
        }
        .tricks-dom-draw-flipper > .tricks-card-border { backface-visibility: hidden; transform: rotateY(0deg); }
        .tricks-card-border[data-border-mini] { inset: -2px; padding: 2px; border-radius: 2px; }
        .tricks-card-border[data-rarity="1"] { background: var(--tricks-edge-common); }
        .tricks-card-border[data-rarity="2"] {
            background-color: var(--tricks-edge-uncommon);
            background-image: repeating-linear-gradient(45deg, transparent 0 4px, rgba(225,225,225,.22) 4px 5px), repeating-linear-gradient(-45deg, transparent 0 4px, rgba(225,225,225,.22) 4px 5px);
        }
        .tricks-card-border[data-rarity="3"] { background: #1976d2; }
        .tricks-card-border[data-rarity="4"] { background: #42bd59; }
        .tricks-card-border[data-rarity="5"] { background: #ffdb00; }
        .tricks-dom-card.rarity-5 > .tricks-card-border {
            mask: none;
            -webkit-mask: none;
            z-index: 0;
        }
        .tricks-border-flow, .tricks-card-border[data-rarity="5"] > span {
            display: block;
            position: absolute;
            inset: 0;
            transform-origin: 50% 50%;
            animation-name: none;
            animation-duration: var(--border-period, 12s);
            animation-delay: var(--border-delay, 0s);
            animation-timing-function: linear;
            animation-iteration-count: infinite;
        }
        .tricks-card-border[data-border-active="true"][data-border-mode="always"] > span,
        .tricks-dom-card:is(:hover, :focus-visible) .tricks-card-border[data-border-active="true"][data-border-mode="hover"] > span {
            animation-name: var(--border-motion);
        }
        .tricks-card-border[data-rarity="3"] .tricks-border-flow {
            inset: -96px;
            background: repeating-linear-gradient(135deg, #1976d2 0px, #163a83 64px, #1976d2 128px);
            --border-motion: tricksRareBorder;
        }
        .tricks-card-border[data-rarity="4"] .tricks-border-flow {
            inset: -212px;
            background: repeating-linear-gradient(135deg, #42bd59 0px, #55e5ed 48px, #1976d2 96px, #55e5ed 144px, #42bd59 192px, #b2ed39 240px, #42bd59 288px);
            --border-period: 9.6s;
            --border-motion: tricksEpicBorder;
        }
        .tricks-card-border[data-rarity="5"] > span {
            inset: -50px;
            animation-timing-function: cubic-bezier(.45, 0, .55, 1);
            background: url("/limited/tricks/rarity-legendary-liquid-spectrum-v6.svg") center / 100% 100% no-repeat;
            --border-motion: tricksLegendaryCurrent;
        }
        .tricks-card-border[data-rarity="5"] .tricks-legendary-current {
            opacity: .95;
            --border-period: 41s;
            animation-delay: calc(var(--border-delay) - 13s);
        }
        .tricks-card-border[data-rarity="5"] .tricks-legendary-refraction {
            opacity: .44;
            --border-period: 67s;
            --border-motion: tricksLegendaryRefraction;
            animation-delay: calc(var(--border-delay) - 31s);
        }
        .tricks-card-border[data-rarity="5"] .tricks-legendary-caustics {
            opacity: .22;
            --border-period: 97s;
            --border-motion: tricksLegendaryCaustics;
            animation-delay: calc(var(--border-delay) - 58s);
        }
        .tricks-card-border[data-rarity="5"] .tricks-legendary-light {
            opacity: .7;
            background-image: url("/limited/tricks/rarity-legendary-filaments-v6.svg");
            --border-period: 53s;
            --border-motion: tricksLegendaryLight;
            animation-delay: calc(var(--border-delay) - 19s);
        }
        @keyframes tricksRareBorder { from { transform: translate(0, 0); } to { transform: translate(-90.5097px, -90.5097px); } }
        @keyframes tricksEpicBorder { from { transform: translate(0, 0); } to { transform: translate(-203.6468px, -203.6468px); } }
        @keyframes tricksLegendaryCurrent {
            0%, 100% { transform: translate(-18px, 10px) rotate(-7deg) scale(1.05); }
            31% { transform: translate(24px, -20px) rotate(8deg) scale(1.13, 1.04); }
            67% { transform: translate(-20px, -8px) rotate(-3deg) scale(1.04, 1.12); }
        }
        @keyframes tricksLegendaryRefraction {
            0%, 100% { transform: translate(24px, -17px) rotate(34deg) scale(1.05); }
            39% { transform: translate(-27px, 26px) rotate(54deg) scale(1.13, 1.04); }
            72% { transform: translate(12px, 18px) rotate(43deg) scale(1.04, 1.12); }
        }
        @keyframes tricksLegendaryCaustics {
            0%, 100% { transform: translate(-17px, -23px) rotate(106deg) scale(1.08); }
            43% { transform: translate(24px, 21px) rotate(92deg) scale(1.16, 1.04); }
            79% { transform: translate(10px, -16px) rotate(118deg) scale(1.04, 1.1); }
        }
        @keyframes tricksLegendaryLight {
            0%, 100% { transform: translate(18px, 25px) rotate(-45deg) scale(1.08); }
            27% { transform: translate(-25px, -18px) rotate(-62deg) scale(1.04, 1.12); }
            68% { transform: translate(17px, -26px) rotate(-38deg) scale(1.12, 1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
            .tricks-card-border > span { animation: none !important; }
        }
        @supports not ((mask-composite: exclude) or (-webkit-mask-composite: xor)) {
            .tricks-card-border { display: none; }
        }
    `}</style>
}
