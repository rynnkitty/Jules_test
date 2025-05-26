// tests.js

// --- Test Runner Helper (ensure these are present and complete) ---
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
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

// --- Global variables from script.js that tests might need to interact with ---
// These are declared in script.js and will be accessed by tests.
// let currentGameState; (from script.js)
// let botDifficulty; (from script.js)
// let targetScore; (from script.js)
// let playerGame, botGame; (from script.js)

// Mock essential DOM elements if not already in test-runner.html
function setupMockDOM() {
    const ensureElement = (id, html) => {
        if (!document.getElementById(id)) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            document.body.appendChild(tempDiv.firstChild);
        }
    };

    ensureElement('settings-overlay', '<div id="settings-overlay" style="display: none;"></div>');
    ensureElement('main-container', '<div id="main-container" style="display: none;"></div>');
    ensureElement('game-over-overlay', '<div id="game-over-overlay" style="display: none;"></div>');
    ensureElement('bot-difficulty', '<input type="range" id="bot-difficulty" value="5">');
    ensureElement('difficulty-value', '<span id="difficulty-value">5</span>');
    ensureElement('target-score', '<input type="number" id="target-score" value="2000">');
    
    // Ensure game canvases for testGame instances are present (from previous test setup)
    // These are for the TetrisGame class instances, not the main player/bot ones from index.html
    // However, script.js might be looking for the main ones.
    // For simplicity, we'll assume setupTestGameInstance handles its own canvas needs if different.
    // The main player/bot canvases are defined in index.html and used by script.js directly.
    // This test suite assumes script.js can find player-canvas, bot-canvas etc.
    // If initializeDOMReferences in script.js runs, it should find what it needs from index.html or here.

    // Critical: script.js references these global vars directly.
    // Ensure they are available for functions like showSettingsScreen etc.
    // These assignments assume script.js has NOT YET run initializeDOMReferences or
    // that these assignments are safe to override for test context.
    // If script.js's initializeDOMReferences is robust, it will re-assign them.
    settingsOverlay = document.getElementById('settings-overlay');
    mainContainer = document.getElementById('main-container');
    gameOverOverlay = document.getElementById('game-over-overlay');
    botDifficultySlider = document.getElementById('bot-difficulty');
    difficultyValueSpan = document.getElementById('difficulty-value');
    targetScoreInput = document.getElementById('target-score');
    winnerMessageElement = document.getElementById('winner-message'); // Ensure this is created if needed
    if (!winnerMessageElement) {
        ensureElement('winner-message', '<p id="winner-message"></p>'); // Add to game-over-modal if that's where it lives
        winnerMessageElement = document.getElementById('winner-message');
    }


    // Call initializeDOMReferences if it exists globally to ensure script.js has its references too
    // This should happen AFTER our mock DOM is set up.
    if (typeof initializeDOMReferences === 'function') {
        initializeDOMReferences();
    }
}


