//The start of the frontend 
import React, {useState, useEffect, useCallback} from "react";
import {initalizeApp} from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
