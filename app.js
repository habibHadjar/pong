const express = require('express')
const http = require('http')
const socketIO = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = socketIO(server)

app.use(express.static(__dirname + '/'))

const gameState = {
    players: {},
    ball: { x: 400, y: 200, speedX: 5, speedY: 5 },
    scores: { player1: 0, player2: 0 },
    maxScore: 3
}

function moveBall() {
    gameState.ball.x += gameState.ball.speedX
    gameState.ball.y += gameState.ball.speedY

    // Ball collision with top/bottom walls
    if (gameState.ball.y < 10 || gameState.ball.y > 390) {
        gameState.ball.speedY = -gameState.ball.speedY
    }

    // Ball collision with paddles
    let player1Paddle = gameState.players.player1
    let player2Paddle = gameState.players.player2
    if (player1Paddle && gameState.ball.x < 20 && gameState.ball.y > player1Paddle.y && gameState.ball.y < player1Paddle.y + 100) {
        gameState.ball.speedX = -gameState.ball.speedX
    } else if (player2Paddle && gameState.ball.x > 780 && gameState.ball.y > player2Paddle.y && gameState.ball.y < player2Paddle.y + 100) {
        gameState.ball.speedX = -gameState.ball.speedX
    }

    // Ball out of bounds (scoring)
    if (gameState.ball.x < 0 || gameState.ball.x > 800) {
        if (gameState.ball.x < 0) {
            gameState.scores.player2 += 1
        } else {
            gameState.scores.player1 += 1
        }
        // Check for game over
        if (gameState.scores.player1 >= gameState.maxScore || gameState.scores.player2 >= gameState.maxScore) {
            gameState.gameOver = true
        } else {
            // Reset ball position
            gameState.ball.x = 400
            gameState.ball.y = 200
            gameState.ball.speedX = -gameState.ball.speedX
            gameState.ball.speedY = -gameState.ball.speedY
        }
    }
}

setInterval(() => {
    if (!gameState.gameOver) {
        moveBall()
    }
    io.emit('gameState', gameState)
}, 1000 / 60) // 60 times per second

io.on('connection', (socket) => {
    console.log('New connection: ' + socket.id)

    // Assign player number
    if (!gameState.players.player1) {
        gameState.players.player1 = { id: socket.id, y: 150, isReady: false }
    } else if (!gameState.players.player2 && socket.id !== gameState.players.player1.id) {
        gameState.players.player2 = { id: socket.id, y: 150, isReady: false }
    }

    // Send initial game state
    io.emit('gameState', gameState)

    socket.on('playerReady', () => {
        if (socket.id === gameState.players.player1.id) {
            gameState.players.player1.isReady = true
        } else if (socket.id === gameState.players.player2.id) {
            gameState.players.player2.isReady = true
        }

        // Start game if both players are ready
        if (gameState.players.player1.isReady && gameState.players.player2.isReady) {
            gameState.isGameActive = true
        }
    })

    socket.on('paddleMove', (paddleY) => {
        if (socket.id === gameState.players.player1.id) {
            gameState.players.player1.y = paddleY
        } else if (socket.id === gameState.players.player2.id) {
            gameState.players.player2.y = paddleY
        }
    })

    socket.on('disconnect', () => {
        console.log('Player disconnected: ' + socket.id)
        if (socket.id === gameState.players.player1.id) {
            delete gameState.players.player1
        } else if (socket.id === gameState.players.player2.id) {
            delete gameState.players.player2
        }
        if (Object.keys(gameState.players).length < 2) {
            gameState.gameOver = false
            gameState.scores.player1 = 0
            gameState.scores.player2 = 0
        }
        io.emit('gameState', gameState)
    })

    socket.on('restartGame', () => {
        gameState.scores.player1 = 0
        gameState.scores.player2 = 0
        gameState.gameOver = false
        gameState.players.player1.isReady = false
        gameState.players.player2.isReady = false
        gameState.isGameActive = false
        io.emit('gameState', gameState)
    })

})

server.listen(3000, () => {
    console.log('Server listening on port 3000')
})
