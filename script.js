// Game state and preferences
const gameState = {
    currentScreen: 'intro',
    currentQuestion: 0,
    recruiterHP: 100,
    selectedAnswer: null,
    soundEnabled: true,
    battleAnimationActive: false,
    attackEffectsActive: false,
    shakeEffectActive: false,
    messageVisible: false
};

// Przemysław's preferences
const preferences = {
    salaryMinimum: 300000,
    remoteWork: true,
    contractType: 'permanent',
    contractType2: 'part-time',
    techStack: ['.NET', 'Azure', "SQL"],
};

// Battle questions
const questions = [
    {
        text: "What salary range are you offering on full time position?",
        options: [
            { text: "100 000 - 200 000 PLN", value: { min: 0, max: 200000 } },
            { text: "200 000 - 300 000 PLN", value: { min: 200000, max: 300000 } },
            { text: "300 000 - 400 000 PLN", value: { min: 300000, max: 400000 } },
            { text: "Over 400 000 PLN", value: { min: 400000, max: 999999 } },
        ],
        // Fixed salary logic - higher salary is always better
        checkPreference: (answer) => answer.min >= preferences.salaryMinimum || answer.max > preferences.salaryMinimum,
        damage: 40,
        attackName: "Salary Proposal"
    },
    {
        text: "Is this position remote-friendly?",
        options: [
            { text: "Yes, fully remote", value: true },
            { text: "Hybrid (2-3 days in office)", value: "hybrid" },
            { text: "No, on-site only", value: false },
        ],
        checkPreference: (answer) => {
            if (preferences.remoteWork === true) return answer === true;
            return answer !== false; // Hybrid is acceptable if not requiring fully remote
        },
        damage: 30,
        attackName: "Work Location"
    },
    {
        text: "What type of contract is this?",
        options: [
            { text: "Contract (6-12 months)", value: "contract" },
            { text: "Permanent", value: "permanent" },
            { text: "Contract-to-hire", value: "contract-to-hire" },
            { text: "Part-time", value: "part-time"}
        ],
        checkPreference: (answer) => answer === preferences.contractType || answer === preferences.contractType2,
        damage: 35,
        attackName: "Contract Offer"
    },
    {
        text: "Which technologies are required for this role?",
        options: [
            { text: ".NET, Azure, SQL", value: ['.NET', 'Azure', "SQL"] },
            { text: "React, JavaScript, Node.js", value: ['React', 'JavaScript', 'Node.js'] },
            { text: "Java, Spring Boot, AWS", value: ['Java', 'Spring Boot', 'AWS'] },
            { text: "Python, Django, GCP", value: ['Python', 'Django', 'GCP'] },
        ],
        checkPreference: (answer) => {
            // Check if any of the required tech stack is present
            return preferences.techStack.some(tech => answer.includes(tech));
        },
        damage: 35,
        attackName: "Tech Stack"
    }
];

// Audio management
class AudioManager {
    constructor() {
        this.sounds = {};
        this.loadSounds();
        this.audioFailSafe = false;
    }

    loadSounds() {
        // List of sound effects with their file paths
        const soundFiles = {
            battle: 'sounds/battle.mp3',
            hit: 'sounds/hit.mp3',
            select: 'sounds/select.mp3',
            damage: 'sounds/damage.mp3',
            victory: 'sounds/victory.mp3',
            defeat: 'sounds/defeat.mp3',
            start: 'sounds/start.mp3',
        };

        // Create Audio objects for each sound
        Object.entries(soundFiles).forEach(([name, path]) => {
            try {
                this.sounds[name] = new Audio(path);
                
                // Loop battle music
                if (name === 'battle') {
                    this.sounds[name].loop = true;
                }
                
                // Add error handlers for missing files
                this.sounds[name].addEventListener('error', () => {
                    this.audioFailSafe = true;
                });
            } catch (e) {
                this.audioFailSafe = true;
            }
        });
    }

    play(sound) {
        if (this.audioFailSafe) return; // Skip if audio has previously failed
        
        if (this.sounds[sound] && gameState.soundEnabled) {
            try {
                // For one-shot sounds, reset to beginning before playing
                this.sounds[sound].currentTime = 0;
                // Add promise error handling
                const playPromise = this.sounds[sound].play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        // Mark audio as failed to prevent further attempts
                        this.audioFailSafe = true;
                    });
                }
            } catch (e) {
                this.audioFailSafe = true;
            }
        }
    }

    stop(sound) {
        if (this.audioFailSafe) return;
        
        if (this.sounds[sound]) {
            try {
                this.sounds[sound].pause();
                this.sounds[sound].currentTime = 0;
            } catch (e) {
                this.audioFailSafe = true;
            }
        }
    }

    stopAll() {
        if (this.audioFailSafe) return;
        
        try {
            Object.values(this.sounds).forEach(sound => {
                sound.pause();
                sound.currentTime = 0;
            });
        } catch (e) {
            this.audioFailSafe = true;
        }
    }
}

