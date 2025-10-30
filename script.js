import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- CONFIGURATION ---
const VIEW_PASSCODE = "1234";
const EDIT_PASSCODE = "4321";
const MODE_KEY = "diaryAccessMode"; 
// Unique ID for the day's entry. Change this for future days (e.g., 'day2_september')
const DIARY_DOC_ID = "day1_september"; 
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const API_KEY = ""; // Kept empty; supplied by environment
// ---------------------

// Global Firebase and Auth instances
let db = null;
let auth = null;
let currentUserId = null;
let currentMode = null;

// --- Helper: Get Firestore Document Reference ---
function getDiaryDocRef() {
    // Determine App ID and User ID based on Canvas environment variables
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    
    // Path structure: /artifacts/{appId}/users/{userId}/diaryEntries/{docId} (Private Data)
    return doc(db, 'artifacts', appId, 'users', currentUserId, 'diaryEntries', DIARY_DOC_ID);
}

// --- Firebase Data Operations ---

/**
 * Saves the content of the diary element to Firestore.
 * @param {HTMLElement} diaryElement 
 */
function saveDiaryContent(diaryElement) {
    if (!db || !currentUserId) return console.error("Firebase not initialized or user not authenticated.");

    const content = diaryElement.innerHTML;
    const docRef = getDiaryDocRef();

    // Use setDoc to create or overwrite the document
    setDoc(docRef, { 
            content: content, 
            timestamp: new Date().toISOString(),
            mode: currentMode // Useful for tracking
        })
        .then(() => {
            console.log("Document successfully written to Firestore!");
            const header = document.querySelector('header h1');
            if (header) {
                const originalText = header.textContent;
                header.textContent = "💾 CHANGES SAVED PERMANENTLY!";
                setTimeout(() => { header.textContent = originalText; }, 3000);
            }
        })
        .catch((error) => {
            console.error("Error writing document to Firestore: ", error);
        });
}

/**
 * Sets up a real-time listener to load diary content from Firestore.
 * @param {HTMLElement} diaryElement 
 */
function loadDiaryContent(diaryElement) {
    if (!db || !currentUserId) return console.error("Firebase not initialized or user not authenticated.");

    const docRef = getDiaryDocRef();
    
    // Use onSnapshot for real-time loading
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().content) {
            diaryElement.innerHTML = docSnap.data().content;
            console.log("Document loaded in real-time.");
        } else {
            // If the document doesn't exist, use the default content from the HTML
            const defaultContent = `<p>Welcome to your secure diary entry. This content will be overwritten when you save for the first time.</p>
                                    <p>Since this document is now connected to <strong>Firebase</strong>, your changes will be permanent!</p>`;
            if (diaryElement.innerHTML.trim() === "") {
                 diaryElement.innerHTML = defaultContent;
            }
            console.log("Document does not exist in Firestore. Using default content.");
        }
    }, (error) => {
        console.error("Error setting up real-time listener:", error);
    });

    // In a production app, you would need to manage the 'unsubscribe' function to stop listeners on navigation.
    return unsubscribe;
}

// --- Gemini LLM Integration: Analyze and Reflect Feature ---

async function analyzeAndReflect(diaryElement) {
    const analysisOutput = document.getElementById('analysis-output');
    const userPrompt = diaryElement.textContent.trim();
    
    if (userPrompt.length < 50) {
        analysisOutput.innerHTML = `<p style="color:#ffb3b3;">Please write at least 50 characters before analysis can be performed.</p>`;
        return;
    }

    analysisOutput.innerHTML = '<p style="color:#ffd700;">Analyzing entry... please wait for Gemini...</p>';

    const systemPrompt = "You are a reflective personal journal assistant. Your task is to analyze the provided diary entry and return a concise summary and a brief, empathetic mood or theme analysis. Respond only with the requested JSON object.";
    
    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "summary": { "type": "STRING", "description": "A concise summary of the day's events." },
                    "moodAnalysis": { "type": "STRING", "description": "A brief, empathetic analysis of the mood or theme of the entry." }
                },
                required: ["summary", "moodAnalysis"]
            }
        }
    };
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
            throw new Error("Gemini response was empty or malformed.");
        }

        const parsedJson = JSON.parse(jsonText);

        analysisOutput.innerHTML = `
            <h3 style="color:#ffd700; font-family:'Cinzel Decorative', serif; margin-top:0;">Gemini Analysis</h3>
            <p><strong>Summary:</strong> ${parsedJson.summary}</p>
            <p><strong>Reflective Theme:</strong> ${parsedJson.moodAnalysis}</p>
        `;

    } catch (error) {
        console.error("Gemini API Error:", error);
        analysisOutput.innerHTML = `<p style="color:#ffb3b3;">Error analyzing entry: ${error.message}</p>`;
    }
}

