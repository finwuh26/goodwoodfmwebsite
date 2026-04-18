import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface RadioData {
  station: {
    listen_url: string;
  };
  listeners: {
    total: number;
  };
  live: {
    is_live: boolean;
    streamer_name: string;
  };
  now_playing: {
    song: {
      title: string;
      artist: string;
      art: string;
    };
    elapsed: number;
    duration: number;
    remaining: number;
  };
  playing_next?: {
    song: {
      title: string;
      artist: string;
      art: string;
    };
  };
  song_history?: {
    sh_id: number;
    song: {
      title: string;
      artist: string;
      art: string;
    };
  }[];
}

interface RadioContextType {
  radioData: RadioData | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

const RadioContext = createContext<RadioContextType | undefined>(undefined);

export const RadioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [radioData, setRadioData] = useState<RadioData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const lastFmCacheRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchLastFmAlbumArt = async (artist?: string, track?: string) => {
      if (!artist || !track) return null;

      const cacheKey = `${artist}::${track}`.toLowerCase();
      if (cacheKey in lastFmCacheRef.current) {
        return lastFmCacheRef.current[cacheKey];
      }

      try {
        const response = await fetch(`/api/lastfm/art?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
        if (!response.ok) {
          lastFmCacheRef.current[cacheKey] = null;
          return null;
        }

        const data = await response.json();
        const art = typeof data?.art === 'string' && data.art.trim() ? data.art : null;
        lastFmCacheRef.current[cacheKey] = art;
        return art;
      } catch {
        lastFmCacheRef.current[cacheKey] = null;
        return null;
      }
    };

    const fetchRadioData = async () => {
      try {
        const response = await fetch('/api/azuracast/nowplaying');
        const data = await response.json();

        const currentSong = data?.now_playing?.song;
        const hasPlaceholderArt =
          !currentSong?.art ||
          currentSong.art.includes('/static/img/albumart') ||
          currentSong.art.includes('/static/uploads/art');

        if (currentSong && hasPlaceholderArt) {
          const fallbackArt = await fetchLastFmAlbumArt(currentSong.artist, currentSong.title);
          if (fallbackArt) {
            data.now_playing.song.art = fallbackArt;
          }
        }
        
        if (data && data.now_playing) {
           setRadioData(data);
        }

        const remaining = data?.now_playing?.remaining || 10;
        const nextFetchDelay = Math.min(Math.max(1000, (remaining * 1000) + 500), 15000);
        
        timeoutId = setTimeout(fetchRadioData, nextFetchDelay);
      } catch (error) {
        console.error("Failed to fetch radio data:", error);
        timeoutId = setTimeout(fetchRadioData, 5000);
      }
    };

    fetchRadioData();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <RadioContext.Provider value={{ radioData, isPlaying, setIsPlaying, volume, setVolume }}>
      {children}
    </RadioContext.Provider>
  );
};

export const useRadio = () => {
  const context = useContext(RadioContext);
  if (context === undefined) {
    throw new Error('useRadio must be used within a RadioProvider');
  }
  return context;
};
