import { Bricolage_Grotesque, Anton, Bungee } from 'next/font/google'

// Body + condensed headlines (variable width axis), classic meme text, and the marquee sign
export const sans = Bricolage_Grotesque({ subsets: ['latin'], variable: '--c-sans', axes: ['wdth', 'opsz'] })
export const meme = Anton({ subsets: ['latin'], weight: '400', variable: '--c-meme' })
export const marquee = Bungee({ subsets: ['latin'], weight: '400', variable: '--c-marquee' })
export const fontVars = `${sans.variable} ${meme.variable} ${marquee.variable}`
