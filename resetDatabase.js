require('dotenv').config()
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

console.log(path.__dirname)

const filePath = path.join(
  __dirname,
  '../produtos.json'
)


const CardSchema = new mongoose.Schema({}, { strict: false })
const Card = mongoose.model('cards_json', CardSchema, 'cards_json')

function normalizeForCompare(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForCompare)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        if (key !== '_id' && key !== '__v') {
          acc[key] = normalizeForCompare(value[key])
        }
        return acc
      }, {})
  }

  return value
}

async function resetDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'meu_banco'
    })

    console.log('Mongo conectado')

    const rawData = fs.readFileSync(filePath, 'utf-8')
    const jsonData = JSON.parse(rawData)

    console.log('Caminho do arquivo:', filePath)
    console.log('Total no JSON:', Object.keys(jsonData).length)

    const produtosArray = Object.entries(jsonData).map(([key, value]) => ({
      ...value,
      codigo: key
    }))

    const codigos = produtosArray.map((p) => p.codigo)
    const existentes = await Card.find({ codigo: { $in: codigos } }).lean()
    const existentesPorCodigo = new Map(
      existentes.map((doc) => [doc.codigo, doc])
    )

    const operations = []
    let novos = 0
    let alterados = 0
    let semMudanca = 0

    for (const produto of produtosArray) {
      const existente = existentesPorCodigo.get(produto.codigo)

      if (!existente) {
        operations.push({ insertOne: { document: produto } })
        novos += 1
        continue
      }

      const incoming = normalizeForCompare(produto)
      const current = normalizeForCompare(existente)

      if (JSON.stringify(incoming) !== JSON.stringify(current)) {
        operations.push({
          updateOne: {
            filter: { _id: existente._id },
            update: { $set: produto }
          }
        })
        alterados += 1
      } else {
        semMudanca += 1
      }
    }

    if (operations.length > 0) {
      await Card.bulkWrite(operations, { ordered: false })
    }

    const remocao = await Card.deleteMany({ codigo: { $nin: codigos } })

    console.log('Sincronizacao concluida')
    console.log('Novos:', novos)
    console.log('Alterados:', alterados)
    console.log('Sem mudanca:', semMudanca)
    console.log('Removidos (nao existem mais no JSON):', remocao.deletedCount)

  } catch (err) {
    console.error('Erro:', err)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

resetDatabase()
