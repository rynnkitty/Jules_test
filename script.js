// script.js

// --- Global Constants ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 20;
const NEXT_BLOCK_AREA_SIZE = 4;

const TETROMINOES = {
    'I': { shape: [[1, 1, 1, 1]], color: 'cyan' },
    'L': { shape: [[1, 0, 0], [1, 1, 1]], color: 'orange' },
    'J': { shape: [[0, 0, 1], [1, 1, 1]], color: 'blue' },
    'T': { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple' },
    'O': { shape: [[1, 1], [1, 1]], color: 'yellow' },
    'S': { shape: [[0, 1, 1], [1, 1, 0]], color: 'green' },
    'Z': { shape: [[1, 1, 0], [0, 1, 1]], color: 'red' }
};

const INITIAL_DROP_INTERVAL = 1000;
const SPEED_INCREMENT_SCORE = 500;
const DROP_INTERVAL_DECREMENT = 100;
const MIN_DROP_INTERVAL = 100;

// --- Game State Definitions ---
const GAME_STATE = {
    PRE_GAME: 'PRE_GAME',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER'
};
let currentGameState = GAME_STATE.PRE_GAME;

// --- Game Settings Variables ---
let targetScore = 0; // 0 for endless
let botDifficulty = 5; // 1-10 (global, updated from UI)

// --- DOM Elements ---
let settingsOverlay, settingsModal, botDifficultySlider, difficultyValueSpan, targetScoreInput, startGameBtn;
let mainContainer;
let gameOverOverlay, gameOverModal, winnerMessageElement, playAgainBtn;

// --- Game Instances ---
let playerGame;
let botGame;

// --- Bot Difficulty Helper ---
function calculateBotMoveDelayValue(difficulty) {
    // Difficulty 1 (slowest) to 10 (fastest)
    // New mapping based on feedback: Level 8 should be around old Level 5 (450ms)
    // Levels are generally slower than the previous curve.
    switch (parseInt(difficulty, 10)) {
        case 1: return 1500; // Significantly slower start
        case 2: return 1300;
        case 3: return 1100;
        case 4: return 950;
        case 5: return 800; // New Level 5
        case 6: return 650;
        case 7: return 550;
        case 8: return 450; // This was the old Level 5 speed
        case 9: return 350; // Faster, but more manageable
        case 10: return 250; // Fastest, challenging
        default: return 800; // Default to new Level 5 speed
    }
}

// --- TetrisGame Class ---
class TetrisGame {
    constructor(canvasId, nextBlockCanvasId, scoreElementId, isBotInstance = false) {
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext('2d');
        this.nextBlockCanvas = document.getElementById(nextBlockCanvasId);
        this.nextBlockContext = this.nextBlockCanvas.getContext('2d');
        this.scoreElement = document.getElementById(scoreElementId);
        this.isBot = isBotInstance;

        this.board = [];
        this.score = 0;
        this.dropInterval = INITIAL_DROP_INTERVAL;
        this.isGameOver = false; 
        this.currentTetromino = null;
        this.nextTetromino = null;
        this.currentX = 0;
        this.currentY = 0;
        this.lastTime = 0;
        this.winner = false; // Not used in class, global check handles winner assignment
        this.animationFrameId = null; 

        if (this.isBot) {
            this.botMoveDelay = 500; 
            this.lastBotMoveTime = 0;
        }
        
        this.canvas.width = COLS * BLOCK_SIZE;
        this.canvas.height = ROWS * BLOCK_SIZE;
        this.nextBlockCanvas.width = NEXT_BLOCK_AREA_SIZE * BLOCK_SIZE;
        this.nextBlockCanvas.height = NEXT_BLOCK_AREA_SIZE * BLOCK_SIZE;
        
        this.gameLoop = this.gameLoop.bind(this);
    }

    initBoard() {
        this.board = [];
        for (let r = 0; r < ROWS; r++) {
            this.board[r] = Array(COLS).fill(0);
        }
    }

    initializeGame() {
        this.initBoard();
        this.score = 0;
        this.dropInterval = INITIAL_DROP_INTERVAL;
        this.isGameOver = false;
        // this.winner = false; // Winner is determined globally
        if(this.scoreElement) this.scoreElement.textContent = this.score;
        
        this.spawnNewTetrominoAndPrepareNext(); 
        this.drawBoard();
        this.drawCurrentTetromino();
        
        this.lastTime = performance.now();
        if (this.isBot) {
            this.lastBotMoveTime = performance.now();
        }

        if (!this.animationFrameId) {
            this.gameLoop();
        }
    }
    
    stopGameLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    handleInstanceGameOver() { 
        this.isGameOver = true; // Mark this instance as over
        this.context.fillStyle = 'rgba(0,0,0,0.75)';
        this.context.fillRect(0, this.canvas.height / 2 - 30, this.canvas.width, 60);
        this.context.font = '20px Arial';
        this.context.fillStyle = 'white';
        this.context.textAlign = 'center';
        this.context.fillText('Board Full!', this.canvas.width / 2, this.canvas.height / 2 + 8);
        
        checkOverallGameOver(); // Check if the overall game should end
    }

    gameLoop(timestamp = 0) {
        this.animationFrameId = requestAnimationFrame(this.gameLoop);

        if (this.isGameOver) { // If this instance's board is full, it doesn't play
            return;
        }
        
        // Active game logic only if the overall game state is PLAYING
        if (currentGameState === GAME_STATE.PLAYING) {
            if (this.isBot) {
                if (timestamp - this.lastBotMoveTime > this.botMoveDelay) {
                    if(this.currentTetromino){ 
                         const bestMove = this.findBestMove();
                         if (bestMove) this.executeBestMove(bestMove);
                         else this.drop(); 
                    }
                    this.lastBotMoveTime = timestamp;
                }
            } else { 
                if (timestamp - this.lastTime >= this.dropInterval) {
                    this.moveDown(); 
                    this.lastTime = timestamp;
                }
            }
        }
        
        this.drawBoard();
        this.drawCurrentTetromino();
    }

    updateScoreAndSpeed(linesCleared) {
        if (linesCleared === 1) this.score += 100;
        else if (linesCleared === 2) this.score += 300;
        else if (linesCleared === 3) this.score += 500;
        else if (linesCleared >= 4) this.score += 800;
        if(this.scoreElement) this.scoreElement.textContent = this.score;

        if (this.dropInterval > MIN_DROP_INTERVAL) {
            let speedIncreases = Math.floor(this.score / SPEED_INCREMENT_SCORE);
            let newInterval = INITIAL_DROP_INTERVAL - (speedIncreases * DROP_INTERVAL_DECREMENT);
            this.dropInterval = Math.max(MIN_DROP_INTERVAL, newInterval);
        }
        checkOverallGameOver(); // Call global checker after score update
    }
    
    // --- Paste other TetrisGame methods here (drawBlock, drawBoard, etc. - no changes to these from previous version) ---
    drawBlock(x, y, color, context, currentBlockSize = BLOCK_SIZE) {
        context.fillStyle = color;
        context.fillRect(x * currentBlockSize, y * currentBlockSize, currentBlockSize, currentBlockSize);
        context.strokeStyle = 'black';
        context.strokeRect(x * currentBlockSize, y * currentBlockSize, currentBlockSize, currentBlockSize);
    }
    drawBoard() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (this.board[r][c]) {
                    this.drawBlock(c, r, this.board[r][c], this.context);
                } else {
                    this.context.fillStyle = '#f0f0f0';
                    this.context.fillRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    this.context.strokeStyle = '#ccc';
                    this.context.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }
    }
    drawCurrentTetromino() {
        if (!this.currentTetromino) return; 
        if (this.isGameOver && currentGameState !== GAME_STATE.PLAYING) return; 

        const shape = this.currentTetromino.shape;
        const color = this.currentTetromino.color;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    this.drawBlock(this.currentX + c, this.currentY + r, color, this.context);
                }
            }
        }
    }
    generateRandomTetromino() {
        const tetrominoNames = Object.keys(TETROMINOES);
        const randomTetrominoName = tetrominoNames[Math.floor(Math.random() * tetrominoNames.length)];
        return JSON.parse(JSON.stringify(TETROMINOES[randomTetrominoName]));
    }
    drawNextTetromino() {
        this.nextBlockContext.clearRect(0, 0, this.nextBlockCanvas.width, this.nextBlockCanvas.height);
        if (!this.nextTetromino) return;
        const shape = this.nextTetromino.shape;
        const color = this.nextTetromino.color;
        const nextBlockDisplaySize = this.nextBlockCanvas.width / NEXT_BLOCK_AREA_SIZE;
        const startX = (NEXT_BLOCK_AREA_SIZE - shape[0].length) / 2;
        const startY = (NEXT_BLOCK_AREA_SIZE - shape.length) / 2;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    this.drawBlock(startX + c, startY + r, color, this.nextBlockContext, nextBlockDisplaySize);
                }
            }
        }
    }
    spawnNewTetrominoAndPrepareNext() {
        this.currentTetromino = this.nextTetromino || this.generateRandomTetromino();
        this.nextTetromino = this.generateRandomTetromino();
        this.currentX = Math.floor(COLS / 2) - Math.floor(this.currentTetromino.shape[0].length / 2);
        this.currentY = 0;
        this.drawNextTetromino();
        if (!this.isValidMove(this.currentTetromino.shape, 0, 0)) {
            this.handleInstanceGameOver(); 
        }
    }
    isValidMove(tetrominoShape, offsetX, offsetY) {
        for (let r = 0; r < tetrominoShape.length; r++) {
            for (let c = 0; c < tetrominoShape[r].length; c++) {
                if (tetrominoShape[r][c]) {
                    let newX = this.currentX + offsetX + c;
                    let newY = this.currentY + offsetY + r;
                    if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
                    if (newY >= 0 && this.board[newY] && this.board[newY][newX] !== 0) return false;
                }
            }
        }
        return true;
    }
    rotate() {
        if (!this.currentTetromino) return;
        const originalShape = this.currentTetromino.shape;
        const newShape = [];
        for (let r = 0; r < originalShape[0].length; r++) {
            newShape[r] = [];
            for (let c = 0; c < originalShape.length; c++) {
                newShape[r][c] = originalShape[originalShape.length - 1 - c][r];
            }
        }
        if (this.isValidMove(newShape, 0, 0)) {
            this.currentTetromino.shape = newShape;
        }
    }
    moveLeft() { if (this.currentTetromino && this.isValidMove(this.currentTetromino.shape, -1, 0)) this.currentX--; }
    moveRight() { if (this.currentTetromino && this.isValidMove(this.currentTetromino.shape, 1, 0)) this.currentX++; }
    moveDown() {
        if (!this.currentTetromino) return;
        if (this.isValidMove(this.currentTetromino.shape, 0, 1)) {
            this.currentY++;
        } else {
            this.lockTetromino();
        }
    }
    drop() {
        if (!this.currentTetromino) return;
        while (this.isValidMove(this.currentTetromino.shape, 0, 1)) {
            this.currentY++;
        }
        this.lockTetromino();
    }
    lockTetromino() {
        if (!this.currentTetromino) return;
        const shape = this.currentTetromino.shape;
        const color = this.currentTetromino.color;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    if (this.currentY + r < 0) { this.handleInstanceGameOver(); return; }
                    if (this.currentY + r < ROWS && this.currentX + c >= 0 && this.currentX + c < COLS) {
                       this.board[this.currentY + r][this.currentX + c] = color;
                    } else { this.handleInstanceGameOver(); return; }
                }
            }
        }
        this.clearLines(); 
        if (!this.isGameOver) { 
            this.spawnNewTetrominoAndPrepareNext();
        }
    }
    clearLines() {
        let linesCleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (this.board[r].every(cell => cell !== 0)) {
                linesCleared++;
                this.board.splice(r, 1);
                this.board.unshift(Array(COLS).fill(0));
                r++; 
            }
        }
        if (linesCleared > 0) {
            this.updateScoreAndSpeed(linesCleared);
        }
    }
    findBestMove() {
        if (!this.currentTetromino) return null;
        let bestScore = -Infinity;
        let bestMove = null; 
        const originalShape = JSON.parse(JSON.stringify(this.currentTetromino.shape));
        for (let rCount = 0; rCount < 4; rCount++) {
            let currentShape = this.getRotatedShape(originalShape, rCount);
            for (let x = -2; x < COLS; x++) { 
                if (this.isValidInitialPosition(currentShape, x)) {
                    let { landingY, tempBoard } = this.simulateDrop(currentShape, x);
                    if (tempBoard) { 
                        let { boardAfterClear, linesCleared } = this.simulateClearLines(tempBoard);
                        let score = this.evaluateBoardState(boardAfterClear, linesCleared, landingY, currentShape);
                        if (score > bestScore) {
                            bestScore = score;
                            bestMove = { rotationCount: rCount, x: x, score: score };
                        }
                    }
                }
            }
        }
        return bestMove;
    }
    getRotatedShape(shape, rotations) {
        let newShape = JSON.parse(JSON.stringify(shape));
        for (let i = 0; i < rotations; i++) {
            const tempShape = [];
            if (newShape.length === 0 || newShape[0].length === 0) return newShape;
            for (let r = 0; r < newShape[0].length; r++) {
                tempShape[r] = [];
                for (let c = 0; c < newShape.length; c++) {
                    tempShape[r][c] = newShape[newShape.length - 1 - c][r];
                }
            }
            newShape = tempShape;
        }
        return newShape;
    }
    isValidInitialPosition(shape, xPos) {
        if (!shape || shape.length === 0 || shape[0].length === 0) return false;
        for (let c = 0; c < shape[0].length; c++) {
            let hasBlockInFirstRowCol = false;
            for(let r=0; r < shape.length; r++){ if(shape[r][c]){ hasBlockInFirstRowCol = true; break; } }
            if(hasBlockInFirstRowCol){
                 if (xPos + c < 0 || xPos + c >= COLS) {
                    for(let r_check = 0; r_check < shape.length; r_check++){ if(shape[r_check][c]) return false; }
                 }
            }
        }
        return true;
    }
    simulateDrop(shape, xPos) {
        let tempBoard = JSON.parse(JSON.stringify(this.board));
        let currentY = 0;
        for(let r = 0; r < shape.length; r++) {
            let hasBlockInRow = false;
            for(let c = 0; c < shape[r].length; c++) { if(shape[r][c]) { hasBlockInRow = true; break; } }
            if(hasBlockInRow) { currentY = -r; break; }
        }
        while (true) {
            let canMoveDown = true;
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c]) {
                        let boardX = xPos + c; let boardY = currentY + r + 1; 
                        if (boardX < 0 || boardX >= COLS) { canMoveDown = false; break; }
                        if (boardY >= ROWS || (boardY >=0 && tempBoard[boardY] && tempBoard[boardY][boardX] !== 0)) {
                            canMoveDown = false; break;
                        }
                    }
                }
                if (!canMoveDown) break;
            }
            if (canMoveDown) currentY++; else break; 
        }
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] && (currentY + r < 0)) { return { landingY: currentY, tempBoard: null }; }
            }
        }
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                     if (currentY + r >= 0 && currentY + r < ROWS && xPos + c >= 0 && xPos + c < COLS) {
                        tempBoard[currentY + r][xPos + c] = 'bot-placed'; 
                     } else { return { landingY: currentY, tempBoard: null }; }
                }
            }
        }
        return { landingY: currentY, tempBoard: tempBoard };
    }
    simulateClearLines(boardState) {
        let tempBoard = JSON.parse(JSON.stringify(boardState));
        let linesCleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (tempBoard[r].every(cell => cell !== 0)) {
                linesCleared++; tempBoard.splice(r, 1); tempBoard.unshift(Array(COLS).fill(0)); r++; 
            }
        }
        return { boardAfterClear: tempBoard, linesCleared: linesCleared };
    }
    evaluateBoardState(boardState, linesCleared, landingY, pieceShape) {
        const W_LINES_CLEARED = 500, W_AGGREGATE_HEIGHT = -10, W_HOLES = -200, W_BUMPINESS = -5, W_LANDING_HEIGHT = -2;
        let score = 0; score += linesCleared * W_LINES_CLEARED;
        let { aggregateHeight, columnHeights } = this.calculateAggregateHeightAndColumnHeights(boardState);
        score += aggregateHeight * W_AGGREGATE_HEIGHT;
        score += this.countHoles(boardState, columnHeights) * W_HOLES;
        score += this.calculateBumpiness(columnHeights) * W_BUMPINESS;
        let pieceHeightSum = 0, pieceBlockCount = 0;
        if(pieceShape){
            for(let r_shape=0; r_shape<pieceShape.length; r_shape++){ 
                for(let c_shape=0; c_shape<pieceShape[r_shape].length; c_shape++){ 
                    if(pieceShape[r_shape][c_shape]){ pieceHeightSum += (landingY + r_shape); pieceBlockCount++; }
                }
            }
        }
        if(pieceBlockCount > 0) score += (pieceHeightSum / pieceBlockCount) * W_LANDING_HEIGHT;
        return score;
    }
    calculateAggregateHeightAndColumnHeights(boardState) {
        let aggregateHeight = 0; let columnHeights = Array(COLS).fill(0);
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) { if (boardState[r][c] !== 0) { columnHeights[c] = ROWS - r; break; } }
            aggregateHeight += columnHeights[c];
        }
        return { aggregateHeight, columnHeights };
    }
    countHoles(boardState, columnHeights) {
        let holes = 0;
        for (let c = 0; c < COLS; c++) {
            for (let r = ROWS - columnHeights[c] + 1; r < ROWS; r++) { if (boardState[r][c] === 0) holes++; }
        }
        return holes;
    }
    calculateBumpiness(columnHeights) {
        let bumpiness = 0;
        for (let c = 0; c < COLS - 1; c++) bumpiness += Math.abs(columnHeights[c] - columnHeights[c+1]);
        return bumpiness;
    }
    executeBestMove(bestMove) {
        if (!bestMove || !this.currentTetromino) return;
        const originalShapeForRotation = JSON.parse(JSON.stringify(this.currentTetromino.shape));
        this.currentTetromino.shape = this.getRotatedShape(originalShapeForRotation, bestMove.rotationCount);
        this.currentX = bestMove.x;
        this.currentY = 0; 
        let topMostBlockRow = Infinity;
        if(this.currentTetromino.shape && this.currentTetromino.shape.length > 0){
            for(let r_shape=0; r_shape < this.currentTetromino.shape.length; r_shape++){ 
                let foundBlockInRow = false;
                for(let c_shape=0; c_shape < this.currentTetromino.shape[r_shape].length; c_shape++){ 
                    if(this.currentTetromino.shape[r_shape][c_shape]){ topMostBlockRow = Math.min(topMostBlockRow, r_shape); foundBlockInRow = true; break; }
                }
                 if(foundBlockInRow) break;
            }
        }
        if(topMostBlockRow !== Infinity && topMostBlockRow < this.currentTetromino.shape.length){ this.currentY = -topMostBlockRow; }
        else { this.currentY = 0; }
        this.drop(); 
    }
}

