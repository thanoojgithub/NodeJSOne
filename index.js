import { join, dirname } from 'path'
import express from 'express'
import { Low, JSONFile } from 'lowdb'
import cors from 'cors'
import { fileURLToPath } from 'url'
import morgan from 'morgan'
import rfs from 'rotating-file-stream'

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbFile = join(__dirname, 'db.json')
const adapter = new JSONFile(dbFile)
let db = new Low(adapter)

console.log(db);
await db.read()
db.data ||= { phoneList: [] , brands: []}
let { phoneList } = db.data
console.log("phoneList", phoneList);
let { brands } = db.data
console.log(brands);

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
const logStream = rfs.createStream("access.log", {
    size: "1M", // rotate every 10 MegaBytes written
    interval: "1d", // rotate daily
    compress: "gzip" // compress rotated files
  });
app.use(morgan(':date - :method :url - status :status, res-content-length :res[content-length] Bytes, process-time :total-time ms', { stream: logStream }))



//GET all phones
app.get('/phones/', async (req, res) => {
    res.json(phoneList)
})

//GET all brands
app.get('/brands/', async (req, res) => {
    res.json(brands)
})

// GET all phones [{id,name}]
app.get('/phones/names', async (req, res) => {
    console.log(req.baseUrl)
    phoneList.forEach(function(elem) {
        console.log(elem.id + " , "+ elem.name);
    });
    var pJSONs = function() { 
        return phoneList.map(function(pJSON) {
            return {id : pJSON.id, name : pJSON.name} 
          })
    };
    console.log(pJSONs());
    res.json(pJSONs())
})

// GET a phone by ID
app.get('/phones/id/:id', async (req, res) => {
    console.log("req.params.id", req.params.id)
    const phone = phoneList.find((p) => p.id === req.params.id)
    if (!phone) return res.sendStatus(404)
    console.log("--------------------------")
    console.log("/phones/:id", phone)
    console.log("--------------------------")
    res.json(phone)
})

// GET a phone by Brand-ID
app.get('/phones/brand/:brand_id', async (req, res) => {
    console.log("req.params.brand_id", req.params.brand_id)
    const phone = phoneList.filter((p) => p.brand_id === req.params.brand_id)
    if (!phone) return res.sendStatus(404)
    console.log("--------------------------")
    console.log("/phones/:id", phone)
    console.log("--------------------------")
    res.json(phone)
})


// GET a phone by name (fuzzy search) 
app.get('/phones/name/:name', async (req, res) => {
    console.log("req.params.name", req.params.name)
    console.log(phoneList)
    /* const phones = phoneList.filter((p) => p.name.includes(req.params.name) || p.model.includes(req.params.name)) */
    const phones = phoneList.filter((p) => p.name.toLowerCase().includes(req.params.name.toLowerCase()))
    if (!phones) return res.sendStatus(404)
    console.log("--------------------------")
    console.log("/phones/:name", phones)
    console.log("--------------------------")
    res.json(phones)
})

// POST a new phone JSON data
app.post('/phones/phone', async (req, res) => {
    console.log("req.body", req.body)
    console.log("db.data.phoneList", phoneList)
    const post = phoneList.push(req.body)
    await db.write()
    res.sendStatus(200)
})
  


// Node + Express Application is up and running
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log("Backend is running on http://localhost:"+PORT)
})
