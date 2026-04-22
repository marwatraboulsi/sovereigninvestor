import { createContext, useContext, useState, ReactNode } from 'react';

interface GuestContextType {
  isGuest: boolean;
  setIsGuest: (v: boolean) => void;
}

const GuestContext = createContext<GuestContextType>({
  isGuest: false,
  setIsGuest: () => {},
});

export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  return (
    <GuestContext.Provider value={{ isGuest, setIsGuest }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}