// --- Global Game Management Functions ---
function initializeDOMReferences() {
    settingsOverlay = document.getElementById('settings-overlay');
    settingsModal = document.getElementById('settings-modal');
    botDifficultySlider = document.getElementById('bot-difficulty');
    difficultyValueSpan = document.getElementById('difficulty-value');
    targetScoreInput = document.getElementById('target-score');
    startGameBtn = document.getElementById('start-game-btn');
    mainContainer = document.getElementById('main-container');

    gameOverOverlay = document.getElementById('game-over-overlay');
    gameOverModal = document.getElementById('game-over-modal');
    winnerMessageElement = document.getElementById('winner-message'); 
    playAgainBtn = document.getElementById('play-again-btn');
}

function showSettingsScreen() {
    currentGameState = GAME_STATE.PRE_GAME;
    settingsOverlay.style.display = 'flex';
    mainContainer.style.display = 'none';
    gameOverOverlay.style.display = 'none';
}

function showGameScreen() {
    currentGameState = GAME_STATE.PLAYING;
    settingsOverlay.style.display = 'none';
    mainContainer.style.display = 'flex';
    gameOverOverlay.style.display = 'none';
}

function showGameOverScreen(winnerMsgStr) {
    currentGameState = GAME_STATE.GAME_OVER;
    // mainContainer remains visible to show final board states
    gameOverOverlay.style.display = 'flex';
    
    if (winnerMessageElement) {
        winnerMessageElement.textContent = winnerMsgStr;
    }
}

