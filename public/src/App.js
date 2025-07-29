// --- React and Library Imports ---
// Imports the main React library, which is necessary for creating components.
import React, { useState, useEffect, useCallback } from 'react';
// Imports functions from the Firebase SDK to connect to and interact with Firebase services.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
// Imports icon components from the 'lucide-react' library to make the UI look nice.
import { UserCheck, UserX, Heart, Shield, Clock, FileUp, BarChart2 } from 'lucide-react';

// --- Firebase Configuration ---
// This object holds your unique project keys. It securely reads these values from an
// environment file (.env.local) so you don't expose your secret keys directly in the code.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY, // Your project's API Key
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN, // Your project's authentication domain
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID, // Your project's unique ID
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET, // Your project's storage location
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID, // Your project's messaging ID
  appId: process.env.REACT_APP_FIREBASE_APP_ID // Your project's app ID
};

// --- Firebase Initialization ---
// This section initializes the connection to your Firebase project.
let app; // Declares a variable to hold the initialized Firebase app instance.
// It checks if the necessary keys exist before trying to connect to prevent errors.
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    // If keys are present, initialize the Firebase app with your configuration.
    app = initializeApp(firebaseConfig);
}

// These lines create instances of the Firebase services we'll use throughout the app.
const auth = getAuth(app); // Gets the authentication service instance.
const db = getFirestore(app); // Gets the Firestore database service instance.
// This gets the unique ID for this specific application instance, provided by the environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Helper Functions ---

/**
 * Reads a user-uploaded file and parses its content as JSON.
 * @param {File} file - The file object from a file input.
 * @returns {Promise<Object>} A promise that resolves with the parsed JSON object.
 */
const parseJsonFile = (file) => {
  // Returns a new Promise, which allows us to handle the asynchronous file reading process.
  return new Promise((resolve, reject) => {
    // Creates a new FileReader instance to read the file.
    const reader = new FileReader();
    // This function is called when the file has been successfully read.
    reader.onload = (e) => {
      try {
        // Tries to parse the file content (e.target.result) as JSON.
        const json = JSON.parse(e.target.result);
        // If successful, the promise is resolved with the JSON data.
        resolve(json);
      } catch (error) {
        // If parsing fails, the promise is rejected with an error.
        reject(new Error(`Error parsing ${file.name}: ${error.message}`));
      }
    };
    // This function is called if there's an error reading the file.
    reader.onerror = (e) => reject(new Error(`Error reading ${file.name}.`));
    // Starts reading the file as plain text.
    reader.readAsText(file);
  });
};

/**
 * Extracts a clean list of user data from the raw Instagram JSON structure.
 * @param {Object} data - The raw JSON data from an Instagram export file.
 * @param {string} key - The top-level key in the JSON where the user list is located (e.g., 'relationships_followers').
 * @returns {Array<Object>} An array of user objects, each with a username, url, and timestamp.
 */
const extractUsernames = (data, key) => {
    // If the input data is null or undefined, return an empty array to prevent errors.
    if (!data) return [];
    // Finds the list of users, which might be nested under a key or be the top-level array.
    const list = data[key] || (Array.isArray(data) ? data : []);
    // If the result is not an array, return an empty array.
    if (!Array.isArray(list)) return [];
    
    // Maps over the raw list to create a new, clean array of user objects.
    return list.map(item => ({
        username: item.string_list_data[0].value, // Extracts the username.
        url: item.string_list_data[0].href,       // Extracts the profile URL.
        timestamp: item.string_list_data[0].timestamp, // Extracts the timestamp.
    }));
};

// --- React Components ---

/**
 * A reusable Modal component for showing messages or alerts to the user.
 */
const Modal = ({ title, message, onClose }) => (
    // The outer div is the semi-transparent background overlay.
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        {/* This is the white modal box in the center. */}
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 text-center">
            {/* The title of the modal. */}
            <h3 className="text-2xl font-bold text-gray-800 mb-4">{title}</h3>
            {/* The message content of the modal. */}
            <p className="text-gray-600 mb-6">{message}</p>
            {/* The button to close the modal. */}
            <button 
                onClick={onClose} 
                className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300"
            >
                Close
            </button>
        </div>
    </div>
);

