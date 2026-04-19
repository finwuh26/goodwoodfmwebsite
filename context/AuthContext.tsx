import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  avatar: string;
  role: 'admin' | 'staff' | 'user' | 'vip' | 'member' | 'journalist' | 'dj' | 'manager' | 'owner';
  isVerified?: boolean;
  badges?: string[];
  reputationScore?: number;
  bio?: string;
  bannerGradient?: string;
  avatarHistory?: string[];
  twoFactorEnabled?: boolean;
  favoriteSong?: string;
  credits?: number;
  purchasedItems?: string[];
  activeRing?: string;
  activeNameIcon?: string;
  redeemedCodes?: string[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  systemSettings: any;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LAST_ACTIVE_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const normalizeUsername = (username?: string | null) => {
  const trimmed = username?.trim();
  if (!trimmed || trimmed.length < 3) return 'User';
  return trimmed;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ownerEmail = import.meta.env.VITE_OWNER_EMAIL?.trim();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState<any>({ firewallStrictMode: false, maintenanceMode: false });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings(docSnap.data());
      }
    });

    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen to profile changes in realtime to avoid stale role/profile regressions.
        unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            // Upgrade role if needed
            if (ownerEmail && data.email === ownerEmail && data.role !== 'owner') {
                updateDoc(userDocRef, { role: 'owner' }).catch(console.error);
            }
            setUserProfile(data);
          } else {
            // Create initial profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              username: normalizeUsername(firebaseUser.displayName),
              email: firebaseUser.email || '',
              avatar: firebaseUser.photoURL || '',
              role: 'user',
              isVerified: false,
              badges: [],
              reputationScore: 0,
              bio: '',
              avatarHistory: [firebaseUser.photoURL || '']
            };
            
            setDoc(userDocRef, {
              ...newProfile,
              createdAt: Timestamp.now(),
              lastActive: Timestamp.now()
            }, { merge: true }).then(() => {
              if (ownerEmail && firebaseUser.email === ownerEmail) {
                updateDoc(userDocRef, { role: 'owner', isVerified: true, badges: ['owner'] }).catch((err) => {
                  console.error('Failed to upgrade user to owner role:', err);
                });
              }
            }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`));
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`));

        updateDoc(userDocRef, { lastActive: serverTimestamp() }).catch((err) => {
          console.warn('Unable to update lastActive on auth state change:', err);
        });
        setLoading(false);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubProfile) {
        unsubProfile();
      }
      unsubscribe();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);

    const touch = () => {
      updateDoc(userDocRef, { lastActive: serverTimestamp() }).catch((err) => {
        console.warn('Unable to update lastActive heartbeat:', err);
      });
    };

    touch();
    const interval = setInterval(touch, LAST_ACTIVE_UPDATE_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') touch();
    };

    window.addEventListener('focus', touch);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', touch);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signupWithEmail = async (email: string, pass: string, username: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    const safeUsername = normalizeUsername(username);
    await updateProfile(res.user, { displayName: safeUsername });
    await res.user.getIdToken(true);
    
    const userDocRef = doc(db, 'users', res.user.uid);
    await updateDoc(userDocRef, {
      username: safeUsername,
    });
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, systemSettings, login, logout, loginWithEmail, signupWithEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
