# NodeJSOne
### NodeJS ExpressJS LowDB JSONFile


<br><br>

## Steps to execute:


```ruby
sudo apt update
```

```ruby
sudo apt install nodejs npm
```

```ruby
node -v  
v16.15.1

npm -v  
8.11.0
```

```ruby
git clone https://github.com/thanoojgithub/NodeJSOne.git
```

```ruby
npm install express cors lowdb morgan rotating-file-stream
```

```ruby
npm install -g nodemon
```

```js
thanooj@thanooj-Inspiron-3521:~/sourceCode/NodeJSTwo$ nodemon  
[nodemon] 2.0.18  
[nodemon] to restart at any time, enter 'rs'  
[nodemon] watching path(s): *.*  
[nodemon] watching extensions: js,mjs,json  
[nodemon] starting 'node index.js'  
Low { adapter: JSONFile {}, data: null }  

Backend is running on http://localhost:4000  
```

```html
Using **Thunder Client** is a lightweight Rest API Client Extension for Visual Studio Code  
```


### POST API

```json
http://localhost:4000/phones/phone
{
  "id": "7",
  "name": "Nokia G20",
  "model": "n-007",
  "release_date": "20220401"
}
Status: 200 OK
```



### GET APIs

```json
http://localhost:4000/phones
[
  {
    "id": "1",
    "model": "n-0001",
    "name": "Nokia 5.3",
    "release_date": "20210101"
  },
  {
    "id": "2",
    "model": "n-0002",
    "name": "Nokia 5.4",
    "release_date": "20210201"
  },
  {
    "id": "3",
    "model": "n-0003",
    "name": "Nokia 7.1",
    "release_date": "20200701"
  },
  {
    "id": "4",
    "model": "n-0004",
    "name": "Nokia 7.2",
    "release_date": "20200801"
  },
  {
    "id": "5",
    "model": "n-0005",
    "name": "Nokia 8.1",
    "release_date": "20200901"
  }
]
```

```json
http://localhost:4000/phones/id/5
{
  "id": "5",
  "model": "n-0005",
  "name": "Nokia 8.1",
  "release_date": "20200901"
}
```

```json
http://localhost:4000/phones/names
[
  {
    "id": "1",
    "name": "Nokia 5.3"
  },
  {
    "id": "2",
    "name": "Nokia 5.4"
  },
  {
    "id": "3",
    "name": "Nokia 7.1"
  },
  {
    "id": "4",
    "name": "Nokia 7.2"
  },
  {
    "id": "5",
    "name": "Nokia 8.1"
  }
]
```

```json
http://localhost:4000/phones/name/nok
[
  {
    "id": "1",
    "model": "n-0001",
    "name": "Nokia 5.3",
    "release_date": "20210101"
  },
  {
    "id": "2",
    "model": "n-0002",
    "name": "Nokia 5.4",
    "release_date": "20210201"
  },
  {
    "id": "3",
    "model": "n-0003",
    "name": "Nokia 7.1",
    "release_date": "20200701"
  },
  {
    "id": "4",
    "model": "n-0004",
    "name": "Nokia 7.2",
    "release_date": "20200801"
  },
  {
    "id": "5",
    "model": "n-0005",
    "name": "Nokia 8.1",
    "release_date": "20200901"
  }
]
```

