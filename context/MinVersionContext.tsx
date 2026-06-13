import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkMinVersion } from '../lib/min-version';

type MinVersionContextValue = {
  mustUpdate: boolean;
  message?: string;
  recommendedVersion?: string;
  /** True once the edge-function call has settled (success or fail-open). */
  checked: boolean;
};

const DEFAULT_STATE: MinVersionContextValue = {
  mustUpdate: false,
  checked: false,
};

const MinVersionContext = createContext<MinVersionContextValue>(DEFAULT_STATE);

export function MinVersionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MinVersionContextValue>(DEFAULT_STATE);

useEffect(() => {
    let alive = true;
    checkMinVersion().then((r) => {
      if (!alive) return;
      setState({
        mustUpdate: r.mustUpdate,
        message: r.message,
        recommendedVersion: r.recommendedVersion,
        checked: true,
      });
    });
    return () => { alive = false; };
  }, []);

  return (
    <MinVersionContext.Provider value={state}>
      {children}
    </MinVersionContext.Provider>
  );
}

export function useMinVersion(): MinVersionContextValue {
  return useContext(MinVersionContext);
}