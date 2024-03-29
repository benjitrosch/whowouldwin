require('dotenv').config()
const express = require("express")
const path = require('path')
const limit = require("express-rate-limit")
const { v4: uuidv4 } = require("uuid")
const { OpenAI } = require("openai")

const app = express()
const PORT = process.env.PORT || 6006

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const systemMessages = [
    "Be jdugemental and confident.",
    "Hold strong opinions — even nonsense ones.",
    "Always justify your answers.",
    "Your justification does not need to be logical.",
    "Answer in 4 or less mid-to-short sentences.",
]

const createPrompt = (fight, a, b) =>
`Who would win in a ${fight} between ${a} and ${b}? Give some details about how they would win.`

const MAX_REQUESTS_PER_MINUTE = 10
const MAX_REQUESTS_PER_PERIOD = 100
const REQUESTS_PER_MINUTE_MS = 1 * 60 * 1000
const REQUESTS_PER_DAY_MS = 24 * 60 * 60 * 1000

const apiLimiter = limit({
    windowMs: REQUESTS_PER_MINUTE_MS,
    max: MAX_REQUESTS_PER_MINUTE,
    message: "Too many requests (max 10 per minute). Please try again later.",
})

const ipQuotas = new Map()

setInterval(() => {
    const now = Date.now()
    for (const [ip, quota] of ipQuotas.entries()) {
        if (quota.resetTime <= now) {
            ipQuotas.delete(ip)
        }
    }
}, REQUESTS_PER_DAY_MS)

app.use(express.static(path.join(__dirname, 'dist')))

app.get('/', (_, res) => {
    res.status(200).sendFile(path.join(__dirname, 'dist/index.html'))
})

app.use("/api/ai", apiLimiter)

app.use("/api/ai", (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const now = Date.now()
    let quota = ipQuotas.get(ip)

    if (!quota) {
        quota = { id: uuidv4(), count: 0, resetTime: now + REQUESTS_PER_DAY_MS }
        ipQuotas.set(ip, quota)
    }

    if (quota.resetTime <= now) {
        quota.count = 0
        quota.resetTime = now + REQUESTS_PER_DAY_MS
    }

    if (quota.count >= MAX_REQUESTS_PER_PERIOD) {
        const message = "Raie limit exceeded. Please try again later."

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        })

        res.write(`event: error\n`)
        res.write(`data: ${JSON.stringify({ status: 429, message })}\n\n`)
        res.end()
    } else {
        quota.count += 1
        next()
    }
})

app.get("/api/ai", async (req, res) => {
    const fight = req.query['fight']
    const a = req.query['a']
    const b = req.query['b']

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    })

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                ...systemMessages.map((content) => ({
                    role: "system",
                    content
                })),
                {
                    role: "user",
                    content: createPrompt(fight, decodeURI(a), decodeURI(b)),
                }
            ],
            stream: true,
        })

        req.on('close', () => {
            res.end()
        })
  
        for await (const data of completion) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }

        res.write('event: stream-complete\ndata: {}\n\n');
        res.end();
    } catch (error) {
        const message = error.status === 429
            ? "Out of funds for OpenAI requests. Try again next month!"
            : error.message

        res.write(`event: error\n`)
        res.write(`data: ${JSON.stringify({ status: error.status, message })}\n\n`)
        res.end()
    }
})

app.use('*', (_, res) => res.sendStatus(404))

app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
})

module.exports = app

