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
npm install -g nodemon
```

```ruby
node -v  
v16.15.1

npm -v  
8.11.0

nodemon -v
2.0.18
```


```ruby
git clone https://github.com/thanoojgithub/NodeJSOne.git -b main NodeJSOne2
```

```ruby
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
```

```js
thanooj@thanooj-Inspiron-3521:~/sourceCode/gitSources/NodeJSOne2$ ls -ltr
total 60
-rw-rw-r-- 1 thanooj thanooj  1488 Jul  1 23:20 db.json
drwxrwxr-x 2 thanooj thanooj  4096 Jul  2 00:54 images
drwxrwxr-x 3 thanooj thanooj  4096 Jul  2 11:04 public
-rw-rw-r-- 1 thanooj thanooj  3665 Jul  2 11:31 index.js
-rw-rw-r-- 1 thanooj thanooj 33368 Jul  2 12:32 access.log
drwxrwxr-x 2 thanooj thanooj  4096 Jul  2 12:50 view
-rw-rw-r-- 1 thanooj thanooj  3889 Jul  2 13:10 README.md
thanooj@thanooj-Inspiron-3521:~/sourceCode/gitSources/NodeJSOne2$
```

```js
thanooj@thanooj-Inspiron-3521:~/sourceCode/gitSources/NodeJSOne2$ npm init -y
Wrote to /home/thanooj/sourceCode/gitSources/NodeJSOne2/package.json:

{
  "name": "nodejsone2",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/thanoojgithub/NodeJSOne.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "bugs": {
    "url": "https://github.com/thanoojgithub/NodeJSOne/issues"
  },
  "homepage": "https://github.com/thanoojgithub/NodeJSOne#readme"
}
```

```js
npm install express cors lowdb path morgan rotating-file-stream
```

```js
thanooj@thanooj-Inspiron-3521:~/sourceCode/gitSources/NodeJSOne2$ ls -ltr
total 124
-rw-rw-r--  1 thanooj thanooj  1488 Jul  1 23:20 db.json
drwxrwxr-x  2 thanooj thanooj  4096 Jul  2 00:54 images
drwxrwxr-x  3 thanooj thanooj  4096 Jul  2 11:04 public
-rw-rw-r--  1 thanooj thanooj  3665 Jul  2 11:31 index.js
-rw-rw-r--  1 thanooj thanooj 33368 Jul  2 12:32 access.log
drwxrwxr-x  2 thanooj thanooj  4096 Jul  2 12:50 view
-rw-rw-r--  1 thanooj thanooj  3889 Jul  2 13:10 README.md
-rw-rw-r--  1 thanooj thanooj 53752 Jul  2 13:21 package-lock.json
-rw-rw-r--  1 thanooj thanooj   658 Jul  2 13:21 package.json
drwxrwxr-x 46 thanooj thanooj  4096 Jul  2 13:21 node_modules
thanooj@thanooj-Inspiron-3521:~/sourceCode/gitSources/NodeJSOne2$ 
```

```js
Add     "type": "module"     in package.json
```

```js
thanooj@thanooj-Inspiron-3521:~/sourceCode/gitSources/NodeJSOne2$ nodemon  
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
```json
http://localhost:4000/brands
[
  {
    "id": "b001",
    "name": "apple",
    "logo": "logo/apple.png"
  },
  {
    "id": "b002",
    "name": "iqoo",
    "logo": "logo/iqoo.png"
  },
  {
    "id": "b003",
    "name": "Nokia",
    "logo": "logo/Nokia.png"
  },
  {
    "id": "b004",
    "name": "moto",
    "logo": "logo/moto.png"
  },
  {
    "id": "b005",
    "name": "OPPO",
    "logo": "logo/OPPO.png"
  },
  {
    "id": "b006",
    "name": "Vivo",
    "logo": "logo/Vivo.png"
  },
  {
    "id": "b007",
    "name": "POCO",
    "logo": "logo/POCO.png"
  }
]
```
```json
http://localhost:4000/phones/brand/b003
[
  {
    "id": "1",
    "model": "n-0001",
    "name": "Nokia 5.3",
    "release_date": "20210101",
    "brand_id": "b003"
  },
  {
    "id": "2",
    "model": "n-0002",
    "name": "Nokia 5.4",
    "release_date": "20210201",
    "brand_id": "b003"
  },
  {
    "id": "3",
    "model": "n-0003",
    "name": "Nokia 7.1",
    "release_date": "20200701",
    "brand_id": "b003"
  },
  {
    "id": "4",
    "model": "n-0004",
    "name": "Nokia 7.2",
    "release_date": "20200801",
    "brand_id": "b003"
  },
  {
    "id": "5",
    "model": "n-0005",
    "name": "Nokia 8.1",
    "release_date": "20200901",
    "brand_id": "b003"
  }
]
```

```json
http://localhost:4000/phones/latest/4
[
  {
    "id": "6",
    "model": "m-0001",
    "name": "Moto G82 5G",
    "release_date": "20220401",
    "brand_id": "b004"
  },
  {
    "id": "2",
    "model": "n-0002",
    "name": "Nokia 5.4",
    "release_date": "20210201",
    "brand_id": "b003"
  },
  {
    "id": "1",
    "model": "n-0001",
    "name": "Nokia 5.3",
    "release_date": "20210101",
    "brand_id": "b003"
  },
  {
    "id": "5",
    "model": "n-0005",
    "name": "Nokia 8.1",
    "release_date": "20200901",
    "brand_id": "b003"
  }
]
````

```json
http://localhost:4000/phones/model_name/m
[
  {
    "id": "6",
    "model": "m-0001",
    "name": "Moto G82 5G",
    "release_date": "20220401",
    "brand_id": "b004"
  }
]
````
