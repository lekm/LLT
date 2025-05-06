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
        '#D90429', // 1: I - Red (Brighter)
        '#00509d', // 2: J - Blue (Deeper)
        '#f77f00', // 3: L - Orange (Standard)
        '#FFCF00', // 4: O - Yellow (Standard)
        '#2a9d8f', // 5: S - Green (Tealish)
        '#6a0dad', // 6: T - Purple (Standard)
        '#e71d73'  // 7: Z - Pink (Vibrant)
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
        // Play sound: rotate
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
        // Add jiggle effect when piece locks
        canvas.classList.add('piece-lock-jiggle');
        setTimeout(() => canvas.classList.remove('piece-lock-jiggle'), 150); 
        // Play sound: lock
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

            // --- Add flash effect --- 
            canvas.classList.add('line-clear-flash');
            setTimeout(() => canvas.classList.remove('line-clear-flash'), 300);
            // Play sound: line_clear

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
            mergePieceToBoard(); // Lock sound/effect happens here
            clearLines(); // Clear sound/effect happens here
            currentPiece = nextPiece;
            nextPiece = getRandomPiece();
            // Play sound: piece_spawn (optional, maybe on game start)
            drawNextPiece();
            if (!isValidMove(currentPiece, currentPiece.x, currentPiece.y)) {
                // Game Over
                gameOver = true;
                cancelAnimationFrame(gameLoopId);
                // Play sound: game_over
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
        const studSize = size * 0.25;
        const studSpacing = size * 0.125; // Space from edge to stud center
        const studRadius = studSize / 2;

        // --- 3D Effect Base --- 
        // Slightly darker base for depth
        ctx.fillStyle = shadeColor(color, -15); // Function to darken color slightly
        ctx.fillRect(drawX, drawY, size, size);
        
        // Main block color with highlight gradient
        const gradient = ctx.createLinearGradient(drawX, drawY, drawX, drawY + size);
        gradient.addColorStop(0, shadeColor(color, 10)); // Lighter top
        gradient.addColorStop(1, color); // Normal bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(drawX + 1, drawY + 1, size - 2, size - 3); // Inset slightly

        // --- Draw 4 Studs --- 
        const studPositions = [
            { cx: drawX + studSpacing + studRadius, cy: drawY + studSpacing + studRadius },
            { cx: drawX + size - studSpacing - studRadius, cy: drawY + studSpacing + studRadius },
            { cx: drawX + studSpacing + studRadius, cy: drawY + size - studSpacing - studRadius },
            { cx: drawX + size - studSpacing - studRadius, cy: drawY + size - studSpacing - studRadius }
        ];
        
        studPositions.forEach(pos => {
            // Stud base (slightly darker)
             ctx.fillStyle = shadeColor(color, -10);
             ctx.beginPath();
             ctx.arc(pos.cx, pos.cy, studRadius, 0, Math.PI * 2);
             ctx.fill();

             // Stud top highlight (lighter)
             const studGradient = ctx.createRadialGradient(pos.cx, pos.cy - studRadius*0.5, studRadius*0.2, pos.cx, pos.cy, studRadius);
             studGradient.addColorStop(0, shadeColor(color, 25)); 
             studGradient.addColorStop(1, color);
             ctx.fillStyle = studGradient;
             ctx.beginPath();
             ctx.arc(pos.cx, pos.cy, studRadius, 0, Math.PI * 2);
             ctx.fill();
             
             // Subtle stud border
             ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
             ctx.lineWidth = 0.5;
             ctx.stroke();
        });

        // --- Block Outline --- 
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, drawY, size, size);
    }
    
    // Helper function to lighten/darken colors
    function shadeColor(color, percent) {
        let R = parseInt(color.substring(1,3),16);
        let G = parseInt(color.substring(3,5),16);
        let B = parseInt(color.substring(5,7),16);

        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);

        R = (R<255)?R:255;  
        G = (G<255)?G:255;  
        B = (B<255)?B:255;  
        
        R = Math.max(0, R);
        G = Math.max(0, G);
        B = Math.max(0, B);

        const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
        const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
        const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

        return "#"+RR+GG+BB;
    }

    function drawBoard() {
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background (Handled by CSS now)
        // context.fillStyle = '#00509d'; 
        // context.fillRect(0, 0, canvas.width, canvas.height);

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
                    // Play sound: move
                }
                break;
            case 'ArrowRight':
                 if (isValidMove(currentPiece, currentPiece.x + 1, currentPiece.y)) {
                    currentPiece.x++;
                    // Play sound: move
                }
                break;
            case 'ArrowDown': // Soft drop
                if (isValidMove(currentPiece, currentPiece.x, currentPiece.y + 1)) {
                    currentPiece.y++;
                    dropCounter = 0; 
                    // Play sound: move (optional for soft drop)
                } else {
                    pieceDrop();
                }
                break;
            case 'ArrowUp': 
            case 'z':
            case 'x':
                rotatePiece(currentPiece);
                // Rotate sound called inside rotatePiece
                break;
            case ' ': // Hard drop
                // Play sound: hard_drop (optional)
                while (isValidMove(currentPiece, currentPiece.x, currentPiece.y + 1)) {
                    currentPiece.y++;
                }
                pieceDrop(); // Land the piece immediately
                break;
        }
        // drawBoard(); // Already removed
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
         // Add simple animation to modal appearance
         gameOverScreen.style.animation = 'fadeIn 0.3s ease-out'; 
         playerNameInput.value = '';
         playerNameInput.focus();
         // Play sound: game_over (already noted in pieceDrop)
    }

    function hideGameOverScreen() {
        gameOverScreen.style.display = 'none';
    }

    function hideHighScoresScreen() {
         highScoresScreen.style.display = 'none';
    }

    // --- Initialization and Reset --- //

     function calculateBlockSize() {
        const mainWrapperWidth = document.querySelector('.main-wrapper').offsetWidth;
        // Try to base height calculation on available width to maintain aspect ratio better
        const availableHeight = window.innerHeight * 0.9 - document.querySelector('.game-info').offsetHeight - 50; // Approx height minus info panel & padding
        const availableWidth = mainWrapperWidth * 0.9; // Use 90% of wrapper width

        const heightBlockSize = Math.floor(availableHeight / ROWS);
        const widthBlockSize = Math.floor(availableWidth / COLS);
        
        blockSize = Math.max(10, Math.min(heightBlockSize, widthBlockSize, BLOCK_SIZE_BASE)); 
        
        // Apply calculated sizes
        canvas.width = COLS * blockSize;
        canvas.height = ROWS * blockSize;
        // Dynamically set the background size for the baseplate effect
        const bgSize = `${blockSize}px ${blockSize}px`;
        canvas.style.backgroundSize = `${bgSize}, ${bgSize}, ${bgSize}, ${bgSize}`;

        // Adjust next piece canvas size proportionally
        const nextPreviewSize = Math.floor(blockSize * 4 * 0.8); // Aim for ~80% of 4 blocks wide
        const nextBlockSize = Math.floor(nextPreviewSize / NEXT_COLS);
        nextCanvas.width = NEXT_COLS * nextBlockSize;
        nextCanvas.height = NEXT_ROWS * nextBlockSize;
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

    // Add basic fadeIn keyframes if not already in CSS (it isn't)
    // (Alternatively, add this to style.css)
    if (!document.styleSheets[0].cssRules.find(rule => rule.name === 'fadeIn')) {
        document.styleSheets[0].insertRule(`
            @keyframes fadeIn { 
                from { opacity: 0; transform: scale(0.9); } 
                to { opacity: 1; transform: scale(1); } 
            }
        `, document.styleSheets[0].cssRules.length);
    }

}); 