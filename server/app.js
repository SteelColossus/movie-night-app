const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = 3000;

const users = {};

const movies = [
    {
        name: 'Movie 1',
        votes: {}
    },
    {
        name: 'Movie 2',
        votes: {}
    },
    {
        name: 'Movie 3',
        votes: {}
    }
];

// Serve all static files in the /client folder
app.use(express.static(path.join(__dirname, '../client')));

// Tell the server to listen on the given port
http.listen(port, console.log(`Listening on port ${port}.`));

function getRandomToken() {
    return Math.floor(Math.random() * 9999) + 1;
}

io.on('connection', (socket) => {
    const token = getRandomToken();
    socket.token = token;

    users[token] = {
        username: token,
        loggedIn: true
    };
    
    console.log(`User '${users[token].username}' connected.`);

    socket.emit('setup', movies);

    socket.on('votes_changed', (voteDeltas) => {
        const newVotes = {};

        Object.keys(voteDeltas).forEach((key) => {
            const value = voteDeltas[key];
            const movie = movies[key];

            if (movie.votes.hasOwnProperty(socket.token)) {
                movie.votes[socket.token] += value;
            }
            else {
                movie.votes[socket.token] = value;
            }

            if (movie.votes[socket.token] < 0) {
                // Prevent a movie from having less than 0 votes
                movie.votes[socket.token] = 0;
            }

            newVotes[key] = movie.votes;
        });

        io.emit('votes_changed', newVotes);
    });

    socket.on('disconnect', () => {
        const userToRemove = users[socket.token];
        users[socket.token].loggedIn = false;
        console.log(`User '${userToRemove.username}' disconnected.`);
    });
});