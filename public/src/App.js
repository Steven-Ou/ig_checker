//The start of the frontend 
import React, {useState, useEffect, useCallback} from "react";
import {initalizeApp} from "firebase/app";
import {getAnalytics} from "firebase/analytics";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ArrowUpCircle, UserCheck, UserX, Heart, Shield, Clock, Users, FileUp, BarChart2 } from 'lucide-react';
import { get } from "http";
import parseJson from "parse-json";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
// This section initializes the connection to your Firebase project.
// It checks if the necessary keys exist before trying to connect.
let app;
if(firebaseConfig.apiKey && firebaseConfig.projectId){
    app = initalizeApp(firebaseConfig);
}

//Creating and exporting instances of the Firebase service throughout the app.
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id:'default_app_id';

//-- Helper Functions -- 
/**
 * Reads a user-uploaded file and parses its content as JSON.
 * @param {File} file - The file object from a file input.
 * @returns {Promise<Object>} A promise that resolves with the parsed JSON object.
 */
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

/**
 * Extracts a clean list of user data from the raw Instagram JSON structure.
 * @param {Object} data - The raw JSON data from an Instagram export file.
 * @param {string} key - The top-level key in the JSON where the user list is located (e.g., 'relationships_followers').
 * @returns {Array<Object>} An array of user objects, each with a username, url, and timestamp.
 */
const extractUsernames = (data, key)=>{
    if(!data) return [];
    const list = data[key] || (Array.isArray(data)?data:[]);
    if(!Array.isArray(list)) return [];

    return list.map(item =>({
        username:item.string_list_data[0].value,
        url:item.string_list_data[0].href,
        timestamp:item.string_list_data[0].timestamp,
    }));
};

// --React Components-- 

/**
 * A reusable Modal component for showing messages or alerts to the user.
 */
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

/**
 * A reusable file input component with a nice UI for dragging and dropping files.
 */
