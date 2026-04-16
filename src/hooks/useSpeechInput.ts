import { useState, useEffect, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface UseSpeechInputOptions {
  onResult: (text: string) => void;
}

export function useSpeechInput({ onResult }: UseSpeechInputOptions) {
  const [isListening, setIsListening]   = useState(false);
  const [isAvailable, setIsAvailable]   = useState(false);

  useEffect(() => {
    ExpoSpeechRecognitionModule.isRecognitionAvailable()
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false));
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    try {
      const transcript = event.results?.[0]?.transcript;
      if (transcript) onResult(transcript);
    } catch {}
  });

  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('error', () => setIsListening(false));

  const toggle = useCallback(async () => {
    try {
      if (isListening) {
        ExpoSpeechRecognitionModule.stop();
        setIsListening(false);
      } else {
        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) return;
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: false,
          maxAlternatives: 1,
          continuous: false,
        });
        setIsListening(true);
      }
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, isAvailable, toggle };
}
