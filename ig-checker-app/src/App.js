// --- React and Library Imports ---
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { UserCheck, UserX, Heart, Shield, Clock, FileUp, BarChart2, ChevronDown, ArrowRight } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// --- Firebase Initialization ---
let app;
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
}
const auth = getAuth(app);
const db = getFirestore(app);
const appId = firebaseConfig.appId || 'default-app-id';

// --- Helper Functions ---
const parseJsonFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        resolve(json);
      } catch (error) {
        reject(new Error(`Error parsing ${file.name}: ${error.message}`));
      }
    };
    reader.onerror = (e) => reject(new Error(`Error reading ${file.name}.`));
    reader.readAsText(file);
  });
};

const extractUsernames = (data, key) => {
    if (!data) return [];
    const list = data[key] || (Array.isArray(data) ? data : []);
    if (!Array.isArray(list)) return [];
    
    // Maps over the raw list and filters out any invalid usernames or malformed data
    return list
    .filter(item => item && item.string_list_data && item.string_list_data[0] && item.string_list_data[0].value)
    .map(item => ({
        username: item.string_list_data[0].value,
        url: item.string_list_data[0].href,
        timestamp: item.string_list_data[0].timestamp,
    }))
    .filter(user => !(user.username.startsWith('__') && user.username.endsWith('__')));
};

// --- React Components ---

const HomeScreen = ({ onGetStarted }) => (
    <div className="w-full max-w-3xl mx-auto text-center animate-fade-in p-4">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl p-8 md:p-12 border border-white/30 text-center">
            <BarChart2 className="mx-auto h-16 w-16 text-blue-600" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-6 tracking-tight">
                IG Checker
            </h1>
            <p className="mt-4 text-lg text-gray-700 max-w-xl mx-auto">
                Gain insights into your Instagram audience. Find out who doesn't follow you back, discover your biggest fans, and more.
            </p>
            <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto">
                All your data is processed on your device and securely stored for your session only.
            </p>
            <div className="mt-8">
                <button
                    onClick={onGetStarted}
                    className="w-full max-w-xs mx-auto bg-blue-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                </button>
            </div>
        </div>
    </div>
);