const FileInput=({
    onFileSelect, 
    label, 
    requiredFileName
}) =>{
    const [fileName, setFileName] = useState('');

    const handleFileChange=(e)=>{
        const file = e.target.files[0];
        if(file){
            setFileName(file.name);
            onFileSelect(file);
        }
    };

    return(
        <div className="w-full">
            <label classname = "block text-sm font-medium text-gray-600 mb-2">{label}</label>
            <label htmlFor={requiredFileName} className={`flex justify-center items-center w-full px-4 py-6 bg-gray-50 rounded-lg border-2 ${fileName ? 'border-green-400' : 'border-dashed border-gray-300'} cursor-pointer hover:border-blue-500 transition-all`}>
                <div>
                    <FileUp className={`mx-auto h-10 w-10 ${fileName ? 'text-green-500' : 'text-gray-400'}`}></FileUp>
                </div>
                <p className={`mt-2 text-sm ${fileName ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                    {fileName || `Click or drag to upload ${requiredFileName}`}
                </p>
            </label>
            <input type="file" id={requiredFileName} className="hidden" accept=".json" onChange={handleFileChange} />
        </div>
    );
};

/**
 * The first screen the user sees. It handles file selection and uploading to Firestore.
 */

const UploadScreen = ({ onUploadComplete}) =>{
    //State to hold the file objects selected by the user.
    const [files, setFiles] = useState({});    
    //State to manage the loading spinner on the button.
    const [isLoading, setIsLoading] = useState(false);
    //State to control the visibility and content of the modal.
    const [modal, setModal] = useState({ show: false, title: '', message: '' });
    //State to store the current user's unique ID from Firebase Auth.
    const [userId, setUserId] = useState(null);

    //'useEffect' hook to listen for authentication changes and get the user's ID.
    useEffect(() =>{
        const unsubscribe = onAuthStateChanged(auth, (user)=>{
            if(user){
                setUserId(user.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleFileSelect = (file,type)=>{
        setFiles(prev=>({
            ...prev,
            [type]: file
        }));
    };
    //This function handles the main logic of parsing files and uploading to the database.
    const handleUpload = async ()=>{
        //Basic validation to ensure required files are present. 
        if(!files.followers || !files.following){
            setModal({
                show:true,
                title:'Missing Files',
                message:'Please upload both the followers and following files!'
            });
            return;
        }
        if(!userId){
            setModal({
                show:true,
                title:'Authentication Error',
                message: 'Could not verify user. Please refresh and try again.'
            });
            return;
        }

        setIsLoading(true);

        try{
            //Parse the main JSON files.
            const followersJson= await parseJsonFile(files.followers);
            const followingJson= await parseJsonFile(files.following);

            //Extract clean list of users.
            const followers = extractUsernames(followersJson, 'relationships_followers'); 
            const following = extractUsernames(followingJson, 'relationships_following');

            //Define the optional files that can also be uploaded.
            const otherFiles =[
                {key: 'blocked', files:files.blocked, jsonKey:'relationships_blocked_users' },
                {key: 'closedFriends', file:files.closeFriends, jsonKey:'relationships_close_friends'},
                {key: 'pendingRequests', file:files.pendingRequests, jsonKey:'relationships_follow_requests_sent'},
            ];

            //Use a Firestore "batch" to perform multiple writes as a single atomic operation.
            //This is more efficient and safer than many individual writes.
            const batch = writeBatch(db);
            
            //A helper function to upload a list of users to a specific collection in Firestore.
            const uploadList= async(list, collectionName)=>{
                const collectionRef = collection(db, `artifacts/${appId}/users`, userId, collectionName);
                list.forEach(item=>{
                    const docRef = doc(collectionRef, item.username);
                    batch.set(docRef, item);
                });
            };

            //Upload the main lists.
            await uploadList(followers, 'followers');
            await uploadList(following, 'following');


            for(const{key,file,jsonKey} of otherFiles){
                if(file){
                    const json = await parseJsonFile(file);
                    const data = extractUsernames(json, jsonKey);
                    await uploadList(data, key);
                }
            }

            //Storing a snapshot of the current followers list for future comparisons
            const snapshotRef = doc(db, `artifacts/${appId}/users`, userId, 'snapshots', new Date().toISOString());
            batch.set(snapshotRef,{
                createdAt: new Date(),
                followerCount: followers.length,
                followers:followers.map(f=>f.username)
            });

            //commit all the batched writes to the database.
            await batch.commit();

            //Showing a success message and then triggering the transitioning to the dashboard.
            setModal({
                show:true,
                title:'Success!',
                message:'Your Instagram data has been securely uploaded and analyzed.'
            });
            setTimeout(onUploadCompletem,2000);
        }catch(error){
            setModal({
                show:true,
                title:'Upload Failed',
                message:error.message
            });
        }finally{
            setIsLoading(false);
        }
    };

    //The JSX that defines the UI for the upload screen.
    return(
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            {modal.show && 
            <Modal 
                title = {modal.title}
                message={modal.message}
                onClose={()=> setModal({
                    show:false,
                    title:'',
                    message:''
                })}
            />
            }
            <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-6 md:p-10">
                <div className="text-center mb-8">
                    <BarChart2 className="mx-auto h-12 w-12 text-blue-600" />
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4">Instagram Insights Dashboard</h1>
                    <p className="mt-2 text-gray-600">Upload your data export to get started. It's secure and private.</p>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-8 text-sm">
                    <h2 className="font-semibold text-blue-800">How to get your data:</h2>
                    <p className="text-blue-700">Go to Instagram {'>'} Settings {'>'} Your Activity {'>'} Download your information. Request the <strong>JSON</strong> format. You'll need the files from the <code>followers_and_following</code> folder.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                    {isLoading ?(
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>                                                       
                            </svg>
                            Analyzing...
                        </>
                    ):'Upload & Analyze'}
                </button>
            </div>
        </div>
    );
};

/**
 * A simple component to display a single user in a list.
 */
const UserListItem = ({user}) =>(
    <li className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <span className="font-medium text-gray-800">
            {user.username}
        </span>
        <a href={user.url} target="_blank" rel="noopener noreferrer" className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors">
            View Profile
        </a>
    </li>
);

/**
 * The main dashboard screen that displays all the analyzed data in tabs.
 */
const Dashboard = ({onSignOut})=>{
    // State to track which tab is currently active.
    const[activeTab, setActiveTab] = useState('notFollowingBack');
    // State to hold all the data fetched from Firestore.    
    const[data,setData] = useState({});
    // State to manage the loading state while data is being fetched.
    const[loading,setLoading]= useState(true);
    const [userId, setUserId] = useState(null);

    // 'useCallback' memoizes this function so it isn't recreated on every render, improving performance.
    const fetchData = useCallback(async(uid)=>{
        setLoading(true);
        try{
            const collections = ['followers', 'following','blocked','closeFriends','pendingRequests'];
            const dataPromises = collections.map(async(colName)=>{
                const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/users`, uid, colName));
                return { [colName]: querySnapshot.docs.map(doc => doc.data()) };

            });
        }catch(error){

        }finally{

        }
    },[]);
}