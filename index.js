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
db.data ||= { posts: [] , notes: []}
let { posts } = db.data
console.log(posts);
let { notes } = db.data
console.log(notes);

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

const PORT = 4000

app.get('/posts/', async (req, res) => {
    console.log(req.baseUrl)
    res.json(posts)
})

app.get('/posts/id/:id', async (req, res) => {
    console.log("eq.params.id", req.params.id)
    const post = posts.find((p) => p.id === req.params.id)
    if (!post) return res.sendStatus(404)
    console.log("--------------------------")
    console.log("/posts/:id", post)
    console.log("--------------------------")
    res.json(post)
})


app.get('/posts/msg/:msg', async (req, res) => {
    console.log("eq.params.msg", req.params.msg)
    console.log(posts)
    /* const post = posts.find( p => p.msg === req.params.msg) 
    const post = posts.find((p) => "/^.*"+req.params.msg+".*$/".test(p.msg))*/
  
    const post = posts.filter((p) => p.msg.includes(req.params.msg))
    if (!post) return res.sendStatus(404) 
    console.log("--------------------------")
    console.log("/posts/:msg", post)
    console.log("--------------------------")
    res.json(post)
})

app.post('/posts', async (req, res, next) => {
    console.log("req.body", req.body)
    console.log("db.data.posts", posts)
    const post = posts.push(req.body)
    await db.write()
    res.sendStatus(200)
  })
  

app.listen(PORT, () => {
    console.log("Backend is running on http://localhost:"+PORT)
})
