// Converte as capturas (PNG) geradas por capturas.cjs em WebP otimizado e grava
// em public/ajuda/ — as imagens que o manual (/ajuda) usa.
// Uso: node scripts/manual/converter.cjs [pasta-das-capturas]
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const origem = process.argv[2] || 'scripts/manual/.capturas'
const destino = path.join('public', 'ajuda')
fs.mkdirSync(destino, { recursive: true })

;(async () => {
  let total = 0
  for (const arq of fs.readdirSync(origem).filter(f => f.endsWith('.png'))) {
    const nome = arq.replace(/\.png$/, '')
    const meta = await sharp(path.join(origem, arq)).metadata()
    const largura = Math.min(meta.width, nome.startsWith('mobile') ? 780 : 1200)
    const saida = path.join(destino, nome + '.webp')
    await sharp(path.join(origem, arq)).resize({ width: largura }).webp({ quality: 84 }).toFile(saida)
    total += fs.statSync(saida).size
    console.log('ok', nome)
  }
  console.log(`Total: ${Math.round(total / 1024)} KB`)
})()