const Modal = ({ title, message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">{title}</h3>
            <p className="text-gray-600 mb-6">{message}</p>
            <button 
                onClick={onClose} 
                className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300"
            >
                Close
            </button>
        </div>
    </div>
);

const FileInput = ({ onFileSelect, label, requiredFileName }) => {
    const [fileName, setFileName] = useState('');
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            onFileSelect(file);
        }
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-gray-600 mb-2">{label}</label>
            <label htmlFor={requiredFileName} className={`flex justify-center items-center w-full px-4 py-6 bg-gray-50 rounded-lg border-2 ${fileName ? 'border-green-400' : 'border-dashed border-gray-300'} cursor-pointer hover:border-blue-500 transition-all`}>
                <div className="text-center">
                    <FileUp className={`mx-auto h-10 w-10 ${fileName ? 'text-green-500' : 'text-gray-400'}`} />
                    <p className={`mt-2 text-sm ${fileName ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                        {fileName || `Click or drag to upload ${requiredFileName}`}
                    </p>
                </div>
            </label>
            <input type="file" id={requiredFileName} className="hidden" accept=".json" onChange={handleFileChange} />
        </div>
    );
};

const UploadScreen = ({ onUploadComplete }) => {
    const [files, setFiles] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [modal, setModal] = useState({ show: false, title: '', message: '' });
    const [userId, setUserId] = useState(null);
    const [activeSection, setActiveSection] = useState('followers');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleFileSelect = (file, type) => {
        setFiles(prev => ({ ...prev, [type]: file }));
        if (type === 'followers') {
            setActiveSection('following');
        }
    };

    const handleUpload = async () => {
        if (!files.followers || !files.following) {
            setModal({ show: true, title: 'Missing Files', message: 'Please upload both followers and following files.' });
            return;
        }
        if (!userId) {
            setModal({ show: true, title: 'Authentication Error', message: 'Could not verify user. Please refresh and try again.' });
            return;
        }

        setIsLoading(true);

        try {
            const followersJson = await parseJsonFile(files.followers);
            const followingJson = await parseJsonFile(files.following);
            
            const followers = extractUsernames(followersJson, 'relationships_followers');
            const following = extractUsernames(followingJson, 'relationships_following');

            const otherFiles = [
                { key: 'blocked', file: files.blocked, jsonKey: 'relationships_blocked_users' },
                { key: 'closeFriends', file: files.closeFriends, jsonKey: 'relationships_close_friends' },
                { key: 'pendingRequests', file: files.pendingRequests, jsonKey: 'relationships_follow_requests_sent' },
            ];

            const batch = writeBatch(db);
            
            const uploadList = async (list, collectionName) => {
                if (!collectionName || list.length === 0) return;

                const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
                list.forEach(item => {
                    const docRef = doc(collectionRef, item.username);
                    batch.set(docRef, item);
                });
            };

            await uploadList(followers, 'followers');
            await uploadList(following, 'following');
            
            for (const { key, file, jsonKey } of otherFiles) {
                if (file) {
                    const json = await parseJsonFile(file);
                    const data = extractUsernames(json, jsonKey);
                    await uploadList(data, key);
                }
            }
            
            const snapshotRef = doc(db, `artifacts/${appId}/users/${userId}/snapshots/${new Date().toISOString()}`);
            batch.set(snapshotRef, {
                createdAt: new Date(),
                followerCount: followers.length,
                followers: followers.map(f => f.username)
            });

            await batch.commit();

            setModal({ show: true, title: 'Success!', message: 'Your Instagram data has been securely uploaded and analyzed.' });
            setTimeout(onUploadComplete, 2000);

        } catch (error) {
            console.error("Upload Error:", error);
            setModal({ show: true, title: 'Upload Failed', message: `An error occurred during upload. Please check the console for details. Message: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    };
    
    const uploadSections = [
        { key: 'followers', label: "1. Followers File (Required)", requiredFileName: "followers_1.json" },
        { key: 'following', label: "2. Following File (Required)", requiredFileName: "following.json" },
        { key: 'blocked', label: "Blocked Accounts (Optional)", requiredFileName: "blocked_accounts.json" },
        { key: 'closeFriends', label: "Close Friends (Optional)", requiredFileName: "close_friends.json" },
        { key: 'pendingRequests', label: "Pending Follow Requests (Optional)", requiredFileName: "pending_follow_requests.json" },
    ];

    return (
        <div className="max-w-2xl w-full mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-10">
            {modal.show && <Modal title={modal.title} message={modal.message} onClose={() => setModal({ show: false, title: '', message: '' })} />}
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4">Upload Your Data</h1>
                <p className="mt-2 text-gray-600">Securely upload your Instagram JSON files to get started.</p>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-8 text-sm">
                <h2 className="font-semibold text-blue-800">How to get your data:</h2>
                <p className="text-blue-700">Go to Instagram {'>'} Settings {'>'} Your Activity {'>'} Download your information. Request the <strong>JSON</strong> format. You'll need the files from the <code>followers_and_following</code> folder.</p>
            </div>

            <div className="space-y-4 mb-8">
                {uploadSections.map(({ key, label, requiredFileName }) => (
                    <div key={key} className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300">
                        <button
                            onClick={() => setActiveSection(activeSection === key ? null : key)}
                            className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center focus:outline-none"
                        >
                            <span className={`font-semibold ${files[key] ? 'text-green-600' : 'text-gray-700'}`}>
                                {label} {files[key] ? '✓ Uploaded' : ''}
                            </span>
                            <ChevronDown className={`h-5 w-5 text-gray-500 transform transition-transform ${activeSection === key ? 'rotate-180' : ''}`} />
                        </button>
                        {activeSection === key && (
                            <div className="p-6 bg-white border-t border-gray-200">
                                <FileInput
                                    onFileSelect={(file) => handleFileSelect(file, key)}
                                    label={`Upload "${requiredFileName}"`}
                                    requiredFileName={requiredFileName}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={handleUpload}
                disabled={isLoading || !files.followers || !files.following}
                className="w-full bg-blue-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center text-lg"
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing...
                    </>
                ) : 'Upload & Analyze'}
            </button>
        </div>
    );
};

const UserListItem = ({ user }) => (
    <li className="flex items-center justify-between bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
        <span className="font-medium text-gray-800">{user.username}</span>
        <a href={user.url} target="_blank" rel="noopener noreferrer" className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors">
            View Profile
        </a>
    </li>
);

const Dashboard = ({ onSignOut }) => {
    const [activeTab, setActiveTab] = useState('notFollowingBack');
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);
    
    const fetchData = useCallback(async (uid) => {
        setLoading(true);
        try {
            const collections = ['followers', 'following', 'blocked', 'closeFriends', 'pendingRequests'];
            const dataPromises = collections.map(async (colName) => {
                const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${uid}/${colName}`));
                return { [colName]: querySnapshot.docs.map(doc => doc.data()) };
            });

            const results = await Promise.all(dataPromises);
            const combinedData = results.reduce((acc, current) => ({ ...acc, ...current }), {});

            const followersSet = new Set((combinedData.followers || []).map(f => f.username));
            combinedData.notFollowingBack = (combinedData.following || []).filter(f => !followersSet.has(f.username));

            const followingSet = new Set((combinedData.following || []).map(f => f.username));
            combinedData.fans = (combinedData.followers || []).filter(f => !followingSet.has(f.username));
            
            setData(combinedData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchData(user.uid);
            } else {
                onSignOut();
            }
        });
        return () => unsubscribe();
    }, [fetchData, onSignOut]);

    const tabs = [
        { id: 'notFollowingBack', label: "Don't Follow You Back", icon: UserX, list: data.notFollowingBack },
        { id: 'fans', label: "Fans", icon: UserCheck, list: data.fans },
        { id: 'closeFriends', label: 'Close Friends', icon: Heart, list: data.closeFriends },
        { id: 'blocked', label: 'Blocked', icon: Shield, list: data.blocked },
        { id: 'pendingRequests', label: 'Pending', icon: Clock, list: data.pendingRequests },
    ];

    const renderContent = () => {
        if (loading) {
            return <div className="text-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>;
        }
        const currentTab = tabs.find(t => t.id === activeTab);
        if (!currentTab || !currentTab.list || currentTab.list.length === 0) {
            return (
                 <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                    <h3 className="text-2xl font-bold mb-6 text-gray-800">{currentTab.label} (0)</h3>
                    <div className="text-center py-12 px-6 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">No accounts found in this category.</p>
                    </div>
                </div>
            )
        }
        return (
             <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <h3 className="text-2xl font-bold mb-6 text-gray-800">{currentTab.label} ({currentTab.list.length})</h3>
                <ul className="space-y-3">
                    {currentTab.list.map(user => <UserListItem key={user.username} user={user} />)}
                </ul>
            </div>
        );
    };
    
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <nav className="mb-8 bg-white/70 backdrop-blur-lg rounded-full shadow-lg p-2 max-w-lg mx-auto">
                <ul className="flex items-center justify-center space-x-2">
                    {tabs.map(tab => (
                        <li key={tab.id}>
                            <button
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex flex-col items-center justify-center px-4 py-2 rounded-full transition-all duration-300 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-blue-100 hover:text-blue-600'}`}
                            >
                                <tab.icon className="h-5 w-5 mb-1" />
                                <span className="text-xs font-semibold">{tab.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            {renderContent()}
        </div>
    );
};

export default function App() {
    const [page, setPage] = useState('loading');
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const authHandler = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                const userHasData = (await getDocs(collection(db, `artifacts/${appId}/users/${user.uid}/followers`))).size > 0;
                setPage(userHasData ? 'dashboard' : 'home');
            } else {
                try {
                    const userCredential = await signInAnonymously(auth);
                    setUserId(userCredential.user.uid);
                    setPage('home');
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                    setPage('error');
                }
            }
            setIsAuthReady(true);
        });

        if (!app) {
            console.error("Firebase is not initialized. Check your environment variables.");
            setPage('error');
            setIsAuthReady(true);
            return;
        }

        return () => authHandler();
    }, []);

    const renderPage = () => {
        if (!isAuthReady || page === 'loading') {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <svg className="animate-spin mx-auto h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-4 text-gray-600">Authenticating...</p>
                    </div>
                </div>
            );
        }
        if (page === 'error' || !app) {
            return (
                 <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h2>
                    <p className="text-gray-700">Firebase configuration is missing. Please make sure your <code>.env.local</code> file is set up correctly.</p>
                </div>
            );
        }
        
        switch (page) {
            case 'home':
                return <HomeScreen onGetStarted={() => setPage('upload')} />;
            case 'upload':
                return <UploadScreen onUploadComplete={() => setPage('dashboard')} />;
            case 'dashboard':
                return <Dashboard onSignOut={() => setPage('home')} />;
            default:
                return <HomeScreen onGetStarted={() => setPage('upload')} />;
        }
    };

    return (
        <div className="App min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-100 flex flex-col items-center justify-center p-4">
             {page !== 'home' && isAuthReady && (
                <header className="w-full max-w-4xl mx-auto flex justify-between items-center mb-8 pt-4">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setPage('home')}>
                        <BarChart2 className="h-10 w-10 text-blue-600"/>
                        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">IG Checker</h1>
                    </div>
                    {userId && (
                        <div className="text-center">
                            <p className="text-xs text-gray-400">SESSION ID</p>
                            <p className="text-sm font-mono text-gray-600">{userId}</p>
                        </div>
                    )}
                </header>
             )}
            <main className="w-full flex-grow flex items-center justify-center">
                {renderPage()}
            </main>
        </div>
    );
}