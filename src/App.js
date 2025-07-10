//The start of the frontend 
import React, {useState, useEffect, useCallback} from "react";
import {initalizeApp} from "firebase/app";
import {getAnalytics} from "firebase/analytics";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ArrowUpCircle, UserCheck, UserX, Heart, Shield, Clock, Users, FileUp, BarChart2 } from 'lucide-react';
import { get } from "http";

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
    if(file){
        
    }
};