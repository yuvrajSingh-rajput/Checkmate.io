import { useCallback, useRef } from 'react';

// Sound URLs from lichess (free and open source)
const SOUNDS = {
  move: '/audio/Move.mp3',
  capture: '/audio/Capture.mp3',
  check: '/audio/Check.mp3',
} as const;

type SoundType = keyof typeof SOUNDS;

export function useChessSounds() {
  const audioCache = useRef<Map<SoundType, HTMLAudioElement>>(new Map());

  const playSound = useCallback((type: SoundType = 'move') => {
    try {
      // Get or create audio element
      let audio = audioCache.current.get(type);
      
      if (!audio) {
        audio = new Audio(SOUNDS[type]);
        audio.volume = 0.5;
        audioCache.current.set(type, audio);
      }
      
      // Reset and play
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay errors - browser may block until user interaction
      });
    } catch {
      // Silently fail if audio is not supported
    }
  }, []);

  const playSoundForMove = useCallback((san: string) => {
    if (san.includes('+') || san.includes('#')) {
      playSound('check');
    } else if (san.includes('x')) {
      playSound('capture');
    } else {
      playSound('move');
    }
  }, [playSound]);

  return { playSound, playSoundForMove };
}