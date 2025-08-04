/* global __firebase_config, __initial_auth_token, __app_id */
import React, { useState, useEffect, useCallback } from 'react';
// import './App.css'; // This is commented out to ensure Tailwind styles apply correctly.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// --- UI Helper Components ---

const Card = ({ children, className = '' }) => (
    <div className={`bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/20 transition-all duration-300 hover:bg-white/20 hover:border-white/30 ${className}`}>
        {children}
    </div>
);

const FileInput = ({ label, onFileSelect, id }) => (
    <div className="w-full h-full flex flex-col justify-between">
        <label htmlFor={id} className="block text-lg font-semibold text-white mb-3 text-center">{label}</label>
        <label htmlFor={id} className="w-full flex justify-center items-center px-4 py-3 bg-indigo-500 text-white rounded-lg shadow-md tracking-wide uppercase border border-indigo-600 cursor-pointer hover:bg-indigo-600 transition-all duration-300">
            <svg className="w-8 h-8 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4 4-4-4h3V3h2v8z" />
            </svg>
            <span className="text-base leading-normal">Choose file</span>
        </label>
        <input type='file' className="hidden" id={id} onChange={e => onFileSelect(e.target.files[0])} accept=".json,.txt" />
    </div>
);

const PasteInput = ({ value, onChange, placeholder }) => (
    <div className="w-full flex-grow flex flex-col">
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full flex-grow p-4 bg-gray-800/50 text-white rounded-lg border-2 border-gray-600 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 transition-all duration-300"
            placeholder={placeholder}
        />
    </div>
);

const ResultList = ({ title, count, users }) => (
    <Card className="max-h-[50vh] flex flex-col">
        <h3 className="text-2xl font-bold text-white text-center mb-4 sticky top-0">{title} ({count})</h3>
        <ul className="space-y-2 overflow-y-auto flex-grow">
            {users.length > 0 ? users.map(user => (
                <li key={user} className="bg-gray-800/50 p-3 rounded-lg text-white/90 truncate">
                    <a href={`https://instagram.com/${user}`} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300 transition-colors">{user}</a>
                </li>
            )) : <p className="text-center text-white/50">No users in this list.</p>}
        </ul>
    </Card>
);

const HelpModal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-fast" onClick={onClose}>
            <div className="bg-gray-800 border border-white/20 rounded-2xl shadow-2xl p-8 max-w-2xl w-11/12 text-white relative animate-fade-in-up-fast" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                {children}
            </div>
        </div>
    );
};

const HelpIcon = ({ onClick }) => (
    <button onClick={onClick} className="ml-2 text-indigo-300 hover:text-indigo-100 transition-colors focus:outline-none">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    </button>
);

const AiInsightSwiper = ({ insights, isLoading }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const goToPrevious = () => {
        const isFirstSlide = currentIndex === 0;
        const newIndex = isFirstSlide ? insights.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    };

    const goToNext = () => {
        const isLastSlide = currentIndex === insights.length - 1;
        const newIndex = isLastSlide ? 0 : currentIndex + 1;
        setCurrentIndex(newIndex);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-purple-300">AI Follower Analysis</h2>
            <div className="relative h-64">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="ml-4 text-lg">Generating insights...</p>
                    </div>
                ) : insights.length > 0 ? (
                    <>
                        <div className="h-full overflow-y-auto pr-2">
                            <h3 className="text-xl font-semibold text-indigo-300 mb-2">{insights[currentIndex].title}</h3>
                            <p className="text-white/90 whitespace-pre-wrap">{insights[currentIndex].content}</p>
                        </div>
                        {/* Left Arrow */}
                        <div onClick={goToPrevious} className="absolute top-1/2 -left-8 transform -translate-y-1/2 cursor-pointer text-white/50 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </div>
                        {/* Right Arrow */}
                        <div onClick={goToNext} className="absolute top-1/2 -right-8 transform -translate-y-1/2 cursor-pointer text-white/50 hover:text-white">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </>
                ) : (
                    <p className="text-white/90">Sorry, no insights could be generated at this time.</p>
                )}
            </div>
            <div className="flex justify-center pt-4">
                {insights.map((slide, slideIndex) => (
                    <div key={slideIndex} onClick={() => setCurrentIndex(slideIndex)} className={`mx-1 h-2 w-2 rounded-full cursor-pointer ${currentIndex === slideIndex ? 'bg-indigo-400' : 'bg-gray-600'}`}></div>
                ))}
            </div>
        </div>
    );
};


