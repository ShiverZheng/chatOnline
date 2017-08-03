var express = require('express')
var port = process.env.PORT || 80
var env = process.env.NODE_ENV || 'production';
var app = express()
var router = express.Router()

app.use(router)
// 只用于开发环境

if (env == 'development') {
  console.log( app.get('env'))
  port = 3001
}

// 只用于生产环境
if (env == 'production') {
  console.log( app.get('env'))
  app.use(express.static('./dist'))
}

var mongoose = require('mongoose')
var bodyParser = require('body-parser')
var session = require('cookie-session')
var superagent = require('superagent')
var server = app.listen(port)
console.log('program started on port'+ port)

var User = require('../server/models/user.js')
mongoose.Promise = require('bluebird')
global.db = mongoose.connect("mongodb://localhost:27017/chatRoom",{useMongoClient: true})

//服务器数据json化
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
app.use(session({
  name: 'test',
  secret: 'SHIVER',
  maxAge: null, // 24 hours
  resave: false,
  saveUninitialized: false
}))

//注册
app.post('/user/signup', function (req, res) {
  var _user = req.body
  console.log(_user)
  User.findOne({name: _user.name}, function (err, user) {
    if (err) {
      console.log(err)
    }
    if (user) {
      res.json({
        res_code: 0,
        res_msg: '这个名字已经被人取啦！'
      })
    } else {
      var user = new User(_user)
      user.save(function (err, user) {
        if (err) {
          console.log(err)
        }
        res.json({
          res_code: 1,
          res_msg: '注册成功啦！'
        })
      })
    }
  })
})

// 登录
app.post('/user/login', function (req, res) {
    var _user = req.body
    var name = _user.name
    var password = _user.password
    console.log(_user)
    User.findOne({name: name}, function (err, user) {
      console.log(user)
      if (err) {
        console.log(err)
      }
      if (!user) {
        res.json({
          res_code: 0,
          res_msg: '账号或密码错误' //用户不存在
        })
      } else {
        if (!!password) {
          user.comparePassword(password, function (err, isMatch) {
            if (err) {
              console.log(err)
            }
            if (isMatch) {
              req.session.user = user
              console.log('success')
              res.json({
                res_code: 1,
                res_msg: '登录成功',
                info: {
                  name: name,
                  src: user.src,
                  _id: req.session.user._id
                }
              })
            } else {
              res.json({
                res_code: 2,
                res_msg: '账号或密码错误'
              })
              console.log('password is not meached')
            }
          })
        } else {
          res.json({
            res_code: 4,
            res_msg: '登录失败'
          })
        }
      }
    })
  })

//登陆控制
app.use(function (req, res, next) {
    var o_url = req.originalUrl
    if (o_url != "/login" && req.session.user == undefined) {
      res.json({
        res_code: 0,
        res_msg: '请登录'
      })
    }else{
      next()
    }
})

app.get('/test', function (req, res) {
  //该接口为测试使用
  var Message = require('./models/message.js')
  var message = new Message
  console.log('以下是Message对象')
  console.log(typeof(Message))
  console.log('以下是message对象')
  console.log(typeof(message))
  findById
  res.json({
    res_msg: Message
  })
})

//退出
app.post('/user/logout', function (req, res) {
  req.session = null
  if (req.session === null) {
      res.json({
        res_code: 1
      })
    }else{
      res.json({
        res_code: 0,
        res_msg: '退出失败，请重试~'
      })
    }

})

// 机器人消息
app.get('/robotapi', function(req, res) {
  var response = res
  var info = req.query.info
  var userid = req.query.id
  var key = 'fde7f8d0b3c9471cbf787ea0fb0ca043'
  superagent.post('http://www.tuling123.com/openapi/api')
    .send({info, userid, key})
    .end((err, res) => {
      if(err){
        console.log(err)
      }

      var reg = new RegExp("小\?图图","g")
      var newstr = res.text.replace(reg,"小蘑菇")  

      response.json({
        data: newstr
      })

    })
})

// 获取历史信息
app.get('/message/:id',function (req, res) {
  var id = req.params.id
  Message.find({roomid:id}, function (err, message) {
    if(err) {
      console.log(err)
    } else{
      res.json({
        res_code: 1,
        res_msg: '',
        infos: message
      })
    }
  })
})

//websocket
var io = require('socket.io')(server)
var Message = require('./models/message.js')
var user = {}
var roomInfo = {}
io.on('connection', function (socket) {
  var roomID = ''
  socket.on('message', function (obj) {
    io.emit('message', obj)
    var mess = {
      username: obj.username,
      src: obj.src,
      msg: obj.msg,
      roomid: obj.roomId
    }

    var message = new Message(mess)
    //将发送过来的消息进行储存
    message.save(function (err, mess) {
      if (err) {
        console.log(err)
      }
        console.log(mess)
    })
    console.log(obj.username + '说：' + obj.msg)

  })

  socket.on('join', function (obj) {

    user = {
      //定义user对象
      username: obj.username,
      src: obj.src
    }

    roomID = obj.roomId
    // 将用户昵称加入房间名单中

    if (!roomInfo[roomID]) {
      //如果房间不存在
      roomInfo[roomID] = []    
    }

    var flag = false  //flag表示用户是否进入过该房间
    var findobj = obj.username

    Array.prototype.find = function(fct){
      //定义find方法 查找房间的数组内是否包含用户对象
      if(typeof fct == 'function'){
          for(var i=0;i<this.length;i++){
            if(fct(this[i])){
              return  flag = true
            } 
          }
        }
    }

    roomInfo[roomID].find(function(obj){
      return obj.username == findobj
    })


    if (!flag) {
      roomInfo[roomID].push(user)
      console.log(roomInfo[roomID])
      socket.join(roomID)    // 加入房间
      io.to(roomID).emit('sys', user + '加入了房间', roomInfo[roomID])  // 通知房间内人员
      console.log('用户：'+user + '加入了房间：' + roomID)
    }

  })

  socket.on('leave', function (obj,id) {

    //前端在路由改变时做判断 将用户对象传递给后台 然后再执行删除操作
    // 从房间名单中移除

    if (roomInfo[id]) {
      Array.prototype.del = function(filter){
        var idx = filter
        if(typeof filter == 'function'){
            for(var i=0;i<this.length;i++){
              if(filter(this[i],i)) idx = i
            }
          }
          this.splice(idx,1)
      }
      console.log(roomInfo[id])
      var delobj = obj.username
      roomInfo[id].del(function(obj){
        return obj.username == delobj
      })

    }

    socket.leave(id)    // 退出房间
    io.to(id).emit('sys', obj.username + '退出了房间', roomInfo[id])
    console.log(obj.username + '退出了' + id)
  })


/*    socket.on('disconnect', function () {
    //需要在路由的地方做判断 将obj传递给后台 然后再执行删除操作
    // 从房间名单中移除
    var index = roomInfo[roomID].indexOf(user)
    console.log('index')
    console.log(index)
    if (index !== -1) {
      roomInfo[roomID].splice(index, 1)
    }
    console.log(roomInfo[roomID])

    socket.leave(roomID)    // 退出房间
    io.to(roomID).emit('sys', user + '退出了房间', roomInfo[roomID])
    console.log(user + '退出了' + roomID)
    roomID = ''
  })*/
})