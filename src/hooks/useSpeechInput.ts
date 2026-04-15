import { useState, useEffect, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface UseSpeechInputOptions {
  onResult: (text: string) => void;
}

export function useSpeechInput({ onResult }: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  // Check availability on mount
  useEffect(() => {
    ExpoSpeechRecognitionModule.isRecognitionAvailable().then(setIsAvailable);
  }, []);

  // Listen for results
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript;
    if (transcript) {
      onResult(transcript);
    }
  });

  // Stop listening when recognition ends
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
  });

  const toggle = useCallback(async () => {
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
  }, [isListening]);

  return { isListening, isAvailable, toggle };
}
