const fs = require("fs")
const path = require("path")
const {chromium} = require("@playwright/test")

const outDir = path.resolve(__dirname, "../../public/limited/tricks/fx")
const width = 260
const height = Math.round(width * 88 / 63)
const border = 8
const radius = 10
const epicFrames = 8
const legendaryFrames = 10

const html = String.raw`<!doctype html>
<html>
<body>
<canvas id="canvas"></canvas>
<script>
const width = ${width}
const height = ${height}
const border = ${border}
const radius = ${radius}

function roundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
    ctx.lineTo(x + w, y + h - rr)
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
    ctx.lineTo(x + rr, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
    ctx.lineTo(x, y + rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.closePath()
}

function clipOuter(ctx) {
    ctx.save()
    roundedRectPath(ctx, 0, 0, width, height, radius)
    ctx.clip()
}

function punchInner(ctx) {
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "destination-out"
    roundedRectPath(ctx, border, border, width - border * 2, height - border * 2, Math.max(2, radius - border / 2))
    ctx.fillStyle = "#000"
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"
}

function strokeOuter(ctx, color, alpha = 0.85) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.lineWidth = 1.5
    ctx.strokeStyle = color
    roundedRectPath(ctx, 0.75, 0.75, width - 1.5, height - 1.5, radius)
    ctx.stroke()
    ctx.restore()
}

function generateEpic() {
    const canvas = document.getElementById("canvas")
    canvas.width = width * ${epicFrames}
    canvas.height = height
    const ctx = canvas.getContext("2d")

    for (let frame = 0; frame < ${epicFrames}; frame += 1) {
        ctx.save()
        ctx.translate(width * frame, 0)
        clipOuter(ctx)
        const gradient = ctx.createLinearGradient(-height, -height, width + height, height)
        gradient.addColorStop(0, "#c8ff6b")
        gradient.addColorStop(0.35, "#4eed7e")
        gradient.addColorStop(0.7, "#23c9a7")
        gradient.addColorStop(1, "#d8ff78")
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)

        ctx.globalCompositeOperation = "source-atop"
        const shift = frame * 22
        for (let i = -height; i < width + height; i += 38) {
            ctx.globalAlpha = 0.46
            ctx.fillStyle = i % 76 === 0 ? "#efff9b" : "#1ebf99"
            ctx.beginPath()
            ctx.moveTo(i + shift, 0)
            ctx.lineTo(i + shift + 18, 0)
            ctx.lineTo(i + shift + height + 18, height)
            ctx.lineTo(i + shift + height, height)
            ctx.closePath()
            ctx.fill()
        }
        ctx.globalAlpha = 0.28
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, width, 2)
        punchInner(ctx)
        strokeOuter(ctx, "#c8ff6b", 0.72)
        ctx.restore()
    }

    return canvas.toDataURL("image/png").split(",")[1]
}

function generateLegendary() {
    const canvas = document.getElementById("canvas")
    canvas.width = width * ${legendaryFrames}
    canvas.height = height
    const ctx = canvas.getContext("2d")

    for (let frame = 0; frame < ${legendaryFrames}; frame += 1) {
        ctx.save()
        ctx.translate(width * frame, 0)
        clipOuter(ctx)
        const base = ctx.createLinearGradient(0, 0, width, height)
        base.addColorStop(0, "#ff5138")
        base.addColorStop(0.35, "#ff9d21")
        base.addColorStop(0.72, "#ffe04d")
        base.addColorStop(1, "#cfff5c")
        ctx.fillStyle = base
        ctx.fillRect(0, 0, width, height)

        ctx.globalCompositeOperation = "source-atop"
        for (let i = 0; i < 36; i += 1) {
            const seed = i * 97 + frame * 31
            const side = seed % 4
            const along = ((seed * 37) % 100) / 100
            const pulse = 0.5 + Math.sin((frame / ${legendaryFrames}) * Math.PI * 2 + i) * 0.5
            let x = along * width
            let y = along * height
            if (side === 0) y = border / 2
            if (side === 1) x = width - border / 2
            if (side === 2) y = height - border / 2
            if (side === 3) x = border / 2
            const size = 3 + (seed % 8) + pulse * 5
            const glow = ctx.createRadialGradient(x, y, 0, x, y, size)
            glow.addColorStop(0, "rgba(255,255,210,0.95)")
            glow.addColorStop(0.35, "rgba(255,188,42,0.7)")
            glow.addColorStop(1, "rgba(255,70,44,0)")
            ctx.fillStyle = glow
            ctx.beginPath()
            ctx.arc(x, y, size, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.globalAlpha = 0.32
        ctx.strokeStyle = "#fff07a"
        ctx.lineWidth = 3
        roundedRectPath(ctx, 3, 3, width - 6, height - 6, radius - 2)
        ctx.stroke()
        punchInner(ctx)
        strokeOuter(ctx, "#ffdd49", 0.84)
        ctx.restore()
    }

    return canvas.toDataURL("image/png").split(",")[1]
}

window.generateSprites = () => ({
    epic: generateEpic(),
    legendary: generateLegendary(),
})
</script>
</body>
</html>`

async function main() {
    fs.mkdirSync(outDir, {recursive: true})
    const executablePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    const browser = await chromium.launch({headless: true, executablePath})
    const page = await browser.newPage()
    await page.setContent(html)
    const sprites = await page.evaluate(() => window.generateSprites())
    await browser.close()

    fs.writeFileSync(path.join(outDir, "card-border-epic.png"), Buffer.from(sprites.epic, "base64"))
    fs.writeFileSync(path.join(outDir, "card-border-legendary.png"), Buffer.from(sprites.legendary, "base64"))
    fs.writeFileSync(path.join(outDir, "card-border-manifest.json"), JSON.stringify({
        frameWidth: width,
        frameHeight: height,
        epicFrames,
        legendaryFrames,
    }, null, 2))
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