describe('Game State Management and UI Transitions', () => {
    beforeEach(() => {
        setupMockDOM(); 
        // Simulate initial state script.js would set after DOMContentLoaded
        // This is typically done by showSettingsScreen() at the end of script.js
        if (typeof showSettingsScreen === 'function') { // Ensure script.js is loaded
             showSettingsScreen();
        } else {
            // Fallback if script.js functions aren't loaded yet (should not happen if order is correct)
            currentGameState = GAME_STATE.PRE_GAME;
            if(settingsOverlay) settingsOverlay.style.display = 'flex';
            if(mainContainer) mainContainer.style.display = 'none';
            if(gameOverOverlay) gameOverOverlay.style.display = 'none';
        }
    });

    it('should start in PRE_GAME state with settings visible', () => {
        assertEquals(currentGameState, GAME_STATE.PRE_GAME, 'Initial state');
        assertEquals(settingsOverlay.style.display, 'flex', 'Settings overlay visible');
        assertEquals(mainContainer.style.display, 'none', 'Main container hidden');
        assertEquals(gameOverOverlay.style.display, 'none', 'Game over overlay hidden');
    });

    it('should transition PRE_GAME -> PLAYING on startGame event', () => {
        targetScoreInput.value = "1000";
        botDifficultySlider.value = "3";
        
        // Manually update globals as if event listener from script.js ran
        // (The startGameBtn listener in script.js does this and then calls startNewGame and showGameScreen)
        botDifficulty = parseInt(botDifficultySlider.value, 10);
        targetScore = parseInt(targetScoreInput.value, 10);

        startNewGame(); 
        showGameScreen(); 

        assertEquals(currentGameState, GAME_STATE.PLAYING, 'State after starting game');
        assertEquals(settingsOverlay.style.display, 'none', 'Settings hidden after start');
        assertEquals(mainContainer.style.display, 'flex', 'Main container visible after start');
        assertTrue(playerGame !== null && botGame !== null, 'Game instances created');
        assertTrue(playerGame instanceof TetrisGame && botGame instanceof TetrisGame, "Instances are of TetrisGame");
    });

    it('should transition PLAYING -> GAME_OVER when a win condition is met', () => {
        // Simulate starting a game first
        botDifficulty = 5; targetScore = 1000; // Set some defaults
        startNewGame(); 
        showGameScreen(); 
        currentGameState = GAME_STATE.PLAYING; // Ensure state is PLAYING

        playerGame.score = 1000; // Simulate player reaching score
        
        checkOverallGameOver(); 

        assertEquals(currentGameState, GAME_STATE.GAME_OVER, 'State after game over by score');
        assertEquals(gameOverOverlay.style.display, 'flex', 'Game over overlay visible');
    });

    it('should transition GAME_OVER -> PRE_GAME on playAgain event', () => {
        // Setup for GAME_OVER state
        currentGameState = GAME_STATE.GAME_OVER; 
        // Ensure game instances exist for stopAllGameLoops to not error
        if (!playerGame) playerGame = new TetrisGame('player-canvas', 'player-next-block', 'player-score');
        if (!botGame) botGame = new TetrisGame('bot-canvas', 'bot-next-block', 'bot-score', true);
        showGameOverScreen("Test game over"); 

        // Simulate clicking "Play Again" button by calling what its handler would do
        stopAllGameLoops(); // playAgainBtn listener in script.js calls this via showSettingsScreen sometimes
        showSettingsScreen();

        assertEquals(currentGameState, GAME_STATE.PRE_GAME, 'State after play again');
        assertEquals(settingsOverlay.style.display, 'flex', 'Settings visible after play again');
        assertEquals(gameOverOverlay.style.display, 'none', 'Game over overlay hidden after play again');
    });
});

describe('Bot Difficulty Setting Integration', () => {
    beforeEach(setupMockDOM);

    it('should apply selected bot difficulty to botGame instance', () => {
        botDifficultySlider.value = "8"; // High difficulty
        targetScoreInput.value = "0"; // Default
        
        // Simulate start game button click actions from script.js
        botDifficulty = parseInt(botDifficultySlider.value, 10);
        targetScore = parseInt(targetScoreInput.value, 10);
        
        startNewGame(); // This creates botGame and sets its botMoveDelay

        const expectedDelay = calculateBotMoveDelayValue(8); 
        assertEquals(botGame.botMoveDelay, expectedDelay, 'Bot move delay set by difficulty');
    });
});

describe('Target Score Logic', () => {
    beforeEach(() => {
        setupMockDOM();
        // Ensure game instances are created for each test, and state is PLAYING
        botDifficulty = 5; // Default
        targetScore = 0;   // Default (will be overridden by tests)
        startNewGame(); 
        currentGameState = GAME_STATE.PLAYING; 
    });

    it('should end game if player reaches target score', () => {
        targetScore = 1500; // Set for this test
        playerGame.score = 1500;
        botGame.score = 100; 
        playerGame.isGameOver = false; // Ensure not topped out
        botGame.isGameOver = false;
        
        const gameEnded = checkOverallGameOver();
        assertTrue(gameEnded, 'Game should end');
        assertEquals(currentGameState, GAME_STATE.GAME_OVER, 'State should be GAME_OVER');
    });

    it('should end game if bot reaches target score', () => {
        targetScore = 1500; // Set for this test
        playerGame.score = 100;
        botGame.score = 1500;
        playerGame.isGameOver = false;
        botGame.isGameOver = false;

        const gameEnded = checkOverallGameOver();
        assertTrue(gameEnded, 'Game should end');
        assertEquals(currentGameState, GAME_STATE.GAME_OVER, 'State should be GAME_OVER');
    });

    it('should not end game by score if targetScore is 0 (endless) and no top-out', () => {
        targetScore = 0; // Endless mode
        playerGame.score = 5000; 
        playerGame.isGameOver = false; // Explicitly ensure not topped out
        botGame.isGameOver = false;   // Explicitly ensure not topped out
        
        const gameEnded = checkOverallGameOver(); 

        assertFalse(gameEnded, 'Game should not end by score if target is 0 and no one topped out');
        assertEquals(currentGameState, GAME_STATE.PLAYING, 'State should remain PLAYING');
    });
});