// Create audio manager instance
const audioManager = new AudioManager();

// DOM Elements
const introScreen = document.getElementById('intro-screen');
const battleScreen = document.getElementById('battle-screen');
const victoryScreen = document.getElementById('victory-screen');
const gameOverScreen = document.getElementById('game-over-screen');

const startBattleButton = document.getElementById('start-battle');
const soundToggleButton = document.getElementById('sound-toggle');

const opponentHpBar = document.getElementById('opponent-hp-bar');
const opponentHpCurrent = document.getElementById('opponent-hp-current');
const playerHpBar = document.getElementById('player-hp-bar');
const playerHpCurrent = document.getElementById('player-hp-current');

const opponentSprite = document.getElementById('opponent-sprite');
const playerSprite = document.getElementById('player-sprite');

const battleMessage = document.getElementById('battle-message');
const messageText = document.getElementById('message-text');

const currentQuestionElement = document.getElementById('current-question');
const optionsContainer = document.getElementById('options-container');
const attackEffects = document.getElementById('attack-effects');

const playAgainVictoryButton = document.getElementById('play-again-victory');
const tryAgainButton = document.getElementById('try-again');

// Helper functions
function setScreen(screenName) {
    // Hide all screens
    introScreen.classList.remove('active');
    battleScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    // Show the requested screen
    switch (screenName) {
        case 'intro':
            introScreen.classList.add('active');
            break;
        case 'battle':
            battleScreen.classList.add('active');
            break;
        case 'victory':
            victoryScreen.classList.add('active');
            break;
        case 'game-over':
            gameOverScreen.classList.add('active');
            break;
    }
    
    gameState.currentScreen = screenName;
}

function updatePlayerHP(newHP) {
    const hp = Math.max(0, newHP);
    const percentage = (hp / 100) * 100;
    
    // Change color based on HP percentage
    let hpColor = '#22c55e'; // Green
    if (percentage <= 20) {
        hpColor = '#ef4444'; // Red
        playerHpBar.classList.add('animate-pulse');
    } else if (percentage <= 50) {
        hpColor = '#f59e0b'; // Yellow
        playerHpBar.classList.remove('animate-pulse');
    } else {
        playerHpBar.classList.remove('animate-pulse');
    }
    
    // Update HP bar
    playerHpBar.style.width = `${percentage}%`;
    playerHpBar.style.backgroundColor = hpColor;
    playerHpCurrent.textContent = hp;
    
    return hp;
}

function showMessage(text, duration = 2500) {
    if (gameState.messageVisible) return;
    
    gameState.messageVisible = true;
    messageText.textContent = text;
    battleMessage.classList.add('active');
    
    setTimeout(() => {
        battleMessage.classList.remove('active');
        gameState.messageVisible = false;
    }, duration);
}

function activateAttackEffects() {
    if (gameState.attackEffectsActive) return;
    
    gameState.attackEffectsActive = true;
    attackEffects.classList.add('active');
    
    setTimeout(() => {
        attackEffects.classList.remove('active');
        gameState.attackEffectsActive = false;
    }, 1000);
}

function activateShakeEffect() {
    if (gameState.shakeEffectActive) return;
    
    gameState.shakeEffectActive = true;
    playerSprite.classList.add('shake');
    
    setTimeout(() => {
        playerSprite.classList.remove('shake');
        gameState.shakeEffectActive = false;
    }, 500);
}

function renderQuestion() {
    // Clear any existing options
    optionsContainer.innerHTML = '';
    
    // Set question text
    const question = questions[gameState.currentQuestion];
    currentQuestionElement.textContent = question.text;
    
    // Create option buttons
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = option.text;
        button.dataset.index = index;
        
        button.addEventListener('click', () => handleOptionSelect(option, button));
        
        optionsContainer.appendChild(button);
    });
}

function disableAllOptions() {
    const buttons = optionsContainer.querySelectorAll('.option-button');
    buttons.forEach(button => {
        button.classList.add('disabled');
        button.disabled = true;
    });
}

function resetGame() {
    gameState.currentQuestion = 0;
    gameState.recruiterHP = 100;
    gameState.selectedAnswer = null;
    gameState.battleAnimationActive = false;
    gameState.attackEffectsActive = false;
    gameState.shakeEffectActive = false;
    gameState.messageVisible = false;
    
    updatePlayerHP(100);
}

