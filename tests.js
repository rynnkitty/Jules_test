// tests.js

// --- Test Runner Helper (no change from previous) ---
const testResultsDiv = document.getElementById('test-results');
let testCount = 0;
let passCount = 0;

function describe(description, fn) { /* ... */ }
function it(description, fn) { /* ... */ }
function assertEquals(actual, expected, message = 'Assertion failed') { /* ... */ }
function assertTrue(value, message = 'Assertion failed') { /* ... */ }
function assertFalse(value, message = 'Assertion failed') { /* ... */ }
// (Copy helper functions from previous tests.js if not already fully here)
describe = function(description, fn) {
    testResultsDiv.innerHTML += `<h2>${description}</h2>`;
    fn();
};
it = function(description, fn) {
    testCount++;
    let resultHTML = `<p>${description}: `;
    try {
        fn();
        resultHTML += '<span class="pass">PASS</span></p>';
        passCount++;
    } catch (e) {
        resultHTML += `<span class="fail">FAIL</span><br>`;
        resultHTML += `<pre>${e.stack || e}</pre></p>`;
    }
    testResultsDiv.innerHTML += resultHTML;
};
assertEquals = function(actual, expected, message = 'Assertion failed') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message} - Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
    }
};
assertTrue = function(value, message = 'Assertion failed') {
    if (!value) { throw new Error(`${message} - Expected true, got false`); }
};
assertFalse = function(value, message = 'Assertion failed') {
    if (value) { throw new Error(`${message} - Expected false, got true`); }
};


// --- Mocks and Setup for Class-Based Game ---
let testGame; // Will hold an instance of TetrisGame

const TEST_COLS_CLASS = 10; // Use different names to avoid conflict if script.js globals are leaky
const TEST_ROWS_CLASS = 20;

// Helper to create an empty board for testGame instance
function createEmptyBoardForInstance() {
    let newBoard = [];
    for (let r = 0; r < TEST_ROWS_CLASS; r++) {
        newBoard[r] = Array(TEST_COLS_CLASS).fill(0);
    }
    return newBoard;
}

// Setup for tests that need a game instance
function setupTestGameInstance(isBot = false) {
    // Ensure mock DOM elements are available for the instance
    // These IDs are from test-runner.html
    testGame = new TetrisGame('test-canvas', 'test-next-block', 'test-score', isBot);
    // Override any game instance properties if needed for specific tests
    // testGame.COLS = TEST_COLS_CLASS; // If TetrisGame class uses this.COLS - Note: COLS is global in script.js
    // testGame.ROWS = TEST_ROWS_CLASS; // If TetrisGame class uses this.ROWS - Note: ROWS is global in script.js
    testGame.board = createEmptyBoardForInstance();
    testGame.score = 0;
    testGame.isGameOver = false;
    testGame.currentTetromino = null;
    testGame.nextTetromino = null;
    // Ensure constants used by AI are accessible if they are part of the class, or mock them.
    // For now, assuming AI constants (W_LINES_CLEARED etc.) are global or static in TetrisGame.
    return testGame;
}


// --- Updated Tests for Core Game Logic (using TetrisGame instance) ---
describe('TetrisGame Instance: Movement and Collision', () => {
    it('isValidMove should return true for a valid move in empty space', () => {
        const game = setupTestGameInstance();
        game.currentTetromino = JSON.parse(JSON.stringify(TETROMINOES.I));
        game.currentX = 3;
        game.currentY = 0;
        assertTrue(game.isValidMove(game.currentTetromino.shape, 0, 0), 'Initial position valid');
        assertTrue(game.isValidMove(game.currentTetromino.shape, 0, 1), 'Move down valid');
    });

    it('isValidMove should return false for moving into a wall', () => {
        const game = setupTestGameInstance();
        game.currentTetromino = JSON.parse(JSON.stringify(TETROMINOES.I));
        game.currentX = 0;
        game.currentY = 0;
        assertFalse(game.isValidMove(game.currentTetromino.shape, -1, 0), 'Move left into wall');

        game.currentX = COLS - game.currentTetromino.shape[0].length; // Use global COLS from script.js
        assertFalse(game.isValidMove(game.currentTetromino.shape, 1, 0), 'Move right into wall');
    });
});

