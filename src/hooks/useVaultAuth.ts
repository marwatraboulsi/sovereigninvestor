import { useState, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export type AuthState = 'locked' | 'unlocked' | 'unavailable';

export function useVaultAuth() {
  const [authState, setAuthState] = useState<AuthState>('locked');

  const authenticate = useCallback(async () => {
    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hardware || !enrolled) {
        // No biometrics available - grant access anyway (device has no biometrics)
        setAuthState('unlocked');
        return;
      }

      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFaceID = supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      );

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock The Vault',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
        ...(hasFaceID ? {} : { promptMessage: 'Use your fingerprint or passcode to unlock' }),
      });

      if (result.success) {
        setAuthState('unlocked');
      }
    } catch {
      // Fail silently - user can retry
    }
  }, []);

  const lock = useCallback(() => {
    setAuthState('locked');
  }, []);

  return { authState, authenticate, lock };
}