const HELP_CONTENT = {
    PRIMARY: (
        <>
            <h2 className="text-2xl font-bold mb-4 text-indigo-300">How to Find Your Followers & Following Files</h2>
            <div className="space-y-4 text-white/90">
                <p>This is the most reliable method. To get your data, you need to request a download from Instagram:</p>
                <ol className="list-decimal list-inside space-y-2 pl-4">
                    <li>Go to your Instagram Profile &gt; <strong>Settings and privacy</strong> &gt; <strong>Accounts Center</strong>.</li>
                    <li>Select <strong>Your information and permissions</strong> &gt; <strong>Download your information</strong>.</li>
                    <li>Click <strong>Request a download</strong>, select your profile, and click <strong>Next</strong>.</li>
                    <li>Choose <strong>Select types of information</strong>.</li>
                    <li>Scroll down and select <strong>Followers and following</strong>. Click <strong>Next</strong>.</li>
                    <li>Set the format to <strong>JSON</strong> and media quality to low. Click <strong>Submit request</strong>.</li>
                </ol>
                <p>Instagram will email you a link to download a ZIP file. Once you unzip it, look inside the <strong>followers_and_following</strong> folder for:</p>
                <ul className="list-disc list-inside space-y-1 pl-4 font-mono">
                    <li>followers_1.json</li>
                    <li>following.json</li>
                </ul>
                <p>Upload those two files here.</p>
            </div>
        </>
    ),
    OPTIONAL: (
         <>
            <h2 className="text-2xl font-bold mb-4 text-indigo-300">How to Find Optional Data Files</h2>
            <p className="mb-4 text-white/90">Follow the same steps to request your data, but when you get to "Select types of information", choose the following instead:</p>
            <ul className="list-disc list-inside space-y-2 pl-4 font-mono text-white/90">
                <li><strong>Pending follow requests:</strong> Look for <strong className="text-indigo-300">pending_follow_requests.json</strong></li>
                <li><strong>Blocked Accounts:</strong> Look for <strong className="text-indigo-300">blocked_accounts.json</strong></li>
                <li><strong>Unfollowed Accounts:</strong> Unfortunately, Instagram does not provide a direct list of who unfollowed you. This option is for users who may have tracked this data themselves.</li>
            </ul>
        </>
    ),
    PASTE: (
         <>
            <h2 className="text-2xl font-bold mb-4 text-indigo-300">How to Copy & Paste Your Lists</h2>
            <p className="mb-4 text-white/90">This is a quick alternative if you don't want to download your files. This method works best on a desktop browser.</p>
            <ol className="list-decimal list-inside space-y-2 pl-4">
                <li>Go to your Instagram profile on your computer.</li>
                <li>Click on your "Followers" or "Following" count to open the list in a pop-up.</li>
                <li><strong>Scroll all the way to the bottom</strong> of the list until every account has loaded. This is very important!</li>
                <li>Click at the beginning of the first username, hold the mouse button down, and drag your cursor all the way to the end of the last username to select the entire list.</li>
                <li>Copy the selected text (you can right-click and choose "Copy", or press Ctrl+C / Cmd+C).</li>
                <li>Paste the copied list into the correct box in this app.</li>
            </ol>
        </>
    )
};

