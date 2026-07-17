// Remove o atributo `crossorigin` dos <script> e <link> gerados pelo Vite.
// Quando o app é acessado pelo Cloudflare Tunnel, esse atributo faz o
// navegador exigir Access-Control-Allow-Origin mesmo sendo same-origin.
// O backend não consegue controlar os headers via Cloudflare, então a
// solução mais simples é não exigir CORS no front.
const fs = require('node:fs')
const path = require('node:path')

const file = path.resolve(__dirname, '..', 'dist', 'index.html')
let html = fs.readFileSync(file, 'utf8')
html = html.replaceAll(' crossorigin', '')
fs.writeFileSync(file, html, 'utf8')
console.log('Atributo crossorigin removido do dist/index.html')