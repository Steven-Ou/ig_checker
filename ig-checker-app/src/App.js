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

const PasteInput = ({ label, value, onChange }) => (
    <div className="w-full h-full flex flex-col">
        <label className="block text-lg font-semibold text-white mb-3 text-center">{label}</label>
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full flex-grow p-4 bg-gray-800/50 text-white rounded-lg border-2 border-gray-600 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 transition-all duration-300"
            placeholder="Paste your list here..."
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

// --- Data Parsing Logic (Pure Function) ---
const parseList = (content) => {
    if (!content) return [];
    try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            if (data.every(item => typeof item === 'string')) return data;
            if (data.every(item => item.string_list_data?.[0]?.value)) {
                return data.map(item => item.string_list_data[0].value);
            }
        }
    } catch (e) {
        return content.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [];
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

    // --- Firebase Initialization ---
    useEffect(() => {
        const firebaseConfigStr = process.env.REACT_APP_FIREBASE_CONFIG || (typeof __firebase_config !== 'undefined' ? __firebase_config : null);

        if (firebaseConfigStr) {
            try {
                const firebaseConfig = JSON.parse(firebaseConfigStr);
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const auth = getAuth(app);
                setDb(firestoreDb); // Set DB instance

                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        setUserId(user.uid); // Set user ID
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
                        }
                    }
                });
            } catch(e) {
                console.error("Firebase config parsing error:", e);
                setError("Firebase configuration is invalid.");
            }
        } else {
             setError("Firebase configuration is missing.");
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
        if (!db || !userId) {
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

            if (followers.length === 0 || following.length === 0) {
                setError("Followers and Following lists are required.");
                setIsLoading(false);
                return;
            }

            const followersSet = new Set(followers);
            const followingSet = new Set(following);

            const results = {
                dontFollowBack: following.filter(user => !followersSet.has(user)),
                iDontFollowBack: followers.filter(user => !followingSet.has(user)),
                mutuals: following.filter(user => followersSet.has(user)),
                unverifiedFollowings: pending.length > 0 ? pending.filter(user => followingSet.has(user)) : [],
                unfollowedAccounts: unfollowed.length > 0 ? unfollowed.filter(user => followingSet.has(user)) : [],
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
    }, [followersFile, followingFile, pendingFile, blockedFile, unfollowedFile, followersText, followingText, blockedText, db, userId, handleFileRead]);
    
    useEffect(() => {
        const loadPreviousData = async () => {
            if (db && userId) { // Check for db and userId directly
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
    }, [db, userId]); // Depend directly on db and userId

    const resetState = () => {
        setView('main');
        setFollowersFile(null); setFollowingFile(null); setPendingFile(null);
        setBlockedFile(null); setUnfollowedFile(null);
        setFollowersText(''); setFollowingText(''); setBlockedText('');
        setError('');
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

    const renderMain = () => (
        <div className="w-full max-w-7xl mx-auto animate-fade-in">
            <h2 className="text-4xl font-bold text-white text-center mb-8">Provide Your Instagram Data</h2>
            
            <section className="mb-12">
                <h3 className="text-2xl font-semibold text-white text-center mb-6">Required Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card><FileInput label="Followers File" id="followers-file" onFileSelect={setFollowersFile} /></Card>
                    <Card><FileInput label="Following File" id="following-file" onFileSelect={setFollowingFile} /></Card>
                    <Card><PasteInput label="Paste Followers List" value={followersText} onChange={setFollowersText} /></Card>
                    <Card><PasteInput label="Paste Following List" value={followingText} onChange={setFollowingText} /></Card>
                </div>
            </section>
            
            <section>
                <h3 className="text-2xl font-semibold text-white text-center mb-6">Optional Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card><FileInput label="Pending Requests File" id="pending-file" onFileSelect={setPendingFile} /></Card>
                    <Card><FileInput label="Unfollowed You File" id="unfollowed-file" onFileSelect={setUnfollowedFile} /></Card>
                    <Card><FileInput label="Blocked Accounts File" id="blocked-file" onFileSelect={setBlockedFile} /></Card>
                    <div className="md:col-span-3"><Card><PasteInput label="Paste Blocked Accounts List" value={blockedText} onChange={setBlockedText} /></Card></div>
                </div>
            </section>
            
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
                    disabled={!db || !userId || isLoading || (!followersFile && !followersText) || (!followingFile && !followingText)} 
                    className="bg-green-500 text-white font-bold rounded-full py-4 px-12 text-xl hover:bg-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-2xl"
                >
                    {!db || !userId ? 'Connecting...' : isLoading ? 'Processing...' : 'Analyze My Data'}
                </button>
            </div>
        </div>
    );
    
    const renderResults = () => (
        <div className="w-full max-w-7xl mx-auto animate-fade-in">
             <h2 className="text-4xl font-bold text-white text-center mb-8">Your Results</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <ResultList title="Don't Follow You Back" count={dontFollowBack.length} users={dontFollowBack} />
                <ResultList title="You Don't Follow Back" count={iDontFollowBack.length} users={iDontFollowBack} />
                <ResultList title="Mutuals" count={mutuals.length} users={mutuals} />
                <ResultList title="Blocked Accounts" count={blockedAccounts.length} users={blockedAccounts} />
                <ResultList title="Unverified Followings" count={unverifiedFollowings.length} users={unverifiedFollowings} />
                <ResultList title="Recently Unfollowed You" count={unfollowedAccounts.length} users={unfollowedAccounts} />
             </div>
             <div className="text-center mt-12">
                 <button onClick={resetState} className="bg-indigo-500 text-white font-bold rounded-full py-3 px-8 text-lg hover:bg-indigo-400 transition-all duration-300 transform hover:scale-105 shadow-2xl">
                    Start Over
                </button>
             </div>
        </div>
    );

    // Show a global loading screen until Firebase is ready
    if (!db || !userId) {
        return (
            <main className="min-h-screen w-full bg-gray-900 text-white flex flex-col items-center justify-center">
                 <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-xl">{error ? error : "Connecting securely..."}</p>
            </main>
        )
    }

    return (
        <main className="min-h-screen w-full bg-gray-900 bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="relative z-10 w-full flex items-center justify-center">
                {view === 'intro' && renderIntro()}
                {view === 'main' && renderMain()}
                {view === 'results' && renderResults()}
            </div>
        </main>
    );
}
