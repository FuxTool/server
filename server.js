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
    users[socket.id] = { socket: socket, busy: false };

    socket.on('offer', (data) => {
        if (users[data.target]) {
            users[data.target].socket.emit('offer', {
                sdp: data.sdp,
                source: socket.id
            });
            users[socket.id].busy = true;
            users[data.target].busy = true;
        }
    });

    socket.on('answer', (data) => {
        if (users[data.target]) {
            users[data.target].socket.emit('answer', {
                sdp: data.sdp,
                source: socket.id
            });
        }
    });

    socket.on('candidate', (data) => {
        if (users[data.target]) {
            users[data.target].socket.emit('candidate', {
                candidate: data.candidate,
                source: socket.id
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        if (users[socket.id]) {
            if (users[socket.id].busy) {
                // Notify the other user that this user has disconnected
                for (let id in users) {
                    if (users[id].busy && id !== socket.id) {
                        users[id].socket.emit('peer-disconnected');
                        users[id].busy = false;
                    }
                }
            }
            delete users[socket.id];
        }
    });

    socket.on('skip', () => {
        if (users[socket.id]) {
            users[socket.id].busy = false;
            // Notify the current peer that the call is ended
            for (let id in users) {
                if (users[id].busy && id !== socket.id) {
                    users[id].socket.emit('peer-disconnected');
                    users[id].busy = false;
                }
            }
        }
        let availableUsers = Object.keys(users).filter(id => id !== socket.id && !users[id].busy);
        if (availableUsers.length > 0) {
            let target = availableUsers[Math.floor(Math.random() * availableUsers.length)];
            users[socket.id].busy = true;
            users[target].busy = true;
            socket.emit('new-peer', target);
        } else {
            socket.emit('no-users-available');
        }
    });

    socket.on('check-availability', () => {
        let availableUsers = Object.keys(users).filter(id => id !== socket.id && !users[id].busy);
        if (availableUsers.length > 0) {
            socket.emit('available-users', availableUsers);
        } else {
            socket.emit('no-users-available');
        }
    });
});

server.listen(port, () => console.log('Server is running on port ' + port));