describe('TetrisGame Instance: Rotation', () => {
    it('should rotate an I piece from horizontal to vertical', () => {
        const game = setupTestGameInstance();
        game.currentTetromino = JSON.parse(JSON.stringify(TETROMINOES.I)); // {shape: [[1,1,1,1]], ...}
        game.currentX = 3;
        game.currentY = 0;
        game.rotate();
        const expectedShape = [[1], [1], [1], [1]];
        assertEquals(game.currentTetromino.shape, expectedShape, 'I piece rotation');
    });
});

describe('TetrisGame Instance: Line Clearing and Scoring', () => {
    it('should clear a single completed line and update score', () => {
        const game = setupTestGameInstance();
        // Fill bottom row
        for (let c = 0; c < COLS; c++) { // Use global COLS
            game.board[ROWS - 1][c] = 'blue'; // Use global ROWS
        }
        game.board[ROWS - 2][0] = 'red'; // Block to shift down

        game.clearLines();

        assertEquals(game.board[ROWS - 1][0], 'red', 'Block should shift down');
        assertTrue(game.board[0].every(cell => cell === 0), 'Top row should be empty');
        assertEquals(game.score, 100, 'Score should be 100 for 1 line');
    });
});


// --- New Tests for Bot AI Logic ---
describe('Bot AI: Heuristic Functions', () => {
    it('calculateAggregateHeightAndColumnHeights correctly', () => {
        const game = setupTestGameInstance(true); // Bot instance
        game.board[ROWS - 1][0] = 'red'; // Height 1 at col 0
        game.board[ROWS - 2][0] = 'red'; // Height 2 at col 0
        game.board[ROWS - 1][1] = 'blue'; // Height 1 at col 1
        // Expected heights: col 0 = 2, col 1 = 1, others = 0. Aggregate = 3.
        const { aggregateHeight, columnHeights } = game.calculateAggregateHeightAndColumnHeights(game.board);
        assertEquals(aggregateHeight, 3, 'Aggregate height calculation');
        assertEquals(columnHeights[0], 2, 'Column 0 height');
        assertEquals(columnHeights[1], 1, 'Column 1 height');
        assertEquals(columnHeights[2], 0, 'Column 2 height');
    });

    it('countHoles correctly', () => {
        const game = setupTestGameInstance(true);
        game.board[ROWS - 1][0] = 'red'; // Bottom block
        game.board[ROWS - 3][0] = 'blue'; // Top block, creating a hole at (ROWS-2, 0)
        const { columnHeights } = game.calculateAggregateHeightAndColumnHeights(game.board); // col 0 height is 3 (ROWS - (ROWS-3))
        const holes = game.countHoles(game.board, columnHeights);
        assertEquals(holes, 1, 'Should find 1 hole');

        game.board[ROWS - 2][0] = 'green'; // Fill the hole
        // Re-calculate column heights as the board changed, though for this specific fill, height remains 3.
        const { columnHeights: updatedColumnHeights } = game.calculateAggregateHeightAndColumnHeights(game.board);
        const noHoles = game.countHoles(game.board, updatedColumnHeights);
        assertEquals(noHoles, 0, 'Should find 0 holes after filling');
    });

    it('calculateBumpiness correctly', () => {
        const game = setupTestGameInstance(true);
        const columnHeights = [2, 4, 1, 3, 0, 0, 0, 0, 0, 0]; // Example column heights for 10 COLS
        // Bumpiness: |2-4|+|4-1|+|1-3|+|3-0| + |0-0|... = 2+3+2+3 = 10
        const bumpiness = game.calculateBumpiness(columnHeights);
        assertEquals(bumpiness, 10, 'Bumpiness calculation');
    });
});

describe('Bot AI: evaluateBoardState', () => {
    it('should prefer clearing lines', () => {
        const game = setupTestGameInstance(true);
        let board1 = createEmptyBoardForInstance(); // No lines cleared
        let board2 = createEmptyBoardForInstance(); // One line cleared (simulated)
        
        const dummyShape = [[1]];
        const score1 = game.evaluateBoardState(board1, 0, ROWS - 2, dummyShape); // 0 lines cleared, landing near bottom
        const score2 = game.evaluateBoardState(board2, 1, ROWS - 2, dummyShape); // 1 line cleared, landing near bottom
        
        assertTrue(score2 > score1, 'Score for 1 line clear should be higher than 0 lines');
    });

    it('should penalize holes', () => {
        const game = setupTestGameInstance(true);
        let boardWithHole = createEmptyBoardForInstance();
        boardWithHole[ROWS - 1][0] = 'red';
        boardWithHole[ROWS - 3][0] = 'blue'; // Creates a hole

        let boardWithoutHole = createEmptyBoardForInstance();
        boardWithoutHole[ROWS - 1][0] = 'red';
        boardWithoutHole[ROWS - 2][0] = 'blue';
        
        const dummyShape = [[1]];
        const scoreHole = game.evaluateBoardState(boardWithHole, 0, ROWS - 4, dummyShape); // landing Y chosen to be above the structure
        const scoreNoHole = game.evaluateBoardState(boardWithoutHole, 0, ROWS - 3, dummyShape);

        assertTrue(scoreNoHole > scoreHole, 'Score for board without holes should be higher');
    });
});

