document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tetris-board');
    const context = canvas.getContext('2d');
    const nextBlockCanvas = document.getElementById('next-block');
    const nextBlockContext = nextBlockCanvas.getContext('2d');
    const scoreElement = document.getElementById('score');

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 20;

    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    nextBlockCanvas.width = 4 * BLOCK_SIZE; 
    nextBlockCanvas.height = 4 * BLOCK_SIZE;


    let score = 0;
    let board = [];
    let isGameOver = false;
    
    const INITIAL_DROP_INTERVAL = 1000;
    const SPEED_INCREMENT_SCORE = 500; 
    const DROP_INTERVAL_DECREMENT = 100; 
    const MIN_DROP_INTERVAL = 100; 
    let dropInterval = INITIAL_DROP_INTERVAL;
    let lastTime = 0;

    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = 0;
        }
    }

    const TETROMINOES = {
        'I': { shape: [[1, 1, 1, 1]], color: 'cyan' },
        'L': { shape: [[1, 0, 0], [1, 1, 1]], color: 'orange' },
        'J': { shape: [[0, 0, 1], [1, 1, 1]], color: 'blue' },
        'T': { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple' },
        'O': { shape: [[1, 1], [1, 1]], color: 'yellow' },
        'S': { shape: [[0, 1, 1], [1, 1, 0]], color: 'green' },
        'Z': { shape: [[1, 1, 0], [0, 1, 1]], color: 'red' }
    };

    let currentTetromino = null;
    let nextTetromino = null;
    let currentX = 0;
    let currentY = 0;

    function drawBlock(x, y, color, ctx = context, currentBlockSize = BLOCK_SIZE) {
        ctx.fillStyle = color;
        ctx.fillRect(x * currentBlockSize, y * currentBlockSize, currentBlockSize, currentBlockSize);
        ctx.strokeStyle = 'black';
        ctx.strokeRect(x * currentBlockSize, y * currentBlockSize, currentBlockSize, currentBlockSize);
    }

    function drawBoard() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c]) {
                    drawBlock(c, r, board[r][c]);
                } else {
                    context.fillStyle = '#f0f0f0';
                    context.fillRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    context.strokeStyle = '#ccc';
                    context.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }
    }

    function isValidMove(tetrominoShape, offsetX, offsetY) {
        for (let r = 0; r < tetrominoShape.length; r++) {
            for (let c = 0; c < tetrominoShape[r].length; c++) {
                if (tetrominoShape[r][c]) {
                    let newX = currentX + offsetX + c;
                    let newY = currentY + offsetY + r;

                    if (newX < 0 || newX >= COLS || newY >= ROWS) {
                        return false;
                    }
                    if (newY >= 0 && board[newY] && board[newY][newX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function clearLines() {
        let linesCleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r].every(cell => cell !== 0)) {
                linesCleared++;
                board.splice(r, 1);
                board.unshift(Array(COLS).fill(0));
                r++; 
            }
        }

        if (linesCleared > 0) {
            updateScoreAndSpeed(linesCleared);
        }
    }

    function updateScoreAndSpeed(linesCleared) {
        if (linesCleared === 1) {
            score += 100;
        } else if (linesCleared === 2) {
            score += 300;
        } else if (linesCleared === 3) {
            score += 500;
        } else if (linesCleared >= 4) {
            score += 800;
        }
        scoreElement.textContent = score;

        if (dropInterval > MIN_DROP_INTERVAL) {
            let speedIncreases = Math.floor(score / SPEED_INCREMENT_SCORE);
            let newInterval = INITIAL_DROP_INTERVAL - (speedIncreases * DROP_INTERVAL_DECREMENT);
            dropInterval = Math.max(MIN_DROP_INTERVAL, newInterval);
        }
    }
    
    function lockTetromino() {
        const shape = currentTetromino.shape;
        const color = currentTetromino.color;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    // Check for game over condition: if block locks above the visible board
                    if (currentY + r < 0) { 
                        gameOver();
                        return;
                    }
                    // Ensure the block is within board boundaries before locking
                    if (currentY + r < ROWS && currentX + c < COLS) {
                         board[currentY + r][currentX + c] = color;
                    } else {
                        // This case should ideally be prevented by isValidMove,
                        // but as a fallback, if a block tries to lock outside, it's game over.
                        gameOver();
                        return;
                    }
                }
            }
        }
        clearLines(); 
        if (!isGameOver) {
            spawnNewTetrominoAndPrepareNext();
        }
    }

    function gameOver() {
        isGameOver = true;
        console.log("Game Over");
        alert("Game Over! Score: " + score);
        // Potentially, you might want to stop the gameLoop here explicitly
        // or prevent further actions. The isGameOver flag should handle most of this.
    }
    
    function generateRandomTetromino() {
        const tetrominoNames = Object.keys(TETROMINOES);
        const randomTetrominoName = tetrominoNames[Math.floor(Math.random() * tetrominoNames.length)];
        return JSON.parse(JSON.stringify(TETROMINOES[randomTetrominoName]));
    }

    function drawNextTetromino() {
        if (!nextTetromino) return;
        nextBlockContext.clearRect(0, 0, nextBlockCanvas.width, nextBlockCanvas.height);
        
        const shape = nextTetromino.shape;
        const color = nextTetromino.color;
        const blockSizeForNext = nextBlockCanvas.width / 4; // Assuming max 4 cells wide/high for display

        // Calculate offsets to center the piece in the nextBlockCanvas
        const canvasCenterX = nextBlockCanvas.width / 2;
        const canvasCenterY = nextBlockCanvas.height / 2;
        const shapeWidth = shape[0].length * blockSizeForNext;
        const shapeHeight = shape.length * blockSizeForNext;
        
        const startX = (canvasCenterX - shapeWidth / 2) / blockSizeForNext;
        const startY = (canvasCenterY - shapeHeight/ 2) / blockSizeForNext;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    drawBlock(startX + c, startY + r, color, nextBlockContext, blockSizeForNext);
                }
            }
        }
    }

    function spawnNewTetrominoAndPrepareNext() {
        if (isGameOver) return;
        currentTetromino = nextTetromino || generateRandomTetromino(); 
        nextTetromino = generateRandomTetromino(); 

        currentX = Math.floor(COLS / 2) - Math.floor(currentTetromino.shape[0].length / 2);
        currentY = 0; 

        drawNextTetromino(); 

        if (!isValidMove(currentTetromino.shape, 0, 0)) {
            gameOver();
        }
    }

    function drawCurrentTetromino() {
        if (!currentTetromino || isGameOver) return;
        const shape = currentTetromino.shape;
        const color = currentTetromino.color;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    drawBlock(currentX + c, currentY + r, color);
                }
            }
        }
    }

    function moveLeft() {
        if (isValidMove(currentTetromino.shape, -1, 0)) {
            currentX--;
        }
    }

    function moveRight() {
        if (isValidMove(currentTetromino.shape, 1, 0)) {
            currentX++;
        }
    }

    function moveDown() {
        if (isValidMove(currentTetromino.shape, 0, 1)) {
            currentY++;
        } else {
            lockTetromino();
        }
    }

    function rotate() {
        const originalShape = currentTetromino.shape;
        const newShape = [];
        for (let r = 0; r < originalShape[0].length; r++) {
            newShape[r] = [];
            for (let c = 0; c < originalShape.length; c++) {
                newShape[r][c] = originalShape[originalShape.length - 1 - c][r];
            }
        }

        if (isValidMove(newShape, 0, 0)) {
            currentTetromino.shape = newShape;
        }
    }

    function drop() {
        while (isValidMove(currentTetromino.shape, 0, 1)) {
            currentY++;
        }
        lockTetromino();
    }

    document.addEventListener('keydown', (event) => {
        if (isGameOver) return;

        if (event.key === 'ArrowLeft') {
            moveLeft();
        } else if (event.key === 'ArrowRight') {
            moveRight();
        } else if (event.key === 'ArrowDown') {
            moveDown();
        } else if (event.key === 'ArrowUp') {
            rotate();
        } else if (event.code === 'Space') {
            event.preventDefault(); 
            drop();
        }
        
        if (!isGameOver) { // Re-draw only if game is active
            context.clearRect(0, 0, canvas.width, canvas.height);
            drawBoard();
            drawCurrentTetromino();
        }
    });

    function gameLoop(timestamp = 0) {
        if (isGameOver) {
            console.log("Game loop stopped.");
            return;
        }

        const deltaTime = timestamp - lastTime;

        if (deltaTime > dropInterval) {
            moveDown();
            lastTime = timestamp; 
        }
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawBoard();
        drawCurrentTetromino();

        requestAnimationFrame(gameLoop);
    }

    // Initial Setup
    scoreElement.textContent = score; 
    spawnNewTetrominoAndPrepareNext(); 
    drawBoard();
    // drawNextTetromino(); // Already called in spawnNewTetrominoAndPrepareNext
    gameLoop();
});