/**
 * A reusable file input component with a nice UI for dragging and dropping files.
 */
const FileInput = ({ onFileSelect, label, requiredFileName }) => {
    // 'useState' hook to keep track of the uploaded file's name for display purposes.
    const [fileName, setFileName] = useState('');

    // This function handles the event when a user selects a file.
    const handleFileChange = (e) => {
        // Gets the first file from the input event.
        const file = e.target.files[0];
        // If a file was selected...
        if (file) {
            // ...update the state with its name.
            setFileName(file.name);
            // ...and call the parent component's onFileSelect function with the file.
            onFileSelect(file);
        }
    };

    // The JSX that defines the UI for the file input.
    return (
        <div className="w-full">
            {/* The text label above the input box. */}
            <label className="block text-sm font-medium text-gray-600 mb-2">{label}</label>
            {/* The clickable area for file selection. It's styled to look like a drop zone. */}
            <label htmlFor={requiredFileName} className={`flex justify-center items-center w-full px-4 py-6 bg-gray-50 rounded-lg border-2 ${fileName ? 'border-green-400' : 'border-dashed border-gray-300'} cursor-pointer hover:border-blue-500 transition-all`}>
                <div className="text-center">
                    {/* The upload icon. */}
                    <FileUp className={`mx-auto h-10 w-10 ${fileName ? 'text-green-500' : 'text-gray-400'}`} />
                    {/* The text that shows the file name or prompts the user to upload. */}
                    <p className={`mt-2 text-sm ${fileName ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                        {fileName || `Click or drag to upload ${requiredFileName}`}
                    </p>
                </div>
            </label>
            {/* The actual HTML file input, which is hidden from view but triggered by the label. */}
            <input type="file" id={requiredFileName} className="hidden" accept=".json" onChange={handleFileChange} />
        </div>
    );
};

/**
 * The first screen the user sees. It handles file selection and uploading to Firestore.
 */
const UploadScreen = ({ onUploadComplete }) => {
    // State to hold the file objects selected by the user.
    const [files, setFiles] = useState({});
    // State to manage the loading spinner on the button.
    const [isLoading, setIsLoading] = useState(false);
    // State to control the visibility and content of the modal.
    const [modal, setModal] = useState({ show: false, title: '', message: '' });
    // State to store the current user's unique ID from Firebase Auth.
    const [userId, setUserId] = useState(null);

    // 'useEffect' hook to listen for authentication changes. Runs once when the component mounts.
    useEffect(() => {
        // Sets up a listener that fires whenever the user's sign-in state changes.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            // If a user is signed in...
            if (user) {
                // ...store their unique ID in the state.
                setUserId(user.uid);
            }
        });
        // Returns a cleanup function to remove the listener when the component unmounts.
        return () => unsubscribe();
    }, []); // The empty array [] means this effect runs only once.

    // A callback function to update the 'files' state when a file is selected.
    const handleFileSelect = (file, type) => {
        setFiles(prev => ({ ...prev, [type]: file }));
    };

    // This function handles the main logic of parsing files and uploading them to the database.
    const handleUpload = async () => {
        // Basic validation to ensure required files are present.
        if (!files.followers || !files.following) {
            setModal({ show: true, title: 'Missing Files', message: 'Please upload both followers and following files.' });
            return; // Stop the function if files are missing.
        }
        // Ensure we have a user ID before proceeding.
        if (!userId) {
            setModal({ show: true, title: 'Authentication Error', message: 'Could not verify user. Please refresh and try again.' });
            return; // Stop the function if user ID is missing.
        }

        // Set loading state to true to show the spinner on the button.
        setIsLoading(true);

        try {
            // Asynchronously parse the main JSON files.
            const followersJson = await parseJsonFile(files.followers);
            const followingJson = await parseJsonFile(files.following);
            
            // Extract clean lists of users from the parsed JSON.
            const followers = extractUsernames(followersJson, 'relationships_followers');
            const following = extractUsernames(followingJson, 'relationships_following');

            // Define the optional files that can also be uploaded.
            const otherFiles = [
                { key: 'blocked', file: files.blocked, jsonKey: 'relationships_blocked_users' },
                { key: 'closeFriends', file: files.closeFriends, jsonKey: 'relationships_close_friends' },
                { key: 'pendingRequests', file: files.pendingRequests, jsonKey: 'relationships_follow_requests_sent' },
            ];

            // Use a Firestore "batch" to perform multiple writes as a single atomic operation.
            const batch = writeBatch(db);
            
            // A helper function to add a list of users to the batch for uploading.
            const uploadList = async (list, collectionName) => {
                const collectionRef = collection(db, `artifacts/${appId}/users`, userId, collectionName);
                list.forEach(item => {
                    const docRef = doc(collectionRef, item.username);
                    batch.set(docRef, item);
                });
            };

            // Add the main lists to the batch.
            await uploadList(followers, 'followers');
            await uploadList(following, 'following');
            
            // Loop through and add any optional files that were provided to the batch.
            for (const { key, file, jsonKey } of otherFiles) {
                if (file) {
                    const json = await parseJsonFile(file);
                    const data = extractUsernames(json, jsonKey);
                    await uploadList(data, key);
                }
            }
            
            // Store a snapshot for future "unfollower" checks.
            const snapshotRef = doc(db, `artifacts/${appId}/users`, userId, 'snapshots', new Date().toISOString());
            batch.set(snapshotRef, {
                createdAt: new Date(),
                followerCount: followers.length,
                followers: followers.map(f => f.username) // Store only usernames to save space
            });

            // Commit all the batched writes to the database at once.
            await batch.commit();

            // Show a success message and then trigger the transition to the dashboard after 2 seconds.
            setModal({ show: true, title: 'Success!', message: 'Your Instagram data has been securely uploaded and analyzed.' });
            setTimeout(onUploadComplete, 2000);

        } catch (error) {
            // If any step fails, show an error modal.
            setModal({ show: true, title: 'Upload Failed', message: error.message });
        } finally {
            // No matter what happens, set loading back to false to hide the spinner.
            setIsLoading(false);
        }
    };

    // The JSX that defines the UI for the upload screen.
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            {/* Conditionally render the modal if modal.show is true. */}
            {modal.show && <Modal title={modal.title} message={modal.message} onClose={() => setModal({ show: false, title: '', message: '' })} />}
            <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-6 md:p-10">
                <div className="text-center mb-8">
                    <BarChart2 className="mx-auto h-12 w-12 text-blue-600" />
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4">Instagram Insights Dashboard</h1>
                    <p className="mt-2 text-gray-600">Upload your data export to get started. It's secure and private.</p>
                </div>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-8 text-sm">
                    <h2 className="font-semibold text-blue-800">How to get your data:</h2>
                    <p className="text-blue-700">Go to Instagram > Settings > Your Activity > Download your information. Request the **JSON** format. You'll need the files from the `followers_and_following` folder.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Render the reusable FileInput components for each required/optional file. */}
                    <FileInput onFileSelect={(file) => handleFileSelect(file, 'followers')} label="1. Followers File (Required)" requiredFileName="followers_1.json" />
                    <FileInput onFileSelect={(file) => handleFileSelect(file, 'following')} label="2. Following File (Required)" requiredFileName="following.json" />
                    <FileInput onFileSelect={(file) => handleFileSelect(file, 'blocked')} label="Blocked Profiles (Optional)" requiredFileName="blocked_profiles.json" />
                    <FileInput onFileSelect={(file) => handleFileSelect(file, 'closeFriends')} label="Close Friends (Optional)" requiredFileName="close_friends.json" />
                    <FileInput onFileSelect={(file) => handleFileSelect(file, 'pendingRequests')} label="Pending Follow Requests (Optional)" requiredFileName="pending_follow_requests.json" />
                </div>

                <button
                    onClick={handleUpload}
                    disabled={isLoading || !files.followers || !files.following}
                    className="w-full bg-blue-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center text-lg"
                >
                    {/* Conditionally render either the loading spinner or the button text. */}
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
        </div>
    );
};

/**
 * A simple component to display a single user in a list.
 */
const UserListItem = ({ user }) => (
    <li className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <span className="font-medium text-gray-800">{user.username}</span>
        <a href={user.url} target="_blank" rel="noopener noreferrer" className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors">
            View Profile
        </a>
    </li>
);

/**
 * The main dashboard screen that displays all the analyzed data in tabs.
 */
const Dashboard = ({ onSignOut }) => {
    // State to track which tab is currently active.
    const [activeTab, setActiveTab] = useState('notFollowingBack');
    // State to hold all the data fetched from Firestore.
    const [data, setData] = useState({});
    // State to manage the loading state while data is being fetched.
    const [loading, setLoading] = useState(true);
    // State to hold the current user's ID.
    const [userId, setUserId] = useState(null);

    // 'useCallback' memoizes this function so it isn't recreated on every render.
    const fetchData = useCallback(async (uid) => {
        setLoading(true);
        try {
            // Define all the data collections we want to fetch from the database.
            const collections = ['followers', 'following', 'blocked', 'closeFriends', 'pendingRequests'];
            // Fetch all collections in parallel for better performance.
            const dataPromises = collections.map(async (colName) => {
                const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/users`, uid, colName));
                return { [colName]: querySnapshot.docs.map(doc => doc.data()) };
            });

            // Wait for all fetches to complete.
            const results = await Promise.all(dataPromises);
            // Combine the results into a single data object.
            const combinedData = results.reduce((acc, current) => ({ ...acc, ...current }), {});

            // --- Core Analysis Logic ---
            const followersSet = new Set(combinedData.followers.map(f => f.username));
            combinedData.notFollowingBack = combinedData.following.filter(f => !followersSet.has(f.username));

            const followingSet = new Set(combinedData.following.map(f => f.username));
            combinedData.fans = combinedData.followers.filter(f => !followingSet.has(f.username));
            
            // Update the state with the fetched and analyzed data.
            setData(combinedData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, []); // Empty dependency array means this function is created only once.

    // This useEffect hook runs once when the component mounts to get the user ID and trigger the data fetch.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                fetchData(user.uid);
            } else {
                onSignOut();
            }
        });
        return () => unsubscribe();
    }, [fetchData, onSignOut]); // It re-runs if fetchData or onSignOut changes (which they won't).

    // Configuration object for the dashboard tabs.
    const tabs = [
        { id: 'notFollowingBack', label: "Don't Follow You Back", icon: UserX, list: data.notFollowingBack },
        { id: 'fans', label: "Fans (You Don't Follow)", icon: UserCheck, list: data.fans },
        { id: 'closeFriends', label: 'Close Friends', icon: Heart, list: data.closeFriends },
        { id: 'blocked', label: 'Blocked Profiles', icon: Shield, list: data.blocked },
        { id: 'pendingRequests', label: 'Pending Requests', icon: Clock, list: data.pendingRequests },
    ];

    // A function to render the content of the currently selected tab.
    const renderContent = () => {
        // If data is still loading, show a loading message.
        if (loading) {
            return <div className="text-center p-10">Loading your insights...</div>;
        }

        // Find the configuration for the active tab.
        const currentTab = tabs.find(t => t.id === activeTab);
        // If the tab has no data, show a message.
        if (!currentTab || !currentTab.list) {
            return <div className="text-center p-10 text-gray-500">No data available for this section.</div>;
        }

        // If there is data, render the list of users.
        return (
            <div>
                <h3 className="text-xl font-bold mb-4">{currentTab.label} ({currentTab.list.length})</h3>
                {currentTab.list.length > 0 ? (
                    <ul className="space-y-2">
                        {/* Map over the list and render a UserListItem for each user. */}
                        {currentTab.list.map(user => <UserListItem key={user.username} user={user} />)}
                    </ul>
                ) : (
                    // If the list is empty, show a message.
                    <div className="text-center p-10 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">No accounts found in this category.</p>
                    </div>
                )}
            </div>
        );
    };
    
    // The JSX that defines the UI for the dashboard.
    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <BarChart2 className="h-8 w-8 text-blue-600"/>
                        <h1 className="text-2xl font-bold text-gray-800">Insights Dashboard</h1>
                    </div>
                    <div>
                        <span className="text-sm text-gray-500 mr-4">User ID: {userId}</span>
                        <button onClick={onSignOut} className="text-sm text-blue-600 hover:underline">New Upload</button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* The sidebar navigation for the tabs. */}
                    <aside className="lg:col-span-1">
                        <nav className="bg-white rounded-lg shadow p-4 space-y-1">
                            {/* Map over the tabs configuration to create the navigation buttons. */}
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-colors ${activeTab === tab.id ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                    <tab.icon className="h-5 w-5" />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>
                    {/* The main content area where the active tab's content is rendered. */}
                    <div className="lg:col-span-3 bg-white rounded-lg shadow p-6 md:p-8">
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
};

