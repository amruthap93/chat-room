const http = require('http')
const path = require('path')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectory = path.join(__dirname, '../public')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

app.use(express.static(publicDirectory))

// server(emit) -> client(receive) -- countUpdated
// client(emit) -> server(receive) -- increment
// socket.emit --> emits to only connected client
// socket.broadcast.emit --> emits an event to all clients expect the client that's sent it
// io.emit --> emits event to all connected clients

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join', (options, callback) => {
        const {error, user} = addUser( {id:socket.id, ...options })
        if(error){
            return callback(error)
        }
        socket.join(user.room)
        socket.emit('message', generateMessage('Admin', `Welcome ${user.username}!`))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined !`))

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback()
    })
    
    socket.on('sendMessage', (msg, callback) => {
        const filter = new Filter()
        if(filter.isProfane(msg)){
            return callback('Profanity is not allowed !')
        }
        const user = getUser(socket.id)
        io.to(user.room).emit('message', generateMessage(user.username, msg))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        if(user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} just left !`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})
app.get('/', (req, res) => {
    res.render('index')
})

server.listen(port, () => {
    console.log('Server listening at port: ', port)
})