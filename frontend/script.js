const API_BASE_URL = 'https://swiggy-98ox.onrender.com'; // Match your FastAPI server port

let currentSessionId = null;
let turnCount = 0;
const MAX_TURNS = 3; // The number of choices before the conclusion

const promptInput = document.getElementById('promptInput');
const startButton = document.getElementById('startButton');
const storyContainer = document.getElementById('storyContainer');
const choiceA = document.getElementById('choiceA');
const choiceB = document.getElementById('choiceB');
const statusText = document.getElementById('status');

// --- Main Functions ---

async function startStory() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        statusText.textContent = "Please enter a starting idea!";
        return;
    }

    // Reset state
    turnCount = 0;
    storyContainer.innerHTML = '';
    statusText.textContent = "Generating first part...";
    hideChoices();

    try {
        const response = await fetch(`${API_BASE_URL}/start_story`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentSessionId = data.session_id;
        processStorySegment(data.story_segment);
        promptInput.style.display = 'none';
        startButton.style.display = 'none';

    } catch (error) {
        statusText.textContent = `Error starting story: ${error.message}`;
        console.error('Error starting story:', error);
    }
}

async function continueStory(choice) {
    if (!currentSessionId) return;

    turnCount++;
    statusText.textContent = `Processing turn ${turnCount}/${MAX_TURNS}...`;
    hideChoices();

    let userChoice = choice;

    // Check if this is the final turn
    if (turnCount >= MAX_TURNS) {
        userChoice = "FINISH"; // Signal to the backend to conclude
    }

    try {
        const response = await fetch(`${API_BASE_URL}/continue_story`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                session_id: currentSessionId, 
                choice: userChoice 
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        processStorySegment(data.story_segment, data.is_final);

    } catch (error) {
        statusText.textContent = `Error continuing story: ${error.message}`;
        console.error('Error continuing story:', error);
    }
}

// --- Helper Functions ---

function processStorySegment(segment, isFinal = false) {
    statusText.textContent = "Your story so far:";
    
    // Find options A and B in the segment
    const optionMatch = segment.match(/(A\..+?)\s(B\..+)/s);
    
    let storyPart = segment;
    let optionA_text = "";
    let optionB_text = "";

    if (optionMatch) {
        // Story part is everything before the options
        storyPart = segment.substring(0, optionMatch.index).trim();
        optionA_text = optionMatch[1].trim();
        optionB_text = optionMatch[2].trim();
    }

    // Add the new story part to the container
    const newParagraph = document.createElement('p');
    newParagraph.innerHTML = storyPart.replace(/\n/g, '<br>');
    storyContainer.appendChild(newParagraph);

    if (isFinal || !optionMatch) {
        statusText.textContent = "🎉 THE END! Thank you for playing! 🎉";
        hideChoices();
        // Optional: Reset button visibility for a new game
        promptInput.style.display = 'block';
        startButton.style.display = 'block';
    } else {
        // Display options for the next turn
        showChoices(optionA_text, optionB_text);
    }
}

function showChoices(textA, textB) {
    choiceA.textContent = textA.replace('A.', '').trim();
    choiceB.textContent = textB.replace('B.', '').trim();
    choiceA.style.display = 'block';
    choiceB.style.display = 'block';
}

function hideChoices() {
    choiceA.style.display = 'none';
    choiceB.style.display = 'none';
}

// --- Event Listeners ---

startButton.addEventListener('click', startStory);
choiceA.addEventListener('click', () => continueStory('A'));
choiceB.addEventListener('click', () => continueStory('B'));s
