const http = require('node:http')

const URL = process.env.HEALTH_URL || 'http://127.0.0.1:3001/api/health'
const TIMEOUT = Number(process.env.HEALTH_TIMEOUT || '5000')

const req = http.get(URL, { timeout: TIMEOUT }, (res) => {
  let data = ''
  res.on('data', (chunk) => {
    data += chunk
  })
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('OK', data)
      process.exit(0)
    }
    console.error('Healthcheck failed:', res.statusCode, data)
    process.exit(1)
  })
})

req.on('error', (err) => {
  console.error('Healthcheck error:', err.message)
  process.exit(1)
})

req.on('timeout', () => {
  req.destroy()
  console.error('Healthcheck timeout')
  process.exit(1)
})
