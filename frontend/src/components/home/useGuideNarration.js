import { useCallback, useEffect, useRef, useState } from 'react';

export default function useGuideNarration() {
  const supported = typeof window.Audio === 'function';
  const audioRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audioRef.current = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }, []);

  const stop = useCallback(() => {
    releaseAudio();
    setSpeaking(false);
  }, [releaseAudio]);

  useEffect(() => releaseAudio, [releaseAudio]);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [stop]);

  function listen(source) {
    stop();
    setError('');
    if (!supported) return;
    try {
      const audio = new window.Audio();
      audio.preload = 'none';
      audio.src = source;
      audioRef.current = audio;
      const finish = (failed) => {
        if (audioRef.current !== audio) return;
        releaseAudio();
        setSpeaking(false);
        if (failed) setError('No se pudo reproducir el audio. Puedes reintentarlo o leer el paso.');
      };
      audio.onended = () => finish(false);
      audio.onerror = () => finish(true);
      setSpeaking(true);
      audio.play().catch(() => finish(true));
    } catch {
      stop();
      setError('No se pudo reproducir el audio. Puedes reintentarlo o leer el paso.');
    }
  }

  return { supported, speaking, error, listen, stop };
}