function setupEventListeners() {
    botDifficultySlider.addEventListener('input', (e) => {
        difficultyValueSpan.textContent = e.target.value;
    });

    startGameBtn.addEventListener('click', () => {
        botDifficulty = parseInt(botDifficultySlider.value, 10);
        targetScore = parseInt(targetScoreInput.value, 10);
        if (isNaN(targetScore) || targetScore < 0) {
            targetScore = 0; 
            targetScoreInput.value = 0;
        }
        
        showGameScreen();
        startNewGame();
    });

    playAgainBtn.addEventListener('click', () => {
        // Game loops are already stopped by checkOverallGameOver or will stop due to state change
        showSettingsScreen();
    });
}

function stopAllGameLoops() {
    if (playerGame && typeof playerGame.stopGameLoop === 'function') {
        playerGame.stopGameLoop();
    }
    if (botGame && typeof botGame.stopGameLoop === 'function') {
        botGame.stopGameLoop();
    }
}

function startNewGame() {
    stopAllGameLoops(); // Ensure any previous loops are stopped

    playerGame = new TetrisGame('player-canvas', 'player-next-block', 'player-score', false);
    playerGame.initializeGame();

    botGame = new TetrisGame('bot-canvas', 'bot-next-block', 'bot-score', true);
    botGame.botMoveDelay = calculateBotMoveDelayValue(botDifficulty); 
    botGame.initializeGame();
}

