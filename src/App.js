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
                {},
            ];
        }
    };
};