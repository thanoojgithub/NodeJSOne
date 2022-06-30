import { join, dirname } from 'path'
import express from 'express'
import { Low, JSONFile } from 'lowdb'
import cors from 'cors'
import { fileURLToPath } from 'url'


const __dirname = dirname(fileURLToPath(import.meta.url));
const dbFile = join(__dirname, 'db.json')
const adapter = new JSONFile(dbFile)
let db = new Low(adapter)

console.log(db);
await db.read()
db.data ||= { phoneList: [] , notes: []}
let { phoneList } = db.data
console.log("phoneList", phoneList);
let { notes } = db.data
console.log(notes);

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));



//GET all phones
app.get('/phones/', async (req, res) => {
    console.log(req.baseUrl)
    res.json(phoneList)
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
  


// Express App up & running
const PORT = 4000
app.listen(PORT, () => {
    console.log("Backend is running on http://localhost:"+PORT)
})
