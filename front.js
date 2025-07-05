//The start of the frontend 
import React, {useState, useEffect, useCallback} from "react";
import {initalizeApp} from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ArrowUpCircle, UserCheck, UserX, Heart, Shield, Clock, Users, FileUp, BarChart2 } from 'lucide-react';