// --- Data Parsing Logic (Pure Function) ---
const parseList = (content) => {
    if (!content) return [];
    try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            // --- CHANGE START ---
            // This logic is now more robust. It attempts to map the known JSON structure,
            // filtering out any items that don't match, rather than failing completely.
            const usernames = data
                .map(item => item?.string_list_data?.[0]?.value)
                .filter(Boolean); // Filter out any null/undefined values from non-matching items

            if (usernames.length > 0) {
                return usernames;
            }
            // --- CHANGE END ---

            // Fallback for a simple array of strings, just in case.
            if (data.every(item => typeof item === 'string')) {
                return data;
            }
        }
    } catch (e) {
        // This logic handles pasted text, which is not valid JSON.
        // It's now smarter to handle messy pasted text from Instagram.
        return content.split('\n').map(line => {
            // Trim the line, then split by spaces to isolate the username, which is usually the first part.
            const parts = line.trim().split(/\s+/);
            return parts[0]; // Return the first part, which should be the username
        }).filter(Boolean); // Filter out any empty lines that might result
    }
    return []; // Return empty if no valid data could be parsed
};


// --- Main App Component ---

export default function App() {
    // --- State Management ---
    const [view, setView] = useState('intro');

    // File and Text Inputs
    const [followersFile, setFollowersFile] = useState(null);
    const [followingFile, setFollowingFile] = useState(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [blockedFile, setBlockedFile] = useState(null);
    const [unfollowedFile, setUnfollowedFile] = useState(null);

    const [followersText, setFollowersText] = useState('');
    const [followingText, setFollowingText] = useState('');
    const [blockedText, setBlockedText] = useState('');

    // Results
    const [dontFollowBack, setDontFollowBack] = useState([]);
    const [iDontFollowBack, setIDontFollowBack] = useState([]);
    const [mutuals, setMutuals] = useState([]);
    const [unverifiedFollowings, setUnverifiedFollowings] = useState([]);
    const [unfollowedAccounts, setUnfollowedAccounts] = useState([]);
    const [blockedAccounts, setBlockedAccounts] = useState([]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Firebase State
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isFirebaseReady, setIsFirebaseReady] = useState(false);
    
    // Help Modal State
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [helpModalContent, setHelpModalContent] = useState(null);
    
    const [aiInsights, setAiInsights] = useState([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);


    // --- Firebase Initialization ---
    useEffect(() => {
        const firebaseConfig = {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_PROJECT_ID,
            storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
            messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_APP_ID,
        };

        let auth;
        let firestoreDb;

        if (firebaseConfig.apiKey && firebaseConfig.projectId) {
            try {
                const app = initializeApp(firebaseConfig);
                firestoreDb = getFirestore(app);
                auth = getAuth(app);
                setDb(firestoreDb);

                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                        setIsFirebaseReady(true);
                    } else {
                        try {
                            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                await signInWithCustomToken(auth, __initial_auth_token);
                            } else {
                                await signInAnonymously(auth);
                            }
                        } catch (authError) {
                            console.error("Firebase Auth Error:", authError);
                            setError("Authentication failed.");
                            setIsFirebaseReady(true);
                        }
                    }
                });
            } catch(e) {
                console.error("Firebase initialization error:", e);
                setError("Firebase initialization failed.");
                setIsFirebaseReady(true);
            }
        } else {
             const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
             if (firebaseConfigStr) {
                try {
                    const parsedConfig = JSON.parse(firebaseConfigStr);
                    const app = initializeApp(parsedConfig);
                    firestoreDb = getFirestore(app);
                    auth = getAuth(app);
                    setDb(firestoreDb);
                     onAuthStateChanged(auth, async (user) => {
                        if (user) {
                            setUserId(user.uid);
                            setIsFirebaseReady(true);
                        } else {
                            try {
                                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                    await signInWithCustomToken(auth, __initial_auth_token);
                                } else {
                                    await signInAnonymously(auth);
                                }
                            } catch (authError) {
                                console.error("Firebase Auth Error:", authError);
                                setError("Authentication failed.");
                                setIsFirebaseReady(true);
                            }
                        }
                    });
                } catch (e) {
                    console.error("Fallback Firebase config parsing error:", e);
                    setError("Firebase configuration is invalid.");
                    setIsFirebaseReady(true);
                }
             } else {
                console.error("Firebase configuration is missing from both .env and injected script.");
                setError("Firebase configuration is missing.");
                setIsFirebaseReady(true);
             }
        }
    }, []);

    // --- Data Processing Logic ---
    const handleFileRead = useCallback((file) => new Promise((resolve, reject) => {
        if (!file) return resolve([]);
        const reader = new FileReader();
        reader.onload = (e) => resolve(parseList(e.target.result));
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    }), []);

    const processData = useCallback(async () => {
        if (!isFirebaseReady || !db || !userId) {
            setError("Database is not ready. Please wait.");
            return;
        }
        
        setIsLoading(true);
        setError('');

        try {
            const [followers, following, pending, blocked, unfollowed] = await Promise.all([
                followersText ? Promise.resolve(parseList(followersText)) : handleFileRead(followersFile),
                followingText ? Promise.resolve(parseList(followingText)) : handleFileRead(followingFile),
                handleFileRead(pendingFile),
                blockedText ? Promise.resolve(parseList(blockedText)) : handleFileRead(blockedFile),
                handleFileRead(unfollowedFile)
            ]);
            
            if ([followers, following, pending, blocked, unfollowed].every(list => list.length === 0)) {
                setError("Please provide at least one data file or list to analyze.");
                setIsLoading(false);
                return;
            }

            const followersSet = new Set(followers);
            const followingSet = new Set(following);

            const results = {
                dontFollowBack: (followers.length > 0 && following.length > 0) ? following.filter(user => !followersSet.has(user)) : [],
                iDontFollowBack: (followers.length > 0 && following.length > 0) ? followers.filter(user => !followingSet.has(user)) : [],
                mutuals: (followers.length > 0 && following.length > 0) ? following.filter(user => followersSet.has(user)) : [],
                unverifiedFollowings: pending,
                unfollowedAccounts: unfollowed,
                blockedAccounts: blocked
            };

            setDontFollowBack(results.dontFollowBack);
            setIDontFollowBack(results.iDontFollowBack);
            setMutuals(results.mutuals);
            setUnverifiedFollowings(results.unverifiedFollowings);
            setUnfollowedAccounts(results.unfollowedAccounts);
            setBlockedAccounts(results.blockedAccounts);

            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/instagramData`, 'results');
            await setDoc(userDocRef, { ...results, timestamp: new Date() });

            setView('results');
        } catch (e) {
            console.error("Processing error:", e);
            setError("An error occurred. Check your files and try again.");
        } finally {
            setIsLoading(false);
        }
    }, [followersFile, followingFile, pendingFile, blockedFile, unfollowedFile, followersText, followingText, blockedText, db, userId, handleFileRead, isFirebaseReady]);
    
    useEffect(() => {
        const loadPreviousData = async () => {
            if (isFirebaseReady && db && userId) {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/instagramData`, 'results');
                const docSnap = await getDoc(userDocRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDontFollowBack(data.dontFollowBack || []);
                    setIDontFollowBack(data.iDontFollowBack || []);
                    setMutuals(data.mutuals || []);
                    setUnverifiedFollowings(data.unverifiedFollowings || []);
                    setUnfollowedAccounts(data.unfollowedAccounts || []);
                    setBlockedAccounts(data.blockedAccounts || []);
                    
                    if (Object.values(data).some(arr => Array.isArray(arr) && arr.length > 0)) {
                       setView('results');
                    }
                }
            }
        };
        loadPreviousData();
    }, [db, userId, isFirebaseReady]);

    const resetState = () => {
        setView('main');
        setFollowersFile(null); setFollowingFile(null); setPendingFile(null);
        setBlockedFile(null); setUnfollowedFile(null);
        setFollowersText(''); setFollowingText(''); setBlockedText('');
        setError('');
        setAiInsights([]);
    };

    const openHelpModal = (content) => {
        setHelpModalContent(content);
        setIsHelpModalOpen(true);
    };

    const getAiInsights = async () => {
        setIsAiLoading(true);
        setAiInsights([]);
        setIsAiModalOpen(true);

        const dontFollowBackSample = dontFollowBack.slice(0, 50).join(', ');
        const mutualsSample = mutuals.slice(0, 50).join(', ');

        const prompt = `
            Analyze the following Instagram data and provide actionable insights.
            Accounts that DO NOT follow me back: ${dontFollowBackSample}
            Accounts that are MUTUALS: ${mutualsSample}
        `;
        
        try {
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "STRING" },
                                content: { type: "STRING" }
                            },
                            required: ["title", "content"]
                        }
                    }
                }
            };
            
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                const jsonText = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(jsonText);
                setAiInsights(parsedJson);
            } else {
                setAiInsights([{ title: "Error", content: "Sorry, the AI could not generate insights at this time. The response was empty." }]);
            }
        } catch (error) {
            console.error("AI Insight Error:", error);
            setAiInsights([{ title: "Error", content: "Sorry, an error occurred while generating insights. Please try again later." }]);
        } finally {
            setIsAiLoading(false);
        }
    };


    // --- Render Logic ---

    const renderIntro = () => (
        <div className="text-center animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">Instagram Insights</h1>
            <p className="text-xl md:text-2xl text-indigo-200 mb-8 max-w-3xl mx-auto">Get a complete picture of your follower relationships. Secure, private, and easy to use.</p>
            <button onClick={() => setView('main')} className="bg-indigo-500 text-white font-bold rounded-full py-4 px-10 text-xl hover:bg-indigo-400 transition-all duration-300 transform hover:scale-105 shadow-2xl">
                Get Started
            </button>
        </div>
    );

    const renderMain = () => {
        const hasAnyInput = !!(followersFile || followersText || followingFile || followingText || pendingFile || unfollowedFile || blockedFile || blockedText);

        return (
            <div className="w-full max-w-7xl mx-auto animate-fade-in">
                <h2 className="text-4xl font-bold text-white text-center mb-8">Provide Your Instagram Data</h2>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                    <section className="mb-12">
                        <div className="flex justify-center items-center mb-6">
                            <h3 className="text-2xl font-semibold text-white text-center">Follower & Following Data</h3>
                            <HelpIcon onClick={() => openHelpModal(HELP_CONTENT.PRIMARY)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card><FileInput label="Followers File" id="followers-file" onFileSelect={setFollowersFile} /></Card>
                            <Card><FileInput label="Following File" id="following-file" onFileSelect={setFollowingFile} /></Card>
                            
                            <Card className="flex flex-col">
                                <div className="flex justify-center items-center mb-3">
                                    <label className="block text-lg font-semibold text-white text-center">Paste Followers List</label>
                                    <HelpIcon onClick={() => openHelpModal(HELP_CONTENT.PASTE)} />
                                </div>
                                <PasteInput value={followersText} onChange={setFollowersText} placeholder="Paste followers here..." />
                            </Card>
                             <Card className="flex flex-col">
                                <div className="flex justify-center items-center mb-3">
                                    <label className="block text-lg font-semibold text-white text-center">Paste Following List</label>
                                    <HelpIcon onClick={() => openHelpModal(HELP_CONTENT.PASTE)} />
                                </div>
                                <PasteInput value={followingText} onChange={setFollowingText} placeholder="Paste following here..." />
                            </Card>
                        </div>
                    </section>
                    
                    <section>
                        <div className="flex justify-center items-center mb-6">
                            <h3 className="text-2xl font-semibold text-white text-center">Optional Data</h3>
                            <HelpIcon onClick={() => openHelpModal(HELP_CONTENT.OPTIONAL)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <Card><FileInput label="Pending Requests File" id="pending-file" onFileSelect={setPendingFile} /></Card>
                            <Card><FileInput label="Unfollowed You File" id="unfollowed-file" onFileSelect={setUnfollowedFile} /></Card>
                            <Card><FileInput label="Blocked Accounts File" id="blocked-file" onFileSelect={setBlockedFile} /></Card>
                            
                            <Card className="md:col-span-3 flex flex-col">
                                <div className="flex justify-center items-center mb-3">
                                    <label className="block text-lg font-semibold text-white text-center">Paste Blocked Accounts List</label>
                                    <HelpIcon onClick={() => openHelpModal(HELP_CONTENT.PASTE)} />
                                </div>
                                <PasteInput value={blockedText} onChange={setBlockedText} placeholder="Paste blocked accounts here..." />
                            </Card>
                        </div>
                    </section>
                </div>
                
                {error && <p className="text-center text-red-400 text-lg my-6">{error}</p>}

                <div className="text-center mt-12 flex justify-center items-center gap-4">
                    <button
                        onClick={() => setView('intro')}
                        className="bg-gray-600 text-white font-bold rounded-full py-4 px-10 text-xl hover:bg-gray-500 transition-all duration-300 transform hover:scale-105 shadow-2xl"
                    >
                        Back
                    </button>
                    <button 
                        onClick={processData} 
                        disabled={!isFirebaseReady || isLoading || !hasAnyInput} 
                        className="bg-green-500 text-white font-bold rounded-full py-4 px-12 text-xl hover:bg-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-2xl"
                    >
                        {!isFirebaseReady ? 'Connecting...' : isLoading ? 'Processing...' : 'Analyze My Data'}
                    </button>
                </div>
            </div>
        );
    }
    
    const renderResults = () => (
        <div className="w-full max-w-7xl mx-auto animate-fade-in">
             <h2 className="text-4xl font-bold text-white text-center mb-8">Your Results</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <ResultList title="Don't Follow You Back" count={dontFollowBack.length} users={dontFollowBack} />
                <ResultList title="You Don't Follow Back" count={iDontFollowBack.length} users={iDontFollowBack} />
                <ResultList title="Mutuals" count={mutuals.length} users={mutuals} />
                <ResultList title="Blocked Accounts" count={blockedAccounts.length} users={blockedAccounts} />
                <ResultList title="Pending Follow Requests" count={unverifiedFollowings.length} users={unverifiedFollowings} />
                <ResultList title="Recently Unfollowed You" count={unfollowedAccounts.length} users={unfollowedAccounts} />
             </div>
             <div className="text-center mt-12 flex justify-center items-center gap-4">
                 <button onClick={resetState} className="bg-indigo-500 text-white font-bold rounded-full py-3 px-8 text-lg hover:bg-indigo-400 transition-all duration-300 transform hover:scale-105 shadow-2xl">
                    Start Over
                </button>
                <button 
                    onClick={getAiInsights} 
                    className="bg-purple-500 text-white font-bold rounded-full py-3 px-8 text-lg hover:bg-purple-400 transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                    disabled={isAiLoading || (dontFollowBack.length === 0 && mutuals.length === 0)}
                >
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v.518A7 7 0 0117.5 10.5a.75.75 0 01-1.5 0A5.5 5.5 0 0010.75 5.272V4.5a.75.75 0 01-.75-.75zM10 18a7 7 0 01-7-7 .75.75 0 011.5 0A5.5 5.5 0 0010 16.5a.75.75 0 010 1.5zM3.055 6.445A.75.75 0 014 6a5.5 5.5 0 007.002 7.002.75.75 0 11-1 1.224A7 7 0 013.055 6.445z" clipRule="evenodd" />
                        <path d="M10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6z" />
                    </svg>
                    {isAiLoading ? 'Analyzing...' : 'Get AI Insights'}
                </button>
             </div>
        </div>
    );

    if (!isFirebaseReady) {
        return (
            <main className="min-h-screen w-full bg-gray-900 text-white flex flex-col items-center justify-center">
                 <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-xl">{error ? error : "Connecting securely..."}</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen w-full bg-gray-900 bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            
            <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)}>
                {helpModalContent}
            </HelpModal>
            
            <HelpModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)}>
                 <AiInsightSwiper insights={aiInsights} isLoading={isAiLoading} />
            </HelpModal>

            <div className="relative z-10 w-full flex items-center justify-center">
                {view === 'intro' && renderIntro()}
                {view === 'main' && renderMain()}
                {view === 'results' && renderResults()}
            </div>
        </main>
    );
}