describe('Game Reset on Replay', () => {
    beforeEach(setupMockDOM);

    it('should reset game state fully when starting a new game after replay', () => {
        // Simulate a first game
        targetScoreInput.value = "500";
        botDifficultySlider.value = "2";
        // Manually update globals as if event listener for start button ran
        targetScore = parseInt(targetScoreInput.value, 10);
        botDifficulty = parseInt(botDifficultySlider.value, 10);
        startNewGame();
        currentGameState = GAME_STATE.PLAYING; 

        // Simulate some play
        playerGame.score = 200;
        playerGame.board[10][0] = 'red'; 

        // End the first game by top-out
        playerGame.isGameOver = true; 
        checkOverallGameOver(); // This will set currentGameState to GAME_OVER

        // Simulate "Play Again?" (which calls showSettingsScreen)
        showSettingsScreen();

        // Now, simulate starting a *new* game from settings
        targetScoreInput.value = "1000"; 
        botDifficultySlider.value = "7";
        // Manually update globals for new game settings
        targetScore = parseInt(targetScoreInput.value, 10);
        botDifficulty = parseInt(botDifficultySlider.value, 10);
        
        const oldPlayerGameInstance = playerGame; 
        startNewNewGame(); // Call the corrected function name
        currentGameState = GAME_STATE.PLAYING; 

        assertFalse(playerGame === oldPlayerGameInstance, "A new playerGame instance should be created");
        assertEquals(playerGame.score, 0, 'Player score reset');
        assertTrue(playerGame.board.every(row => row.every(cell => cell === 0)), 'Player board reset');
        assertEquals(playerGame.isGameOver, false, 'Player game over flag reset');
        
        const expectedNewBotDelay = calculateBotMoveDelayValue(7);
        assertEquals(botGame.botMoveDelay, expectedNewBotDelay, 'Bot difficulty updated for new game');
    });
});

// --- Helper for tests - sometimes startNewGame might be called again ---
// It seems there was a typo in the test, it should be startNewGame
function startNewNewGame() { //This function was called in one test, assuming it's a typo for startNewGame
    startNewGame();
}


// --- Final Summary (ensure this runs after all describe blocks) ---
window.addEventListener('load', () => { // Changed from onload to addEventListener for safety
    // Call initializeDOMReferences from script.js IF it exists, to ensure script.js can find its elements
    // This is critical because tests.js might be adding DOM elements script.js needs.
    if (typeof initializeDOMReferences === 'function') {
        initializeDOMReferences();
    }
    
    // The tests run immediately upon script parsing.
    // The summary should be appended after all tests have had a chance to run.
    // Using a small timeout to ensure this runs after synchronous test execution.
    setTimeout(() => {
        if (testResultsDiv) { // Check if testResultsDiv is available
            testResultsDiv.innerHTML += `<p><strong>Tests completed: ${passCount}/${testCount} passed.</strong></p>`;
            if (passCount !== testCount) {
                testResultsDiv.innerHTML += `<p style="color:red; font-weight:bold;">THERE ARE FAILING TESTS!</p>`;
            } else {
                testResultsDiv.innerHTML += `<p style="color:green; font-weight:bold;">ALL TESTS PASSED!</p>`;
            }
        }
    }, 0);
});
