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

    "https://new-vite-vasos-frontend.vercel.app",
    "http://localhost:5174",
    ...(process.env.FRONTEND_URL || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
]

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }

        return callback(new Error("Origem nao permitida pelo CORS"))
    },
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

app.get('/produtos', async (req, res) => {
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


if (require.main === module) {
    const PORT = process.env.PORT || 3000

    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`)
    })
}

module.exports = app