/**
 * This is the main root component of the application.
 * It handles the top-level logic of deciding whether to show the
 * UploadScreen or the Dashboard.
 */
export default function App() {
    // State to track if the user has already uploaded data to Firestore.
    const [hasData, setHasData] = useState(false);
    // State to prevent showing anything until Firebase authentication is ready.
    const [isAuthReady, setIsAuthReady] = useState(false);

    // This useEffect hook runs once when the app starts.
    useEffect(() => {
        // Checks if the current user has any data stored in Firestore.
        const checkUserData = async (user) => {
            if (user) {
                // Queries the 'followers' collection to see if any documents exist.
                const userHasData = (await getDocs(collection(db, `artifacts/${appId}/users`, user.uid, 'followers'))).size > 0;
                setHasData(userHasData);
            }
            // Once the check is complete, set auth to ready.
            setIsAuthReady(true);
        };

        // Handles the initial sign-in process.
        const authHandler = async () => {
            // If Firebase isn't initialized, show an error and stop.
            if (!app) {
                console.error("Firebase is not initialized. Check your environment variables.");
                setIsAuthReady(true);
                return;
            }
            try {
                // Signs the user in anonymously to get a unique ID for the database.
                const userCredential = typeof __initial_auth_token !== 'undefined'
                    ? await signInWithCustomToken(auth, __initial_auth_token)
                    : await signInAnonymously(auth);
                // After sign-in, check if they have existing data.
                await checkUserData(userCredential.user);
            } catch (error) {
                console.error("Authentication failed:", error);
                // Fallback logic in case of an error.
                try {
                    if (!auth.currentUser) {
                        const userCredential = await signInAnonymously(auth);
                        await checkUserData(userCredential.user);
                    } else {
                        await checkUserData(auth.currentUser);
                    }
                } catch (signInError) {
                    console.error("Anonymous sign-in failed:", signInError);
                    setIsAuthReady(true);
                }
            }
        };

        // Call the authentication handler function.
        authHandler();
    }, []); // The empty array [] means this effect runs only once on mount.

    // Callback function passed to the UploadScreen to switch to the dashboard view.
    const handleUploadComplete = () => {
        setHasData(true);
    };
    
    // Callback function for the "New Upload" button to go back to the upload screen.
    const handleSignOut =()=>{
        setHasData(false);
    };

    if(!isAuthReady){
        return(
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <svg className="animate-spin mx-auto h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4">

                        </circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">

                        </path>
                    </svg>
                    <p className="mt-4 text-gray-600">
                        Authenticating...
                    </p>
                </div>
            </div>
        );
    }
}