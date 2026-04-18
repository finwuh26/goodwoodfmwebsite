import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
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
  lastUpdatedAt: number;
  unsubscribe: (() => void) | null;
  subscribers: Set<(data: UserAvatarData | null) => void>;
}

const USER_AVATAR_CACHE_TTL_MS = 10_000;
const sharedUserAvatarListeners = new Map<string, SharedUserAvatarListener>();

const subscribeToSharedUserAvatar = (
  userId: string,
  callback: (data: UserAvatarData | null) => void
): (() => void) => {
  let entry = sharedUserAvatarListeners.get(userId);

  if (!entry) {
    entry = {
      data: null,
      lastUpdatedAt: 0,
      unsubscribe: null,
      subscribers: new Set()
    };
    sharedUserAvatarListeners.set(userId, entry);
  }

  entry.subscribers.add(callback);

  // Immediate cache hit prevents duplicate mount bursts from triggering extra reads.
  if (entry.data && Date.now() - entry.lastUpdatedAt < USER_AVATAR_CACHE_TTL_MS) {
    callback(entry.data);
  }

  if (!entry.unsubscribe) {
    // Exactly one Firestore listener per userId in this tab, regardless of component count.
    entry.unsubscribe = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      entry!.data = docSnap.exists()
        ? {
            avatar: (docSnap.data().avatar as string) || null,
            username: (docSnap.data().username as string) || null
          }
        : null;
      entry!.lastUpdatedAt = Date.now();
      entry!.subscribers.forEach((subscriber) => subscriber(entry!.data));
    });
  }

  return () => {
    const current = sharedUserAvatarListeners.get(userId);
    if (!current) return;
    current.subscribers.delete(callback);

    // Tear down listener only when the last consumer unmounts.
    if (current.subscribers.size === 0) {
      current.unsubscribe?.();
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

  // If the fallback avatar explicitly changes, and we haven't loaded the real one yet, try to adopt it.
  useEffect(() => {
      if (fallbackAvatar && !avatar) {
          setAvatar(fallbackAvatar);
      }
  }, [fallbackAvatar]);

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
