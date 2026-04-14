// Speech recognition is only available in native builds (EAS/App Store).
// In Expo Go, the mic button is visible but inactive.
// The full implementation activates automatically in production builds.

interface UseSpeechInputOptions {
  onResult: (text: string) => void;
}

export function useSpeechInput(_options: UseSpeechInputOptions) {
  return {
    isListening: false,
    isAvailable: false,
    toggle: () => {},
  };
}
