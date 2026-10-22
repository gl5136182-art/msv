// Gera src/components/icone-caminhos.ts a partir dos SVGs individuais do Material Symbols
// (estilo Sharp, outlined, peso 300). Só os ícones listados abaixo entram no bundle.
// Para usar um ícone novo: acrescente o nome aqui e rode `npm run icones`.
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ICONES = [
  "add",
  "add_a_photo",
  "arrow_back",
  "arrow_drop_down",
  "bar_chart",
  "check",
  "chevron_left",
  "chevron_right",
  "close",
  "content_copy",
  "delete",
  "edit",
  "filter_list",
  "inventory_2",
  "key",
  "keyboard_arrow_down",
  "keyboard_arrow_up",
  "logout",
  "notifications",
  "person",
  "photo_library",
  "refresh",
  "request_quote",
  "search",
  "settings",
  "storefront",
  "swap_horiz",
  "warning",
]

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..")
const pasta = join(raiz, "node_modules", "@material-symbols", "svg-300", "sharp")

const linhas = ICONES.map((nome) => {
  const svg = readFileSync(join(pasta, `${nome}.svg`), "utf8")
  const d = svg.match(/<path d="([^"]+)"/)?.[1]
  if (!d) throw new Error(`Ícone sem path: ${nome}`)
  return `  ${nome}: "${d}",`
})

const saida = `// Arquivo gerado por scripts/gerar-icones.mjs. Não edite à mão.
// Material Symbols, estilo Sharp, outlined, peso 300. viewBox "0 -960 960 960".
export const CAMINHOS_ICONES = {
${linhas.join("\n")}
} as const

export type NomeIcone = keyof typeof CAMINHOS_ICONES
`

writeFileSync(join(raiz, "src", "components", "icone-caminhos.ts"), saida)
console.log(`${ICONES.length} ícones gerados.`)
