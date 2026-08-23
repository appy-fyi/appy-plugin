// Deterministic Android adaptive-launcher-icon generator: given a build
// spec's design_system (icon_name + color_primary_hex), always produces the
// same icon — no model call, no external image-gen tool, no network access.
// The glyph comes from the vendored Phosphor "regular" set (MIT licensed,
// see assets/icons/phosphor-regular/), one <path> per icon on a 0 0 256 256
// viewBox. Wired into skills/appy/SKILL.md §5.

const CANVAS = 108 // adaptive-icon dp/viewport size
const SAFE_ZONE = 66 // Android's adaptive-icon safe-zone glyph diameter
const SOURCE_VIEWBOX = 256 // Phosphor icons' own viewBox
const SCALE = SAFE_ZONE / SOURCE_VIEWBOX
const TRANSLATE = (CANVAS - SAFE_ZONE) / 2

const LEGACY_DENSITIES: Record<string, number> = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
}

export interface LauncherIconDesignSystem {
    color_primary_hex: string
    icon_name: string
}

async function readIconPathData(iconName: string): Promise<string> {
    const svgPath = new URL(`../assets/icons/phosphor-regular/${iconName}.svg`, import.meta.url)
    const svg = await Bun.file(svgPath).text()
    const match = svg.match(/<path[^>]*\sd="([^"]+)"/)
    if (!match) throw new Error(`no <path d="..."> found in ${iconName}.svg`)
    return match[1]
}

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace("#", "")
    const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean
    const n = parseInt(full, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(a: number, b: number): number {
    const [lighter, darker] = a > b ? [a, b] : [b, a]
    return (lighter + 0.05) / (darker + 0.05)
}

// White field with a colored glyph reads as a sticker, not an icon — flat
// brand-colored field with a white/black glyph is the convention actual
// launcher icons follow, so color_primary_hex fills the whole canvas and the
// glyph color is picked for contrast against it (not from design_system).
function glyphColorFor(backgroundHex: string): string {
    const bgLum = relativeLuminance(hexToRgb(backgroundHex))
    return contrastRatio(bgLum, 1) >= contrastRatio(bgLum, 0) ? "#FFFFFF" : "#000000"
}

function backgroundXml(colorHex: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="${colorHex}"
        android:pathData="M0,0h108v108h-108z"/>
</vector>
`
}

function foregroundXml(pathData: string, glyphColor: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:scaleX="${SCALE}"
        android:scaleY="${SCALE}"
        android:translateX="${TRANSLATE}"
        android:translateY="${TRANSLATE}">
        <path
            android:fillColor="${glyphColor}"
            android:pathData="${pathData}"/>
    </group>
</vector>
`
}

const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`

export interface LauncherIconResources {
    "drawable/ic_launcher_background.xml": string
    "drawable/ic_launcher_foreground.xml": string
    "mipmap-anydpi-v26/ic_launcher.xml": string
    "mipmap-anydpi-v26/ic_launcher_round.xml": string
}

/** Pure function of design_system — same tokens always produce the same
 * icon. Covers API 26+ (adaptive icons); call genLegacyLauncherPngs too if
 * the project's minSdk is below 26. */
export async function genLauncherIconResources(designSystem: LauncherIconDesignSystem): Promise<LauncherIconResources> {
    const pathData = await readIconPathData(designSystem.icon_name)
    const glyphColor = glyphColorFor(designSystem.color_primary_hex)
    return {
        "drawable/ic_launcher_background.xml": backgroundXml(designSystem.color_primary_hex),
        "drawable/ic_launcher_foreground.xml": foregroundXml(pathData, glyphColor),
        "mipmap-anydpi-v26/ic_launcher.xml": ADAPTIVE_ICON_XML,
        "mipmap-anydpi-v26/ic_launcher_round.xml": ADAPTIVE_ICON_XML,
    }
}

/** Rasterized fallback for minSdk < 26, where adaptive-icon XML isn't
 * supported — same glyph/background flattened into legacy mipmap PNGs.
 * Dynamically imports `sharp` so the (dependency-free) adaptive-icon-only
 * path above never requires it to even be installed. */
export async function genLegacyLauncherPngs(designSystem: LauncherIconDesignSystem): Promise<Record<string, Buffer>> {
    const { default: sharp } = await import("sharp")
    const pathData = await readIconPathData(designSystem.icon_name)
    const glyphColor = glyphColorFor(designSystem.color_primary_hex)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
    <rect width="${CANVAS}" height="${CANVAS}" fill="${designSystem.color_primary_hex}"/>
    <g transform="translate(${TRANSLATE} ${TRANSLATE}) scale(${SCALE})">
        <path d="${pathData}" fill="${glyphColor}"/>
    </g>
</svg>`

    const out: Record<string, Buffer> = {}
    for (const [density, size] of Object.entries(LEGACY_DENSITIES)) {
        const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
        out[`mipmap-${density}/ic_launcher.png`] = png
        out[`mipmap-${density}/ic_launcher_round.png`] = png
    }
    return out
}

if (import.meta.main) {
    const [specPath, outDir, ...flags] = process.argv.slice(2)
    if (!specPath || !outDir) {
        console.error("usage: bun run genLauncherIcon.ts <build-spec.json> <output-res-dir> [--legacy]")
        process.exit(1)
    }

    const spec = await Bun.file(specPath).json()
    const designSystem: LauncherIconDesignSystem = spec.design_system

    const resources = await genLauncherIconResources(designSystem)
    for (const [rel, content] of Object.entries(resources)) {
        await Bun.write(`${outDir}/${rel}`, content)
    }

    if (flags.includes("--legacy")) {
        try {
            const legacy = await genLegacyLauncherPngs(designSystem)
            for (const [rel, buf] of Object.entries(legacy)) {
                await Bun.write(`${outDir}/${rel}`, buf)
            }
        } catch (err) {
            console.error(`--legacy PNG generation failed (sharp unavailable?) — adaptive-icon XML was still written. ${err}`)
        }
    }

    console.log(`wrote launcher icon resources for "${designSystem.icon_name}" to ${outDir}`)
}
