import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface HintData {
  title: string;
  description?: string;
  value?: string | number;
  shortcut?: string;
}

interface HintContextType {
  hint: HintData | null;
  setHint: (hint: HintData | null) => void;
  bindHint: (title: string, description?: string, shortcut?: string, value?: string | number) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

const HintContext = createContext<HintContextType>({
  hint: null,
  setHint: () => {},
  bindHint: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
});

export function HintProvider({ children }: { children: ReactNode }) {
  const [hint, setHint] = useState<HintData | null>(null);

  const bindHint = useCallback((title: string, description?: string, shortcut?: string, value?: string | number) => {
    return {
      onMouseEnter: () => setHint({ title, description, shortcut, value }),
      onMouseLeave: () => setHint((prev) => (prev?.title === title ? null : prev)),
    };
  }, []);

  return (
    <HintContext.Provider value={{ hint, setHint, bindHint }}>
      {children}
    </HintContext.Provider>
  );
}

export function useHint() {
  return useContext(HintContext);
}
