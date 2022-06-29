# NodeJSOne
NodeJS Express LowDB JSONFile


<br><br>

**Steps to execute:**


```
sudo apt update
```
```
sudo apt install nodejs npm
```

```
node -v  
v16.15.1

npm -v  
8.11.0
```

```
npm install express cors lowdb nanoid body-parser
```

```
npm install -g nodemon
```

```
thanooj@thanooj-Inspiron-3521:~/sourceCode/NodeJSTwo$ nodemon  
[nodemon] 2.0.18  
[nodemon] to restart at any time, enter 'rs'  
[nodemon] watching path(s): *.*  
[nodemon] watching extensions: js,mjs,json  
[nodemon] starting 'node index.js'  
Low { adapter: JSONFile {}, data: null }  

Backend is running on http://localhost:4000  
```

```
Using **Thunder Client** is a lightweight Rest API Client Extension for Visual Studio Code  
```


POST API
--------
```
http://localhost:4000/posts  
{"id" : 5, "msg" : "good morning"}  
Status: 200 OK
```



GET APIs
--------
```
http://localhost:4000/posts/id/4  
{  
  "id": "4",  
  "msg": "good afternoon"  
}  
```
```
http://localhost:4000/posts/msg/aft  
[  
  {  
    "id": "2",  
    "msg": "good afternoon"  
  },  
  {  
    "id": "4",  
    "msg": "good afternoon"  
  }  
]  
```
```
http://localhost:4000/posts  
[  
  {  
    "id": "1",  
    "msg": "good morning"  
  },  
  {  
    "id": "2",  
    "msg": "good afternoon"  
  },  
  {  
    "id": "3",  
    "msg": "good morning"  
  },  
  {  
    "id": "4",  
    "msg": "good afternoon"  
  }  
]  
