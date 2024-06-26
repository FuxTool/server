const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

app.use(express.static('public'));

let users = {};

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);
    users[socket.id] = socket;

    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', {
            sdp: data.sdp,
            source: socket.id
        });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', {
            sdp: data.sdp,
            source: socket.id
        });
    });

    socket.on('candidate', (data) => {
        io.to(data.target).emit('candidate', {
            candidate: data.candidate,
            source: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        delete users[socket.id];
    });

    socket.on('skip', () => {
        let availableUsers = Object.keys(users).filter(id => id !== socket.id);
        if (availableUsers.length > 0) {
            let target = availableUsers[Math.floor(Math.random() * availableUsers.length)];
            socket.emit('new-peer', target);
        } else {
            socket.emit('no-users-available');
        }
    });
});

server.listen(port, () => console.log('Server is running on port ' + port));
