import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { setApiAuthToken } from "../api/client";
import {
  disconnectRealtime,
  setRealtimeAuthToken,
} from "../realtime/socket";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [currentUser, setCurrentUserState] = useState(null);
  const [authToken, setAuthTokenState] = useState("");

  const setCurrentUser = useCallback((user) => {
    setCurrentUserState(user || null);
  }, []);

  const setSession = useCallback((session) => {
    const nextToken = String(session?.token || "").trim();
    setCurrentUserState(session?.user || null);
    setAuthTokenState(nextToken);
    setApiAuthToken(nextToken);
    setRealtimeAuthToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    setCurrentUserState(null);
    setAuthTokenState("");
    setApiAuthToken("");
    disconnectRealtime();
    setRealtimeAuthToken("");
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      authToken,
      setCurrentUser,
      setSession,
      logout,
    }),
    [authToken, currentUser, logout, setCurrentUser, setSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
