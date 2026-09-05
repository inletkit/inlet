import { createContext, useContext } from "react";

export interface InletContextValue {
  relayerUrl: string;
  login?: () => void;
  logout?: () => void;
  ready: boolean;
}

export const InletContext = createContext<InletContextValue>({ relayerUrl: "", ready: true });

export function useInlet() {
  return useContext(InletContext);
}