function checkOverallGameOver() {
    if (currentGameState !== GAME_STATE.PLAYING) return false;

    let playerWinsByScore = false;
    let botWinsByScore = false;
    let playerWinsByTopOut = false; // Not explicitly used to set final winner, but good for clarity
    let botWinsByTopOut = false;   // Not explicitly used to set final winner
    let reason = "";

    // Check target score only if it's set meaningfully
    if (targetScore > 0) {
        if (playerGame && playerGame.score >= targetScore) {
            playerWinsByScore = true;
        }
        if (botGame && botGame.score >= targetScore) {
            botWinsByScore = true;
        }
    }

    const playerToppedOut = playerGame && playerGame.isGameOver;
    const botToppedOut = botGame && botGame.isGameOver;

    // Determine winner based on score and top-out conditions
    if (playerWinsByScore && botWinsByScore) { // Both reached target
        if (playerGame.score > botGame.score) {
            reason = `Player wins by reaching target score of ${targetScore} with a higher score!`;
        } else if (botGame.score > playerGame.score) {
            reason = `Bot wins by reaching target score of ${targetScore} with a higher score!`;
        } else {
            reason = `It's a Draw! Both reached target score of ${targetScore} simultaneously!`;
        }
    } else if (playerWinsByScore) {
        reason = `Player wins by reaching target score of ${targetScore}!`;
    } else if (botWinsByScore) {
        reason = `Bot wins by reaching target score of ${targetScore}!`;
    } else { // No one reached target score, check top-out
        if (playerToppedOut && botToppedOut) {
            if (playerGame.score > botGame.score) {
                reason = "Both players topped out! Player wins on score!";
            } else if (botGame.score > playerGame.score) {
                reason = "Both players topped out! Bot wins on score!";
            } else {
                reason = "Both players topped out! It's a draw on score!";
            }
        } else if (playerToppedOut) {
            reason = "Player topped out! Bot wins!";
        } else if (botToppedOut) {
            reason = "Bot topped out! Player wins!";
        }
    }

    if (reason) { // A win/loss/draw condition was met
        showGameOverScreen(reason);
        stopAllGameLoops(); // Explicitly stop loops here
        return true;
    }

    return false; // Game continues
}


// --- Keyboard Controls ---
document.addEventListener('keydown', (event) => {
    if (currentGameState !== GAME_STATE.PLAYING) return; 

    if (playerGame && !playerGame.isGameOver) { 
        if (event.key === 'ArrowLeft') playerGame.moveLeft();
        else if (event.key === 'ArrowRight') playerGame.moveRight();
        else if (event.key === 'ArrowDown') playerGame.moveDown();
        else if (event.key === 'ArrowUp') playerGame.rotate();
        else if (event.code === 'Space') {
            event.preventDefault();
            playerGame.drop();
        }
    }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMReferences();
    setupEventListeners();
    
    botDifficulty = parseInt(botDifficultySlider.value, 10);
    targetScore = parseInt(targetScoreInput.value, 10);
    if (isNaN(targetScore) || targetScore < 0) targetScore = 0;
    difficultyValueSpan.textContent = botDifficultySlider.value;

    showSettingsScreen(); 
});
