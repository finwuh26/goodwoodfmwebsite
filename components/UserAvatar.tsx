import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { readFirestoreWithGuard } from '../utils/firestoreReadGuards';

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
  loadingPromise: Promise<void> | null;
  subscribers: Set<(data: UserAvatarData | null) => void>;
}

const USER_AVATAR_CACHE_TTL_MS = 10 * 60 * 1000;
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
      loadingPromise: null,
      subscribers: new Set()
    };
    sharedUserAvatarListeners.set(userId, entry);
  }

  entry.subscribers.add(callback);

  // Immediate cache hit prevents duplicate mount bursts from triggering extra reads.
  if (entry.data && entry.lastUpdatedAt > 0 && Date.now() - entry.lastUpdatedAt < USER_AVATAR_CACHE_TTL_MS) {
    callback(entry.data);
  }

  const shouldRefresh = !entry.data || Date.now() - entry.lastUpdatedAt >= USER_AVATAR_CACHE_TTL_MS;
  if (shouldRefresh && !entry.loadingPromise) {
    entry.loadingPromise = readFirestoreWithGuard(
      `userAvatar:${userId}`,
      () => getDoc(doc(db, 'users', userId)),
      { ttlMs: USER_AVATAR_CACHE_TTL_MS }
    ).then((docSnap) => {
      const data = docSnap.exists() ? docSnap.data() : null;
      entry!.data = docSnap.exists()
        ? {
            avatar: (data?.avatar as string) || null,
            username: (data?.username as string) || null
          }
        : null;
      entry!.lastUpdatedAt = Date.now();
      entry!.subscribers.forEach((subscriber) => subscriber(entry!.data));
    }).catch((err) => {
      console.warn(`Failed to read avatar for user ${userId}`, err);
    }).finally(() => {
      const current = sharedUserAvatarListeners.get(userId);
      if (!current) return;
      current.loadingPromise = null;
    });
  }

  return () => {
    const current = sharedUserAvatarListeners.get(userId);
    if (!current) return;
    current.subscribers.delete(callback);
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
