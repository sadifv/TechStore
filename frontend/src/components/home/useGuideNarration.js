import { useCallback, useEffect, useRef, useState } from 'react';

export default function useGuideNarration() {
  const supported = typeof window.Audio === 'function';
  const audioRef = useRef(null);
  const finishRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
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
    finishRef.current = null;
    setSpeaking(false);
    setPaused(false);
    setError('');
  }, [releaseAudio]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !speaking) return;
    audio.pause();
    setSpeaking(false);
    setPaused(true);
  }, [speaking]);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !paused) return;
    setPaused(false);
    setSpeaking(true);
    audio.play().catch(() => finishRef.current?.(true));
  }, [paused]);

  useEffect(() => releaseAudio, [releaseAudio]);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [stop]);

  function listen(startStep, onStepChange) {
    stop();
    if (!supported) return;
    try {
      const audio = new window.Audio();
      audio.preload = 'none';
      audioRef.current = audio;
      let step = startStep;
      const finish = (failed) => {
        if (audioRef.current !== audio) return;
        releaseAudio();
        finishRef.current = null;
        setSpeaking(false);
        setPaused(false);
        if (failed) setError('No se pudo reproducir la narración. Puedes leer el recorrido.');
      };
      finishRef.current = finish;
      const playStep = () => {
        if (audioRef.current !== audio) return;
        onStepChange(step);
        audio.src = `/audio/como-comprar/paso-${step + 1}.mp3`;
        audio.onended = () => {
          if (step === 4) {
            finish(false);
            return;
          }
          step += 1;
          playStep();
        };
        audio.play().catch(() => finish(true));
      };
      audio.onerror = () => finish(true);
      setPaused(false);
      setSpeaking(true);
      playStep();
    } catch {
      stop();
      setError('No se pudo reproducir la narración. Puedes leer el recorrido.');
    }
  }

  return { supported, speaking, paused, error, listen, pause, resume, stop };
}
