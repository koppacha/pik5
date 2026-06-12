import {
    Krub,
    Kulim_Park,
    M_PLUS_1_Code,
    Proza_Libre,
    Quicksand,
} from "next/font/google"

const mPlus1Code = M_PLUS_1_Code({
    weight: ["400", "700"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-m-plus-1-code",
    fallback: ["sans-serif"],
})

const prozaLibre = Proza_Libre({
    weight: ["400", "700"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-proza-libre",
    fallback: ["cursive"],
})

const quicksand = Quicksand({
    weight: "variable",
    subsets: ["latin"],
    display: "swap",
    variable: "--font-quicksand",
    fallback: ["cursive"],
})

const krub = Krub({
    weight: ["200", "300", "400"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-krub",
    fallback: ["cursive"],
})

const kulimPark = Kulim_Park({
    weight: ["200", "400", "700"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-kulim-park",
    fallback: ["cursive"],
})

export const googleFontVariables = [
    mPlus1Code.variable,
    prozaLibre.variable,
    quicksand.variable,
    krub.variable,
    kulimPark.variable,
].join(" ")
