require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')

const fs = require("fs")
const path = require("path")

const Produto = require('./models/Produto')

const app = express()
app.use(express.json())
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://new-vite-vasos-frontend.vercel.app",
    "https://casadooleiroo.com.br",
    "https://www.casadooleiroo.com.br",          // ← sem barra
    "https://vite-projeto-vasos-jhdf3dso9-bassani56s-projects.vercel.app",
    "https://vite-projeto-vasos-git-main-bassani56s-projects.vercel.app", // ← sem barra
    ...(process.env.FRONTEND_URL || "")
        .split(",")
        .map(origin => origin.trim().replace(/\/$/, "")) // ← remove trailing slash
        .filter(Boolean)
]



// Garante que o Vercel/CDN não sirva resposta cacheada para outra origem
app.use((req, res, next) => {
    res.setHeader("Vary", "Origin")
    next()
})

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }
        return callback(new Error("Origem não permitida pelo CORS"))
    },
    credentials: true,
    optionsSuccessStatus: 200
}))

async function conectarBanco() {
    if (mongoose.connection.readyState >= 1) {
        return
    }

    await mongoose.connect(process.env.MONGO_URI, {
        dbName: 'meu_banco'
    })
}

app.use(async (req, res, next) => {
    try {
        await conectarBanco()
        next()
    } catch (error) {
        console.error(error)
        res.status(500).json({ erro: 'Erro ao conectar ao banco de dados' })
    }
})


app.use((req, res, next) => {
    res.setHeader('Vary', 'Origin')
    next()
})

app.get('/produtos', async (req, res) => {

    res.setHeader('Cache-Control', 'no-store') 

    try {
        const produtos = await Produto.find()
        res.json(produtos)
        
    } catch (error) {
        console.error(error)
        res.status(500).json({erro: error.message})
    }
})


app.post('/relacionados', async (req, res) =>{
    try {

        const produto = req.body.produto;
        const relacionados_total = [];

        for (const categoria of produto.categorias) {

            const relacionados = await Produto.find({
                categorias: categoria,
                _id: { $ne: produto._id }
            });

            relacionados_total.push(...relacionados);
        }

        const unicos = relacionados_total.filter(
            (item, index, self) =>
                index === self.findIndex(
                    r => r._id.toString() === item._id.toString()
                )
        );

        res.json({
            rel: unicos
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        await conectarBanco()

        const produtos = await Produto.find().lean()

        const baseUrl = 'https://casadooleiroo.com.br'

        let urls = `
            <url>
                <loc>${baseUrl}/</loc>
                <priority>1.0</priority>
            </url>
        `

        produtos.forEach((produto) => {
            const slug = gerarSlug(produto.titulo || 'produto')

            urls += `
                <url>
                    <loc>${baseUrl}/produto/${slug}-${produto._id}</loc>
                    <priority>0.8</priority>
                </url>
            `
        })

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                ${urls}
            </urlset>
        `

        res.setHeader('Content-Type', 'application/xml')
        res.setHeader('Cache-Control', 'no-store')
        res.send(sitemap)

    } catch (err) {
        console.error(err)
        res.status(500).send('Erro ao gerar sitemap')
    }
})

if (require.main === module) {
    const PORT = process.env.PORT || 3000

    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`)
    })
}

module.exports = app
