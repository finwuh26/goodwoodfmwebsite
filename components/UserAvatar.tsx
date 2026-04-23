import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from '../realtimeFirestoreCompat';
import { db } from '../firebase';

interface UserAvatarProps {
  userId: string;
  fallbackAvatar?: string;
  fallbackName?: string;
  className?: string;
}

interface UserAvatarData {
  avatar: string | null;
  username: string | null;
}

interface SharedUserAvatarListener {
  data: UserAvatarData | null;
  subscribers: Set<(data: UserAvatarData | null) => void>;
  unsubscribe: (() => void) | null;
}

const sharedUserAvatarListeners = new Map<string, SharedUserAvatarListener>();

const subscribeToSharedUserAvatar = (
  userId: string,
  callback: (data: UserAvatarData | null) => void
): (() => void) => {
  let entry = sharedUserAvatarListeners.get(userId);

  if (!entry) {
    entry = {
      data: null,
      subscribers: new Set(),
      unsubscribe: null
    };
    sharedUserAvatarListeners.set(userId, entry);
  }

  entry.subscribers.add(callback);

  // If already loaded, immediately notify the new subscriber
  if (entry.data) {
    callback(entry.data);
  }

  // If this is the first subscriber, start the onSnapshot listener
  if (!entry.unsubscribe) {
    entry.unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (docSnap) => {
        const docData = docSnap.exists() ? docSnap.data() : null;
        const newData = docSnap.exists()
          ? {
              avatar: (docData?.avatar as string) || null,
              username: (docData?.username as string) || null
            }
          : null;
        
        const currentEntry = sharedUserAvatarListeners.get(userId);
        if (currentEntry) {
          currentEntry.data = newData;
          currentEntry.subscribers.forEach((sub) => sub(newData));
        }
      },
      (err) => {
        console.warn(`Failed to read avatar for user ${userId}`, err);
      }
    );
  }

  return () => {
    const current = sharedUserAvatarListeners.get(userId);
    if (!current) return;
    
    current.subscribers.delete(callback);
    
    // If no more subscribers, clean up the listener to save memory
    if (current.subscribers.size === 0) {
      if (current.unsubscribe) {
        current.unsubscribe();
      }
      sharedUserAvatarListeners.delete(userId);
    }
  };
};

export const UserAvatar = ({ userId, fallbackAvatar, fallbackName, className }: UserAvatarProps) => {
  const [avatar, setAvatar] = useState<string | null>(fallbackAvatar || null);
  const [name, setName] = useState<string | null>(fallbackName || null);

  useEffect(() => {
    if (!userId) {
      setAvatar(fallbackAvatar || null);
      setName(fallbackName || null);
      return;
    }

    const unsubscribe = subscribeToSharedUserAvatar(userId, (data) => {
      if (data) {
        setAvatar(data.avatar);
        if (data.username) setName(data.username);
      } else {
        setAvatar(fallbackAvatar || null);
        setName(fallbackName || null);
      }
    });

    return () => unsubscribe();
  }, [userId, fallbackAvatar, fallbackName]);

  useEffect(() => {
      if (fallbackAvatar && !avatar) {
          setAvatar(fallbackAvatar);
      }
  }, [fallbackAvatar, avatar]);

  if (avatar) {
    return <img src={avatar} alt="Avatar" className={`object-cover border-none ${className}`} />;
  }

  return (
    <div className={`bg-emerald-900 border border-goodwood-border flex items-center justify-center ${className}`}>
      <span className="text-white font-black uppercase">
        {name ? name.charAt(0) : '?'}
      </span>
    </div>
  );
};