// --- Clipboard/Export Logic (Kept for manual permanent saving) ---

function copyDiaryContentToClipboard(diaryElement) {
    const content = diaryElement.innerHTML;
    
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = content;
    document.body.appendChild(tempTextarea);
    
    tempTextarea.select();
    document.execCommand('copy');
    
    document.body.removeChild(tempTextarea);

    const header = document.querySelector('header h1');
    if (header) {
        const originalText = header.textContent;
        header.textContent = "📝 ENTRY HTML COPIED! Paste into your local HTML file for backup.";
        setTimeout(() => {
            header.textContent = originalText;
        }, 3000);
    }
}

// --- Mode Application and UI Wiring ---

function checkProtectionAndApplyMode() {
    currentMode = localStorage.getItem(MODE_KEY);

    const diaryEntry = document.querySelector('.diary-entry'); 
    const saveButtonContainer = document.getElementById('save-button-container');

    // 1. Check for valid mode 
    if (!currentMode) return; 

    // 2. Load Content (using Firebase real-time listener)
    if (diaryEntry) {
        loadDiaryContent(diaryEntry);
    }

    // 3. Apply "Edit Mode" if authorized (4321)
    if (currentMode === 'edit') {
        document.body.classList.add('edit-mode');
        
        if (diaryEntry) {
            diaryEntry.setAttribute('contenteditable', 'true');
        }

        if (saveButtonContainer) {
            saveButtonContainer.style.display = 'block';
            saveButtonContainer.innerHTML = '';
            
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            buttonGroup.style.marginTop = '0';
            
            // 1. Save Button (Firebase)
            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save Changes PERMANENTLY';
            saveButton.onclick = () => saveDiaryContent(diaryEntry);
            buttonGroup.appendChild(saveButton);

            // 2. Gemini LLM Feature Button
            const analyzeButton = document.createElement('button');
            analyzeButton.textContent = '✨ Analyze & Reflect';
            analyzeButton.onclick = () => analyzeAndReflect(diaryEntry);
            buttonGroup.appendChild(analyzeButton);

            // 3. Export Button (Backup)
            const exportButton = document.createElement('button');
            exportButton.textContent = 'Export HTML Backup';
            exportButton.onclick = () => copyDiaryContentToClipboard(diaryEntry);
            buttonGroup.appendChild(exportButton);
            
            saveButtonContainer.appendChild(buttonGroup);
        }

    } else {
        // 4. Apply "View Mode" (1234)
        document.body.classList.add('view-mode');
        if (diaryEntry) {
            diaryEntry.setAttribute('contenteditable', 'false');
        }
    }
}


// --- Firebase Initialization and Auth ---

async function initFirebaseAndAuth() {
    try {
        setLogLevel('Debug'); // Enable debug logging for Firebase
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        if (!firebaseConfig) throw new Error("Firebase config not available.");
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Check for Redirection before auth attempts
        const isProtectedPage = window.location.pathname.indexOf('index.html') === -1;
        const currentModeFromStorage = localStorage.getItem(MODE_KEY);

        if (isProtectedPage && !currentModeFromStorage) {
            // Not logged in and on a protected page, redirect
            const pathSegments = window.location.pathname.split('/').filter(p => p.length > 0);
            let redirectToIndex = pathSegments.length > 0 ? '../'.repeat(pathSegments.length - 1) + 'index.html' : 'index.html';
            window.location.href = redirectToIndex;
            return;
        }

        // Authentication logic
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        currentUserId = auth.currentUser?.uid || crypto.randomUUID();
        console.log("Firebase initialized. User ID:", currentUserId);

        // Now that Firebase is ready and user is authenticated, apply the mode and load content
        // This function will only run if we are NOT on the index.html page
        if(isProtectedPage) {
            checkProtectionAndApplyMode();
        }

    } catch (error) {
        console.error("Fatal Firebase Initialization or Authentication Error:", error);
    }
}

// --- Login Page Logic ---

document.addEventListener('DOMContentLoaded', () => {

    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('error-message');
    
    // Only run the login handler on the index page
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const enteredPasscode = passwordInput.value.trim();
            let mode = null;

            if (enteredPasscode === VIEW_PASSCODE) {
                mode = 'view';
            } else if (enteredPasscode === EDIT_PASSCODE) {
                mode = 'edit';
            }

            if (mode) {
                localStorage.setItem(MODE_KEY, mode);
                // CORRECTED REDIRECTION: Path now points to the file inside the Years/ folder
                window.location.href = "Years/Years.html"; 
            } else {
                errorMessage.style.display = 'block';
                passwordInput.value = '';
            }
        });
    }

    // Run Firebase setup on all pages (it handles its own authentication and redirection logic)
    initFirebaseAndAuth();

});
