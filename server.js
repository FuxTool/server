const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express(); // Create Express application
const server = http.createServer(app); // Create HTTP server using Express app
const io = socketIo(server); // Initialize Socket.io and attach it to the server

const port = process.env.PORT || 3000; // Define port, using environment variable or default to 3000

app.use(express.static('public')); // Serve static files from 'public' directory

let users = {}; // Object to store connected users and their status (busy or not)

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id); // Log when a new user connects
    users[socket.id] = { socket: socket, busy: false }; // Store new user with initial state (not busy)

    // Handle 'offer' event
    socket.on('offer', (data) => {
        if (users[data.target]) {
            // Forward 'offer' to the target user
            users[data.target].socket.emit('offer', {
                sdp: data.sdp,
                source: socket.id
            });
            // Mark both users as busy
            users[socket.id].busy = true;
            users[data.target].busy = true;
        }
    });

    // Handle 'answer' event
    socket.on('answer', (data) => {
        if (users[data.target]) {
            // Forward 'answer' to the target user
            users[data.target].socket.emit('answer', {
                sdp: data.sdp,
                source: socket.id
            });
            users[socket.id].busy = true;
            users[data.target].busy = true;
        }
    });

    // Handle 'candidate' event
    socket.on('candidate', (data) => {
        if (users[data.target]) {
            // Forward 'candidate' to the target user
            users[data.target].socket.emit('candidate', {
                candidate: data.candidate,
                source: socket.id
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id); // Log when a user disconnects
        if (users[socket.id]) {
            if (users[socket.id].busy) {
                // If the user was busy, notify the other user and mark them as not busy
                for (let id in users) {
                    if (users[id].busy && id !== socket.id) {
                        users[id].socket.emit('peer-disconnected');
                        users[id].busy = false;
                    }
                }
            }
            delete users[socket.id]; // Remove the user from the users object
        }
    });

    // Handle 'skip' event
    socket.on('skip', () => {
        if (users[socket.id]) {
            users[socket.id].busy = false; // Mark the current user as not busy
            // Notify the current peer that the call is ended
            for (let id in users) {
                if (users[id].busy && id !== socket.id) {
                    users[id].socket.emit('peer-disconnected');
                    users[id].busy = false;
                }
            }
        }
        // Find available users (not busy) and randomly select one
        let availableUsers = Object.keys(users).filter(id => id !== socket.id && !users[id].busy);
        if (availableUsers.length > 0) {
            let target = availableUsers[Math.floor(Math.random() * availableUsers.length)];
            users[socket.id].busy = true; // Mark the current user as busy
            users[target].busy = true; // Mark the target user as busy
            socket.emit('new-peer', target); // Emit 'new-peer' event to initiate connection with target
        } else {
            socket.emit('no-users-available'); // If no available users, emit 'no-users-available'
        }
    });

    // Handle 'check-availability' event
    socket.on('check-availability', () => {
        // Find available users (not busy) excluding the current user
        let availableUsers = Object.keys(users).filter(id => id !== socket.id && !users[id].busy);
        if (availableUsers.length > 0) {
            socket.emit('available-users', availableUsers); // Emit 'available-users' with list of available users
        } else {
            socket.emit('no-users-available'); // If no available users, emit 'no-users-available'
        }
    });
});

// Start the server and listen on specified port
server.listen(port, () => {
    console.log('Server is running on port ' + port);
});