// Event handlers
function handleStartBattle() {
    audioManager.play('start');
    
    setTimeout(() => {
        setScreen('battle');
        resetGame();
        renderQuestion();
        
        // Start battle music after a short delay
        setTimeout(() => {
            audioManager.play('battle');
        }, 500);
    }, 500);
}

function handleSoundToggle() {
    gameState.soundEnabled = !gameState.soundEnabled;
    
    if (gameState.soundEnabled) {
        // Sound is ON - play music if in battle
        document.querySelector('.sound-button').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="sound-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
        `;
        
        if (gameState.currentScreen === 'battle') {
            audioManager.play('battle');
        }
    } else {
        // Sound is OFF - add X icon
        document.querySelector('.sound-button').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="sound-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
        `;
        
        audioManager.stopAll();
    }
}

// Completely rewritten option selection handler
function handleOptionSelect(option, button) {
    // Prevent multiple selections
    if (gameState.selectedAnswer !== null) return;
    
    audioManager.play('select');
    
    // Update game state
    gameState.selectedAnswer = option;
    
    // Mark this button as selected and disable all options
    button.classList.add('selected');
    disableAllOptions();
    
    // Get current question data
    const question = questions[gameState.currentQuestion];
    const isMatch = question.checkPreference(option.value);
    const isLastQuestion = gameState.currentQuestion === questions.length - 1;
    
    // Show attack animation
    opponentSprite.classList.add('attacking');
    activateAttackEffects();
    
    // Animation sequence
    const sequence = [
        // Reset position and play hit sound after 1 second
        () => {
            opponentSprite.classList.remove('attacking');
            audioManager.play('hit');
            
            // Show appropriate message based on match
            if (isMatch) {
                showMessage(`Przemysław used ${question.attackName}! It's super effective!`);
            } else {
                showMessage(`Przemysław used ${question.attackName}! It's not very effective...`);
                activateShakeEffect();
                audioManager.play('damage');
                
                // Apply damage after a short delay
                setTimeout(() => {
                    const newHP = updatePlayerHP(gameState.recruiterHP - question.damage);
                    gameState.recruiterHP = newHP;
                    
                    // Check for defeat
                    if (newHP === 0) {
                        endBattle('defeat');
                    }
                }, 1000);
            }
        },
        
        // Decide what happens next after animations complete
        () => {
            // Victory condition: Last question + matching answer
            if (isLastQuestion && isMatch) {
                endBattle('victory');
                return;
            }
            
            // Defeat condition: Last question + non-matching answer
            if (isLastQuestion && !isMatch && gameState.recruiterHP > 0) {
                endBattle('defeat');
                return;
            }
            
            // Continue to next question if not last question and still has HP
            if (!isLastQuestion && gameState.recruiterHP > 0) {
                gameState.currentQuestion++;
                gameState.selectedAnswer = null;
                renderQuestion();
            }
        }
    ];
    
    // Execute the animation sequence with timing
    setTimeout(sequence[0], 1000);
    setTimeout(sequence[1], 3500);
}

// Centralized function to end the battle
function endBattle(result) {
    // Stop battle music
    audioManager.stop('battle');
    
    if (result === 'victory') {
        audioManager.play('victory');
        setTimeout(() => setScreen('victory'), 1500);
    } else {
        audioManager.play('defeat');
        setTimeout(() => setScreen('game-over'), 1500);
    }
}

function handlePlayAgain() {
    audioManager.stopAll();
    resetGame();
    setScreen('intro');
}

// Attach event listeners
startBattleButton.addEventListener('click', handleStartBattle);
soundToggleButton.addEventListener('click', handleSoundToggle);
playAgainVictoryButton.addEventListener('click', handlePlayAgain);
tryAgainButton.addEventListener('click', handlePlayAgain);

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    setScreen('intro');
    
    // Set initial sound button state
    if (!gameState.soundEnabled) {
        document.querySelector('.sound-button').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="sound-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
        `;
    }
});

// Helper function to preload sounds
function preloadSounds() {
    const soundPaths = [
        'sounds/battle.mp3',
        'sounds/hit.mp3',
        'sounds/select.mp3',
        'sounds/damage.mp3',
        'sounds/victory.mp3',
        'sounds/defeat.mp3',
        'sounds/start.mp3'
    ];
    
    soundPaths.forEach(path => {
        const audio = new Audio();
        audio.src = path;
    });
}

// Call preload
preloadSounds();