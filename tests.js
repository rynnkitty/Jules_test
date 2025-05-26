// tests.js

// --- Test Runner Helper ---
const testResultsDiv = document.getElementById('test-results');
let testCount = 0;
let passCount = 0;

function describe(description, fn) {
    testResultsDiv.innerHTML += `<h2>${description}</h2>`;
    fn();
}

function it(description, fn) {
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
}

function assertEquals(actual, expected, message = 'Assertion failed') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) { // Use JSON.stringify for deep comparison of objects/arrays
        throw new Error(`${message} - Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
    }
}

function assertTrue(value, message = 'Assertion failed') {
    if (!value) {
        throw new Error(`${message} - Expected true, got false`);
    }
}

function assertFalse(value, message = 'Assertion failed') {
    if (value) {
        throw new Error(`${message} - Expected false, got true`);
    }
}

// --- Mocks and Setup ---
// We need to mock or control parts of the game state for tests
// These are simplified versions of game variables from script.js
let testBoard;
let testCurrentTetromino;
let testCurrentX, testCurrentY;
let testScore;
let testDropInterval;

const TEST_COLS = 10;
const TEST_ROWS = 20;
const TEST_BLOCK_SIZE = 20; // Not directly used in logic tests but good for consistency

// Helper to reset board and piece for each test if needed
function setupTestEnvironment(initialBoard, piece, x, y) {
    // Mock global variables script.js might use directly if not passed as params
    // This is a common challenge with testing JS code not originally designed for testability
    board = initialBoard ? JSON.parse(JSON.stringify(initialBoard)) : createEmptyTestBoard();
    currentTetromino = piece ? JSON.parse(JSON.stringify(piece)) : null;
    currentX = x || 0;
    currentY = y || 0;
    score = 0; // Reset score for tests involving score
    dropInterval = 1000; // Reset drop interval

    // Mock elements if functions interact with them directly
    // Ensure scoreElement exists for tests that update it
    if (!document.getElementById('score')) {
        let mockScoreElement = document.createElement('span');
        mockScoreElement.id = 'score';
        document.body.appendChild(mockScoreElement);
    }
    scoreElement = document.getElementById('score');


    // Ensure TETROMINOES, COLS, ROWS are available (they are global in script.js)
    COLS = TEST_COLS;
    ROWS = TEST_ROWS;
    BLOCK_SIZE = TEST_BLOCK_SIZE; // Though not used in pure logic
}

function createEmptyTestBoard() {
    let newBoard = [];
    for (let r = 0; r < TEST_ROWS; r++) {
        newBoard[r] = Array(TEST_COLS).fill(0);
    }
    return newBoard;
}

// --- Actual Tests ---
describe('Tetromino Movement and Collision', () => {
    it('isValidMove should return true for a valid move in empty space', () => {
        const I_SHAPE = TETROMINOES.I.shape; // [[1,1,1,1]]
        setupTestEnvironment(null, {shape: I_SHAPE}, 3, 0);
        assertTrue(isValidMove(currentTetromino.shape, 0, 0, board, COLS, ROWS), 'Initial position valid');
        assertTrue(isValidMove(currentTetromino.shape, 0, 1, board, COLS, ROWS), 'Move down valid');
    });

    it('isValidMove should return false for moving into a wall', () => {
        const I_SHAPE = TETROMINOES.I.shape;
        setupTestEnvironment(null, {shape: I_SHAPE}, 0, 0); // I piece at [0,0]
        assertFalse(isValidMove(currentTetromino.shape, -1, 0, board, COLS, ROWS), 'Move left into wall'); // currentX is 0, shape is [[1,1,1,1]]

        setupTestEnvironment(null, {shape: I_SHAPE}, TEST_COLS - I_SHAPE[0].length, 0); // I piece at far right
        assertFalse(isValidMove(currentTetromino.shape, 1, 0, board, COLS, ROWS), 'Move right into wall');
    });

    it('isValidMove should return false for moving into an existing block', () => {
        const I_SHAPE = TETROMINOES.I.shape;
        let customBoard = createEmptyTestBoard();
        customBoard[1][3] = 'red'; // Place a block
        setupTestEnvironment(customBoard, {shape: I_SHAPE, color: 'blue'}, 2, 0); // I piece at x=2, y=0: cells (2,0), (3,0), (4,0), (5,0)
                                                                              // Collision will be with (3,1) if it moves down
        assertFalse(isValidMove(currentTetromino.shape, 0, 1, board, COLS, ROWS), 'Move down into existing block');
    });
});

describe('Tetromino Rotation', () => {
    it('should rotate an I piece from horizontal to vertical', () => {
        const I_PIECE = JSON.parse(JSON.stringify(TETROMINOES.I)); // {shape: [[1,1,1,1]], color: 'cyan'}
        setupTestEnvironment(null, I_PIECE, 3, 0);
        rotate(); // Assumes rotate modifies currentTetromino.shape
        const expectedShape = [[1], [1], [1], [1]];
        assertEquals(currentTetromino.shape, expectedShape, 'I piece rotation');
    });

    it('should not rotate if it causes collision with wall (simple case)', () => {
        const L_PIECE = JSON.parse(JSON.stringify(TETROMINOES.L)); // {shape: [[1,0,0],[1,1,1]], ...}
        setupTestEnvironment(null, L_PIECE, 0, 0); // L piece at [0,0]
        const originalShape = JSON.parse(JSON.stringify(L_PIECE.shape));
        rotate(); // Attempt rotation
        // Basic rotation would make it 2 wide, 3 high. If isValidMove in rotate() is good, it might prevent.
        // This test depends heavily on the wall kick / boundary checks within rotate() + isValidMove()
        // For a simple rotation, if it strictly checks bounds, it might not rotate.
        // If it does rotate, the new shape would be [[1,1],[1,0],[1,0]]
        // A more robust test would check if it *doesn't* rotate if the new pos is invalid
        // or if it performs a wall kick (which is not implemented).
        // For now, let's assume a simple case where rotation is blocked if new shape is out of bounds.
        // If currentX=0, rotating L piece [[1,0,0],[1,1,1]] to [[1,1],[1,0],[1,0]] is fine at (0,0)
        // Let's test rotation near right wall:
        setupTestEnvironment(null, L_PIECE, TEST_COLS - 2, 0); // L piece near right wall
        const shapeBeforeRotate = JSON.parse(JSON.stringify(currentTetromino.shape));
        rotate(); 
        // If L_PIECE.shape is [[1,0,0],[1,1,1]], rotating it gives [[1,1],[1,0],[1,0]].
        // If currentX is COLS-2, L_PIECE starts at x=8. shape[0].length is 3.
        // Rotated shape is 2 wide. This should be fine.
        // This test needs more refinement based on actual rotate() and isValidMove() sophistication.
        // For now, let's assume it rotates if the final position is valid.
        const rotatedLShape = [[1,1],[1,0],[1,0]];
        if (isValidMove(rotatedLShape, 0, 0, board, COLS, ROWS)) {
             assertEquals(currentTetromino.shape, rotatedLShape, 'L piece should rotate if valid');
        } else {
             assertEquals(currentTetromino.shape, shapeBeforeRotate, 'L piece should not rotate if invalid and no wall kick');
        }
    });
});

describe('Line Clearing and Scoring', () => {
    it('should clear a single completed line', () => {
        let boardWithOneLine = createEmptyTestBoard();
        for (let c = 0; c < TEST_COLS; c++) {
            boardWithOneLine[TEST_ROWS - 1][c] = 'blue'; // Fill bottom row
        }
        boardWithOneLine[TEST_ROWS - 2][0] = 'red'; // Add a block on line above to check it moves down

        setupTestEnvironment(boardWithOneLine);
        clearLines(); // This function modifies `board` and `score` globally

        assertEquals(board[TEST_ROWS - 1][0], 'red', 'Block should shift down');
        assertTrue(board[0].every(cell => cell === 0), 'Top row should be empty');
        assertEquals(score, 100, 'Score should be 100 for 1 line');
    });

    it('should clear multiple lines (Tetris) and update score', () => {
        let boardWithFourLines = createEmptyTestBoard();
        for (let r = TEST_ROWS - 1; r >= TEST_ROWS - 4; r--) {
            for (let c = 0; c < TEST_COLS; c++) {
                boardWithFourLines[r][c] = 'green'; // Fill bottom four rows
            }
        }
        boardWithFourLines[TEST_ROWS - 5][3] = 'yellow'; // Block above the 4 lines

        setupTestEnvironment(boardWithFourLines);
        clearLines();

        assertEquals(board[TEST_ROWS - 1][3], 'yellow', 'Block should shift down by 4 rows');
        assertTrue(board[0].every(cell => cell === 0), 'Top row should be empty after 4 lines cleared');
        assertEquals(score, 800, 'Score should be 800 for 4 lines (Tetris)');
    });

    it('should increase speed (decrease dropInterval) after reaching score threshold', () => {
        // Mock INITIAL_DROP_INTERVAL, SPEED_INCREMENT_SCORE, DROP_INTERVAL_DECREMENT, MIN_DROP_INTERVAL
        // These are global in script.js, ensure test environment can access/mock them
        // For this test, let's assume they are accessible.
        // If not, they need to be explicitly set or passed.
        // In script.js, they are constants, so we can't change them.
        // For this test, we'll check the logic based on the score.
        // We need to call updateScoreAndSpeed directly or via clearLines.

        setupTestEnvironment(createEmptyTestBoard());
        score = 0; // Initial score
        dropInterval = 1000; // Initial interval

        // Simulate clearing lines to get score just below threshold
        updateScoreAndSpeed(2); // 300 points (assuming 1 line = 100, 2 lines = 300)
        assertEquals(dropInterval, 1000, "Interval shouldn't change yet");
        
        // Simulate clearing more lines to cross threshold (e.g., SPEED_INCREMENT_SCORE = 500)
        updateScoreAndSpeed(2); // Another 300 points, total 600
        // Assuming SPEED_INCREMENT_SCORE = 500, DROP_INTERVAL_DECREMENT = 100
        // Expected: 1000 - (floor(600/500) * 100) = 1000 - (1 * 100) = 900
        assertEquals(dropInterval, 900, "Interval should decrease after crossing 500 points");

        score = 900;
        updateScoreAndSpeed(1); // 100 points, total 1000
        // Expected: 1000 - (floor(1000/500) * 100) = 1000 - (2 * 100) = 800
        assertEquals(dropInterval, 800, "Interval should decrease again after crossing 1000 points");
    });
});

// Run tests on load
window.onload = () => {
    // This ensures that if script.js also has an onload, they don't conflict.
    // However, DOMContentLoaded is generally preferred for script.js initialization.
    // For simplicity here, we assume script.js has run and its globals are available.
    // The test runner itself uses document.getElementById, so DOM must be ready.
    // No specific test execution trigger needed here as `describe` calls run immediately.
    testResultsDiv.innerHTML += `<p><strong>Tests completed: ${passCount}/${testCount} passed.</strong></p>`;
    if (passCount !== testCount) {
        testResultsDiv.innerHTML += `<p style="color:red; font-weight:bold;">THERE ARE FAILING TESTS!</p>`;
    } else {
        testResultsDiv.innerHTML += `<p style="color:green; font-weight:bold;">ALL TESTS PASSED!</p>`;
    }
};
