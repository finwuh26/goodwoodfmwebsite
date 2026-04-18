import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface UserAvatarProps {
  userId: string;
  fallbackAvatar?: string;
  fallbackName?: string;
  className?: string;
}

export const UserAvatar = ({ userId, fallbackAvatar, fallbackName, className }: UserAvatarProps) => {
  const [avatar, setAvatar] = useState<string | null>(fallbackAvatar || null);
  const [name, setName] = useState<string | null>(fallbackName || null);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.avatar && data.avatar !== '') {
            setAvatar(data.avatar);
        } else {
            setAvatar(null); // They cleared their avatar
        }
        if (data.username) setName(data.username);
      } else {
          setAvatar(fallbackAvatar || null);
      }
    });

    return () => unsub();
  }, [userId, fallbackAvatar]);

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
