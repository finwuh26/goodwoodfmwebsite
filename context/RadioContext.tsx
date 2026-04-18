import React, { createContext, useContext, useState, useEffect } from 'react';

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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchRadioData = async () => {
      try {
        const response = await fetch('/api/azuracast/nowplaying');
        const data = await response.json();
        
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
