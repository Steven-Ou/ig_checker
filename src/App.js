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