document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const context = canvas.getContext('2d');
    const nextCanvas = document.getElementById('nextPieceCanvas');
    const nextContext = nextCanvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');
    const startRestartButton = document.getElementById('startRestartButton');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const finalScoreElement = document.getElementById('finalScore');
    const playerNameInput = document.getElementById('playerName');
    const submitScoreButton = document.getElementById('submitScoreButton');
    const highScoresButton = document.getElementById('highScoresButton');
    const highScoresScreen = document.getElementById('highScoresScreen');
    const highScoresListElement = document.getElementById('highScoresList');
    const closeHighScoresButton = document.getElementById('closeHighScoresButton');

    // Game constants
    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE_BASE = 30;
    const NEXT_COLS = 4;
    const NEXT_ROWS = 4;

    let blockSize = BLOCK_SIZE_BASE;

    const COLORS = [
        null,       // 0: Empty
        '#FF0D0D', // 1: I - Red
        '#0D0DFF', // 2: J - Blue
        '#FF7E0D', // 3: L - Orange
        '#FFFF0D', // 4: O - Yellow
        '#0DFF0D', // 5: S - Green
        '#A10DFF', // 6: T - Purple
        '#FF0DA1'  // 7: Z - Pink (using pink instead of light blue for better contrast)
        //'#0DFFFF' //   : I - Light Blue (alternate)
    ];

    const SHAPES = [
        [], // 0: Placeholder for null
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
        [[1, 0, 0], [1, 1, 1], [0, 0, 0]],                       // J
        [[0, 0, 1], [1, 1, 1], [0, 0, 0]],                       // L
        [[1, 1], [1, 1]],                                         // O
        [[0, 1, 1], [1, 1, 0], [0, 0, 0]],                       // S
        [[0, 1, 0], [1, 1, 1], [0, 0, 0]],                       // T
        [[1, 1, 0], [0, 1, 1], [0, 0, 0]]                        // Z
    ];

    // Game state variables
    let board;
    let currentPiece;
    let nextPiece;
    let score;
    let level;
    let linesCleared;
    let gameOver;
    let dropCounter;
    let dropInterval;
    let gameLoopId;
    let highScores = [];

    // --- Game Logic Functions --- //

    function createEmptyBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function getRandomPiece() {
        const randomIndex = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
        const shape = SHAPES[randomIndex];
        return {
            x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
            y: 0,
            shape: shape,
            colorIndex: randomIndex
        };
    }

    function isValidMove(piece, newX, newY, newShape) {
        const shape = newShape || piece.shape;
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const boardX = newX + x;
                    const boardY = newY + y;
                    if (
                        boardX < 0 || boardX >= COLS || boardY >= ROWS || // Out of bounds
                        (boardY >= 0 && board[boardY][boardX] !== 0)    // Collision with existing piece
                    ) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function rotatePiece(piece) {
        const shape = piece.shape;
        const N = shape.length;
        const newShape = Array.from({ length: N }, () => Array(N).fill(0));

        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                newShape[x][N - 1 - y] = shape[y][x];
            }
        }

        // --- Basic Wall Kick --- (Can be improved with SRS)
        let kickX = 0;
        if (!isValidMove(piece, piece.x, piece.y, newShape)) {
            // Try moving 1 right
            if (isValidMove(piece, piece.x + 1, piece.y, newShape)) {
                kickX = 1;
            } 
            // Try moving 1 left
            else if (isValidMove(piece, piece.x - 1, piece.y, newShape)) {
                kickX = -1;
            }
             // Try moving 2 right (for I piece)
            else if (N > 3 && isValidMove(piece, piece.x + 2, piece.y, newShape)) {
                kickX = 2;
            }
             // Try moving 2 left (for I piece)
            else if (N > 3 && isValidMove(piece, piece.x - 2, piece.y, newShape)) {
                kickX = -2;
            }
            else {
                return; // Rotation not possible
            }
        }

        piece.shape = newShape;
        piece.x += kickX;
    }

    function mergePieceToBoard() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const boardX = currentPiece.x + x;
                    const boardY = currentPiece.y + y;
                    if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
                         board[boardY][boardX] = currentPiece.colorIndex;
                    }
                }
            });
        });
    }

    function clearLines() {
        let linesToRemove = [];
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(cell => cell !== 0)) {
                linesToRemove.push(y);
            }
        }

        if (linesToRemove.length > 0) {
            // Simple "breaking" effect - could be enhanced
            linesToRemove.forEach(y => {
                 // In a real game, you might trigger an animation here
                 // For now, we just remove and shift down
                 board.splice(y, 1);
                 board.unshift(Array(COLS).fill(0));
            });

            // --- Update Score --- 
            const lines = linesToRemove.length;
            let points = 0;
            if (lines === 1) points = 40 * level;
            else if (lines === 2) points = 100 * level;
            else if (lines === 3) points = 300 * level;
            else if (lines >= 4) points = 1200 * level; // Tetris!
            score += points;
            scoreElement.textContent = score;

            // --- Update Level --- 
            linesCleared += lines;
            const newLevel = Math.floor(linesCleared / 10) + 1;
            if (newLevel > level) {
                level = newLevel;
                levelElement.textContent = level;
                // Increase speed (decrease interval)
                dropInterval = Math.max(100, 1000 - (level - 1) * 50);
            }
        }
    }

    function pieceDrop() {
        if (!isValidMove(currentPiece, currentPiece.x, currentPiece.y + 1)) {
            // Piece has landed
            mergePieceToBoard();
            clearLines();
            currentPiece = nextPiece;
            nextPiece = getRandomPiece();
            drawNextPiece();
            if (!isValidMove(currentPiece, currentPiece.x, currentPiece.y)) {
                // Game Over
                gameOver = true;
                cancelAnimationFrame(gameLoopId);
                showGameOverScreen();
            }
        } else {
            currentPiece.y++;
        }
        dropCounter = 0; // Reset counter after any move or landing
    }

    // --- Drawing Functions --- //

     function drawBlock(ctx, x, y, colorIndex, size) {
        if (!colorIndex) return; // Don't draw empty blocks
        
        const color = COLORS[colorIndex];
        const drawX = x * size;
        const drawY = y * size;

        // Base color
        ctx.fillStyle = color;
        ctx.fillRect(drawX, drawY, size, size);

        // Lego stud effect (simple version)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // Lighter overlay for top part of stud
        ctx.beginPath();
        ctx.arc(drawX + size * 0.5, drawY + size * 0.5, size * 0.25, Math.PI, 0); // Top semi-circle
        ctx.fill();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Darker overlay for bottom part of stud
        ctx.beginPath();
        ctx.arc(drawX + size * 0.5, drawY + size * 0.5, size * 0.25, 0, Math.PI); // Bottom semi-circle
        ctx.fill();
        
        // Outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, drawY, size, size);

    }

    function drawBoard() {
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background (optional baseplate effect already in CSS)
        context.fillStyle = '#60a0ff'; // Baseplate color slightly different from CSS bg
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw settled pieces
        board.forEach((row, y) => {
            row.forEach((colorIndex, x) => {
                if (colorIndex) {
                    drawBlock(context, x, y, colorIndex, blockSize);
                }
            });
        });

        // Draw current piece
        if (currentPiece) {
            currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                         drawBlock(context, currentPiece.x + x, currentPiece.y + y, currentPiece.colorIndex, blockSize);
                    }
                });
            });
        }
    }

    function drawNextPiece() {
        nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (nextPiece) {
            const shape = nextPiece.shape;
            const colorIndex = nextPiece.colorIndex;
            const shapeSize = shape.length;
            const nextBlockSize = Math.floor(nextCanvas.width / NEXT_COLS); // Adjust size for preview

             // Center the piece in the preview box
            const startX = Math.floor((NEXT_COLS - shapeSize) / 2);
            const startY = Math.floor((NEXT_ROWS - shapeSize) / 2);

            shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        drawBlock(nextContext, startX + x, startY + y, colorIndex, nextBlockSize);
                    }
                });
            });
        }
    }

    // --- Game Loop --- //

    let lastTime = 0;
    function gameLoop(timestamp = 0) {
        if (gameOver) return;

        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            pieceDrop();
        }

        drawBoard();
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // --- Input Handling --- //

    function handleKeyDown(e) {
        if (gameOver) return;

        switch (e.key) {
            case 'ArrowLeft':
                if (isValidMove(currentPiece, currentPiece.x - 1, currentPiece.y)) {
                    currentPiece.x--;
                }
                break;
            case 'ArrowRight':
                 if (isValidMove(currentPiece, currentPiece.x + 1, currentPiece.y)) {
                    currentPiece.x++;
                }
                break;
            case 'ArrowDown': // Soft drop
                if (isValidMove(currentPiece, currentPiece.x, currentPiece.y + 1)) {
                    currentPiece.y++;
                    dropCounter = 0; // Reset drop timer
                } else {
                    // If pressing down causes landing, trigger landing immediately
                    pieceDrop();
                }
                break;
            case 'ArrowUp': // Rotate (can use 'x' or 'z' too)
            case 'z':
            case 'x':
                rotatePiece(currentPiece);
                break;
            case ' ': // Hard drop
                while (isValidMove(currentPiece, currentPiece.x, currentPiece.y + 1)) {
                    currentPiece.y++;
                }
                pieceDrop(); // Land the piece immediately
                break;
        }
        drawBoard(); // Redraw immediately after input
    }

    // --- Touch Controls --- //
    function setupTouchControls() {
        document.getElementById('leftButton').addEventListener('click', () => handleKeyDown({ key: 'ArrowLeft' }));
        document.getElementById('rightButton').addEventListener('click', () => handleKeyDown({ key: 'ArrowRight' }));
        document.getElementById('rotateButton').addEventListener('click', () => handleKeyDown({ key: 'ArrowUp' }));
        document.getElementById('softDropButton').addEventListener('click', () => handleKeyDown({ key: 'ArrowDown' }));
        document.getElementById('hardDropButton').addEventListener('click', () => handleKeyDown({ key: ' ' })); // Space for hard drop
    }

    // --- High Score Logic --- //

    function loadHighScores() {
        const scores = localStorage.getItem('legoTetrisHighScores');
        highScores = scores ? JSON.parse(scores) : [];
    }

    function saveHighScore(name, score) {
        highScores.push({ name, score });
        highScores.sort((a, b) => b.score - a.score); // Sort descending
        highScores = highScores.slice(0, 10); // Keep only top 10
        localStorage.setItem('legoTetrisHighScores', JSON.stringify(highScores));
    }

    function displayHighScores() {
        highScoresListElement.innerHTML = ''; // Clear previous list
        if (highScores.length === 0) {
            highScoresListElement.innerHTML = '<li>No scores yet!</li>';
        } else {
            highScores.forEach((entry, index) => {
                const li = document.createElement('li');
                li.textContent = `${index + 1}. ${entry.name} - ${entry.score}`;
                highScoresListElement.appendChild(li);
            });
        }
        highScoresScreen.style.display = 'block';
    }

    function showGameOverScreen() {
         finalScoreElement.textContent = score;
         gameOverScreen.style.display = 'block';
         playerNameInput.value = ''; // Clear previous name
         playerNameInput.focus();
    }

    function hideGameOverScreen() {
        gameOverScreen.style.display = 'none';
    }

    function hideHighScoresScreen() {
         highScoresScreen.style.display = 'none';
    }

    // --- Initialization and Reset --- //

     function calculateBlockSize() {
        const availableHeight = window.innerHeight * 0.8; // Use 80% of height
        const availableWidth = document.querySelector('.game-container').offsetWidth * 0.6; // Estimate width available for canvas
        const heightBlockSize = Math.floor((availableHeight - 20) / ROWS); // -20 for padding/borders
        const widthBlockSize = Math.floor((availableWidth - 20) / COLS);
        // Use the smaller dimension to fit, but ensure a minimum size
        blockSize = Math.max(10, Math.min(heightBlockSize, widthBlockSize, BLOCK_SIZE_BASE)); 
        
        // Apply calculated sizes
        canvas.width = COLS * blockSize;
        canvas.height = ROWS * blockSize;
        canvas.style.backgroundSize = `${blockSize}px ${blockSize}px`;

        // Adjust next piece canvas size proportionally
        const nextBaseSize = Math.min(blockSize * 1.5, 60); // Cap preview size
        nextCanvas.width = NEXT_COLS * (nextBaseSize / NEXT_COLS);
        nextCanvas.height = NEXT_ROWS * (nextBaseSize / NEXT_ROWS);
    }

    function resetGame() {
        board = createEmptyBoard();
        score = 0;
        level = 1;
        linesCleared = 0;
        gameOver = false;
        dropCounter = 0;
        dropInterval = 1000; // Initial speed
        currentPiece = getRandomPiece();
        nextPiece = getRandomPiece();

        scoreElement.textContent = score;
        levelElement.textContent = level;
        hideGameOverScreen();
        hideHighScoresScreen();
        calculateBlockSize(); // Recalculate sizes on reset/start
        drawNextPiece();
    }

    function startGame() {
        resetGame();
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
        }
        gameLoop();
        startRestartButton.textContent = 'Restart Game';
    }

    // --- Event Listeners --- //

    startRestartButton.addEventListener('click', startGame);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', () => {
        if (!gameOver) {
            calculateBlockSize();
            drawBoard(); // Redraw board with new size
            drawNextPiece(); // Redraw next piece with new size
        }
    });

    submitScoreButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim() || 'Anonymous';
        saveHighScore(playerName, score);
        hideGameOverScreen();
        displayHighScores(); // Show scores after submitting
        startRestartButton.textContent = 'Start Game'; // Ready for new game
    });

    highScoresButton.addEventListener('click', () => {
        if (!gameOver) { // Pause game if running
             if (gameLoopId) cancelAnimationFrame(gameLoopId);
        }
        loadHighScores(); // Ensure scores are up-to-date
        displayHighScores();
    });

    closeHighScoresButton.addEventListener('click', () => {
        hideHighScoresScreen();
        if (!gameOver) { // Resume game if paused
            // Resume game loop without resetting time if it was running
            if (gameLoopId) requestAnimationFrame(gameLoop); 
        } else {
             startRestartButton.textContent = 'Start Game';
        }
    });

    // --- Initial Setup --- //
    setupTouchControls();
    loadHighScores();
    calculateBlockSize(); // Initial size calculation
    // Draw something initially? Or wait for Start button.
    context.fillStyle = '#60a0ff'; // Initial bg color
    context.fillRect(0, 0, canvas.width, canvas.height);
    nextContext.fillStyle = '#eee';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    context.font = '16px sans-serif';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText('Press Start Game', canvas.width / 2, canvas.height / 3);

}); 