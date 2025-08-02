/* global __firebase_config, __initial_auth_token, __app_id */
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// --- Helper Components for a Cleaner UI ---

// Icon for buttons and titles
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// A styled container for each option
const Card = ({ children, className = '' }) => (
    <div className={`bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/20 transition-all duration-300 hover:bg-white/20 hover:border-white/30 ${className}`}>
        {children}
    </div>
);

// A styled file input component
const FileInput = ({ label, onFileSelect, id }) => (
    <div className="w-full">
        <label htmlFor={id} className="block text-lg font-semibold text-white mb-3 text-center">{label}</label>
        <label htmlFor={id} className="w-full flex justify-center items-center px-4 py-3 bg-indigo-500 text-white rounded-lg shadow-md tracking-wide uppercase border border-indigo-600 cursor-pointer hover:bg-indigo-600 hover:text-white transition-all duration-300">
            <svg className="w-8 h-8 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4 4-4-4h3V3h2v8z" />
            </svg>
            <span className="text-base leading-normal">Choose a file</span>
        </label>
        <input type='file' className="hidden" id={id} onChange={e => onFileSelect(e.target.files[0])} accept=".json,.txt" />
    </div>
);

// A styled text area component
const PasteInput = ({ label, value, onChange }) => (
    <div className="w-full">
        <label className="block text-lg font-semibold text-white mb-3 text-center">{label}</label>
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full h-40 p-4 bg-gray-800/50 text-white rounded-lg border-2 border-gray-600 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 transition-all duration-300"
            placeholder="Paste your list here..."
        />
    </div>
);


// --- Main App Component ---