describe('Bot AI: findBestMove (Simplified Test)', () => {
    it('should choose a move that clears a line if obvious', () => {
        const game = setupTestGameInstance(true);
        // Setup board where an I piece can clear a line
        for (let c = 1; c < COLS; c++) { // Leave col 0 open for I piece
            game.board[ROWS - 1][c] = 'filled';
        }
        game.currentTetromino = JSON.parse(JSON.stringify(TETROMINOES.I)); // Horizontal I piece
        
        const bestMove = game.findBestMove();
        
        assertTrue(bestMove !== null, 'Bot should find a best move');
        if (bestMove) {
            // Simulate applying this move
            let tempGame = setupTestGameInstance(true); // Create a fresh instance for simulation
            tempGame.board = JSON.parse(JSON.stringify(game.board)); // Copy original board
            tempGame.currentTetromino = JSON.parse(JSON.stringify(game.currentTetromino));
            
            tempGame.currentTetromino.shape = tempGame.getRotatedShape(tempGame.currentTetromino.shape, bestMove.rotationCount);
            tempGame.currentX = bestMove.x;
            
            // Set initial Y correctly for the rotated shape before dropping
            let topMostBlockRow = Infinity;
            if(tempGame.currentTetromino.shape && tempGame.currentTetromino.shape.length > 0){
                for(let r=0; r < tempGame.currentTetromino.shape.length; r++){
                    let foundBlockInRow = false;
                    for(let c_shape=0; c_shape < tempGame.currentTetromino.shape[r].length; c_shape++){
                        if(tempGame.currentTetromino.shape[r][c_shape]){
                            topMostBlockRow = Math.min(topMostBlockRow, r);
                            foundBlockInRow = true; 
                            break; 
                        }
                    }
                    if(foundBlockInRow) break;
                }
            }
            if(topMostBlockRow !== Infinity && topMostBlockRow < tempGame.currentTetromino.shape.length){
                tempGame.currentY = -topMostBlockRow;
            } else {
                tempGame.currentY = 0; 
            }

            // Simulate the drop part of executeBestMove
            while (tempGame.isValidMove(tempGame.currentTetromino.shape, 0, 1)) {
                tempGame.currentY++;
            }
            // Lock the piece (simplified from lockTetromino)
            const shape = tempGame.currentTetromino.shape;
            for (let r = 0; r < shape.length; r++) {
                for (let c_shape = 0; c_shape < shape[r].length; c_shape++) {
                    if (shape[r][c_shape]) {
                        if (tempGame.currentY + r >= 0 && tempGame.currentY + r < ROWS && tempGame.currentX + c_shape >= 0 && tempGame.currentX + c_shape < COLS) {
                           tempGame.board[tempGame.currentY + r][tempGame.currentX + c_shape] = tempGame.currentTetromino.color;
                        }
                    }
                }
            }
            // Now check for cleared lines on this simulated board
            let linesCleared = 0;
            for (let r_board = ROWS - 1; r_board >= 0; r_board--) {
                if (tempGame.board[r_board].every(cell => cell !== 0)) {
                    linesCleared++;
                }
            }
            assertTrue(linesCleared > 0, "Best move should lead to clearing a line in this setup. Move: " + JSON.stringify(bestMove));
        }
    });
});


// --- Final Summary ---
window.onload = () => {
    // (Same summary logic as before)
    testResultsDiv.innerHTML += `<p><strong>Tests completed: ${passCount}/${testCount} passed.</strong></p>`;
    if (passCount !== testCount) {
        testResultsDiv.innerHTML += `<p style="color:red; font-weight:bold;">THERE ARE FAILING TESTS!</p>`;
    } else {
        testResultsDiv.innerHTML += `<p style="color:green; font-weight:bold;">ALL TESTS PASSED!</p>`;
    }
};