export default function App() {
    // --- State Management ---
    const [view, setView] = useState('intro'); // 'intro', 'main', 'results'
    const [followersFile, setFollowersFile] = useState(null);
    const [followingFile, setFollowingFile] = useState(null);
    const [pendingFile, setPendingFile] = useState(null); // New state for optional file
    const [followersText, setFollowersText] = useState('');
    const [followingText, setFollowingText] = useState('');
    
    // Results state
    const [dontFollowBack, setDontFollowBack] = useState([]);
    const [iDontFollowBack, setIDontFollowBack] = useState([]); // New state for new feature
    const [mutuals, setMutuals] = useState([]);
    const [unverifiedFollowings, setUnverifiedFollowings] = useState([]); // New state for new feature

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // --- Firebase State ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // --- Firebase Initialization ---
    useEffect(() => {
        try {
            if (typeof __firebase_config !== 'undefined') {
                const firebaseConfig = JSON.parse(__firebase_config);
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);
                
                setDb(firestoreDb);
                setAuth(firebaseAuth);

                onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        try {
                            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                            } else {
                                await signInAnonymously(firebaseAuth);
                            }
                        } catch (authError) {
                            console.error("Firebase Auth Error:", authError);
                            setError("Could not connect to the authentication service.");
                        }
                    }
                    setIsAuthReady(true);
                });
            } else {
                 setError("Firebase configuration is missing.");
                 setIsAuthReady(true);
            }
        } catch (e) {
            console.error("Error initializing Firebase:", e);
            setError("There was a problem starting the application.");
            setIsAuthReady(true);
        }
    }, []);


    // --- Data Processing Logic ---
    const parseList = (content) => {
        if (!content) return [];
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                if (data.every(item => typeof item === 'string')) {
                    return data;
                }
                if (data.every(item => item.string_list_data && item.string_list_data[0] && typeof item.string_list_data[0].value === 'string')) {
                    return data.map(item => item.string_list_data[0].value);
                }
            }
        } catch (e) {
            return content.split('\n').map(s => s.trim()).filter(Boolean);
        }
        return [];
    };

    const handleFileRead = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve([]);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => resolve(parseList(e.target.result));
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    };

    const processData = useCallback(async () => {
        if (!isAuthReady || !db) {
            setError("Database is not ready. Please wait and try again.");
            return;
        }
        
        setIsLoading(true);
        setError('');

        try {
            let followers = followersText ? parseList(followersText) : await handleFileRead(followersFile);
            let following = followingText ? parseList(followingText) : await handleFileRead(followingFile);
            let pending = await handleFileRead(pendingFile);

            if (followers.length === 0 || following.length === 0) {
                setError("Required data is missing. Please provide both followers and following lists.");
                setIsLoading(false);
                return;
            }

            const followersSet = new Set(followers);
            const followingSet = new Set(following);

            // --- Calculations for all features ---
            const notFollowingYouBack = following.filter(user => !followersSet.has(user));
            const youDontFollowBack = followers.filter(user => !followingSet.has(user));
            const mutualFollowers = following.filter(user => followersSet.has(user));
            const unverified = pending.length > 0 ? pending.filter(user => followingSet.has(user)) : [];

            setDontFollowBack(notFollowingYouBack);
            setIDontFollowBack(youDontFollowBack);
            setMutuals(mutualFollowers);
            setUnverifiedFollowings(unverified);

            // --- Save results to Firestore ---
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/instagramData`, 'results');
            
            await setDoc(userDocRef, {
                dontFollowBack: notFollowingYouBack,
                iDontFollowBack: youDontFollowBack,
                mutuals: mutualFollowers,
                unverifiedFollowings: unverified,
                timestamp: new Date(),
            });

            setView('results');
        } catch (e) {
            console.error("Processing error:", e);
            setError("An error occurred while processing your data. Check the file formats and try again.");
        } finally {
            setIsLoading(false);
        }
    }, [followersFile, followingFile, pendingFile, followersText, followingText, db, userId, isAuthReady]);
    
    // --- Load previous results from Firestore on startup ---
    useEffect(() => {
        const loadPreviousData = async () => {
            if (isAuthReady && db && userId) {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/instagramData`, 'results');
                const docSnap = await getDoc(userDocRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDontFollowBack(data.dontFollowBack || []);
                    setIDontFollowBack(data.iDontFollowBack || []);
                    setMutuals(data.mutuals || []);
                    setUnverifiedFollowings(data.unverifiedFollowings || []);
                    
                    if ([...data.dontFollowBack, ...data.iDontFollowBack, ...data.mutuals].length > 0) {
                       setView('results');
                    }
                }
            }
        };
        loadPreviousData();
    }, [isAuthReady, db, userId]);

    const resetState = () => {
        setView('main');
        setFollowersFile(null);
        setFollowingFile(null);
        setPendingFile(null);
        setFollowersText('');
        setFollowingText('');
        setError('');
    };

    // --- Render Logic ---

    const renderIntro = () => (
        <div className="text-center animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">Instagram Follower Check</h1>
            <p className="text-xl md:text-2xl text-indigo-200 mb-8 max-w-2xl mx-auto">Find out who doesn't follow you back, who you don't follow back, and more. Securely and privately.</p>
            <button onClick={() => setView('main')} className="bg-indigo-500 text-white font-bold rounded-full py-4 px-10 text-xl hover:bg-indigo-400 transition-all duration-300 transform hover:scale-105 shadow-2xl">
                Get Started
            </button>
        </div>
    );

    const renderMain = () => (
        <div className="w-full max-w-7xl mx-auto animate-fade-in">
            <h2 className="text-4xl font-bold text-white text-center mb-2">Provide Your Data</h2>
            <p className="text-center text-indigo-200 mb-8">You can upload files or paste text directly.</p>
            
            <h3 className="text-2xl font-semibold text-white text-center mb-4">Required Files</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                 <Card><FileInput label="Followers File" id="followers-file" onFileSelect={setFollowersFile} /></Card>
                 <Card><FileInput label="Following File" id="following-file" onFileSelect={setFollowingFile} /></Card>
            </div>
            
            <h3 className="text-2xl font-semibold text-white text-center mb-4">Optional File</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="md:col-start-2">
                    <Card><FileInput label="Pending Requests File" id="pending-file" onFileSelect={setPendingFile} /></Card>
                </div>
            </div>

             <div className="text-center text-white my-6 font-semibold text-lg">OR PASTE TEXT</div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                 <Card><PasteInput label="Paste Followers List" value={followersText} onChange={setFollowersText} /></Card>
                 <Card><PasteInput label="Paste Following List" value={followingText} onChange={setFollowingText} /></Card>
             </div>
            
            {error && <p className="text-center text-red-400 text-lg my-4">{error}</p>}

            <div className="text-center mt-8">
                <button onClick={processData} disabled={isLoading || (!followersFile && !followingFile && !followersText && !followingText)} className="bg-green-500 text-white font-bold rounded-full py-4 px-12 text-xl hover:bg-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center justify-center mx-auto">
                    {isLoading ? 'Processing...' : <><CheckIcon />Check Now</>}
                </button>
            </div>
        </div>
    );
    
    const ResultList = ({ title, count, users }) => (
        <Card className="max-h-[50vh] flex flex-col">
            <h3 className="text-2xl font-bold text-white text-center mb-4 sticky top-0">{title} ({count})</h3>
            <ul className="space-y-2 overflow-y-auto flex-grow">
                {users.map(user => (
                    <li key={user} className="bg-gray-800/50 p-3 rounded-lg text-white/90 truncate">
                        <a href={`https://instagram.com/${user}`} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300 transition-colors">{user}</a>
                    </li>
                ))}
            </ul>
        </Card>
    );

    const renderResults = () => (
        <div className="w-full max-w-7xl mx-auto animate-fade-in">
             <h2 className="text-4xl font-bold text-white text-center mb-8">Your Results</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ResultList title="Don't Follow You Back" count={dontFollowBack.length} users={dontFollowBack} />
                <ResultList title="You Don't Follow Back" count={iDontFollowBack.length} users={iDontFollowBack} />
                <ResultList title="Mutuals" count={mutuals.length} users={mutuals} />
                { unverifiedFollowings.length > 0 && <ResultList title="Unverified Followings" count={unverifiedFollowings.length} users={unverifiedFollowings} /> }
             </div>
             <div className="text-center mt-10">
                 <button onClick={resetState} className="bg-indigo-500 text-white font-bold rounded-full py-3 px-8 text-lg hover:bg-indigo-400 transition-all duration-300 transform hover:scale-105 shadow-2xl">
                    Start Over
                </button>
             </div>
        </div>
    );

    return (
        <main className="min-h-screen w-full bg-gray-900 bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="relative z-10 w-full flex items-center justify-center">
                {view === 'intro' && renderIntro()}
                {view === 'main' && renderMain()}
                {view === 'results' && renderResults()}
            </div>
            { !isAuthReady && view !== 'intro' && (
                 <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center z-50">
                    <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-white text-xl">Connecting securely...</p>
                 </div>
            )}
        </main>
    );
}
