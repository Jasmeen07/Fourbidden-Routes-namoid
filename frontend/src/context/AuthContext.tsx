import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CompletedHostedAuth } from '@namoidhq/react';

export interface UserInfo {
  sub: string;
  display_name: string;
  email?: string;
  roles: string[];
  active: boolean;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  violations?: string[];
  [key: string]: any;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  badgeClass: string;
  description: string;
}

export const PERSONAS: Persona[] = [
  { id: 'priya', name: 'Priya Sharma', role: 'REQUESTOR', badgeClass: 'role-chip-eng', description: 'Lead Data Scientist (Requestor)' },
  { id: 'alice', name: 'Alice Chen', role: 'ML_ENGINEER', badgeClass: 'role-chip-eng', description: 'ML Engineer (Requester)' },
  { id: 'bob', name: 'Bob Smith', role: 'ML_ENGINEER', badgeClass: 'role-chip-eng', description: 'ML Engineer (Peer Requester)' },
  { id: 'carol', name: 'Carol Danvers', role: 'DATA_GOVERNANCE', badgeClass: 'role-chip-gov', description: 'Data Governance (Reviewer)' },
  { id: 'david', name: 'David Miller', role: 'SECURITY_ADMIN', badgeClass: 'role-chip-sec', description: 'Security Admin (Reviewer & Revoker)' },
  { id: 'elena', name: 'Elena Rostova', role: 'COMPLIANCE', badgeClass: 'role-chip-comp', description: 'Compliance Officer (Reviewer & Auditor)' },
  { id: 'fiona', name: 'Fiona Gallagher', role: 'EXECUTIVE', badgeClass: 'role-chip-exec', description: 'Executive / CISO (High Tier Reviewer)' },
  { id: 'unassigned_user', name: 'Guest User', role: 'NONE', badgeClass: 'role-chip-eng', description: 'Unassigned User (Zero Roles)' },
];

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  csrfToken: string | null;
  namoIDAuth: CompletedHostedAuth | null;
  isNamoIDAuthenticated: boolean;
  isLoading: boolean;
  activePersonaId: string;
  personas: Persona[];
  problem: ProblemDetail | null;
  clearProblem: () => void;
  switchPersona: (personaId: string) => Promise<void>;
  setNamoIDAuth: (auth: CompletedHostedAuth) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  // In-memory token management: Tokens are strictly held in React state memory, NEVER in localStorage
  const [token, setToken] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [namoIDAuth, setNamoIDAuthState] = useState<CompletedHostedAuth | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string>(
    localStorage.getItem('gg_persona') || 'priya'
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [problem, setProblem] = useState<ProblemDetail | null>(null);

  const clearProblem = () => setProblem(null);

  const switchPersona = async (personaId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: personaId }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setCsrfToken(data.csrf_token);
        setUser(data.user);
        setActivePersonaId(personaId);
        setNamoIDAuthState(null);
        localStorage.setItem('gg_persona', personaId);
        setIsLoading(false);
        return;
      }
    } catch {
      // Backend not running, use standalone mock mode
    }

    // Standalone fallback:
    const p = PERSONAS.find((x) => x.id === personaId) || PERSONAS[0];
    setUser({
      sub: p.id,
      display_name: p.name,
      roles: [p.role],
      active: true,
    });
    setActivePersonaId(personaId);
    setToken(`mock-token-${personaId}`);
    setCsrfToken('mock-csrf');
    setNamoIDAuthState(null);
    localStorage.setItem('gg_persona', personaId);
    setIsLoading(false);
  };

  const setNamoIDAuth = async (auth: CompletedHostedAuth) => {
    setIsLoading(true);
    try {
      // Keep OIDC tokens strictly in React memory
      setNamoIDAuthState(auth);
      setToken(auth.tokens.access_token);

      const sub = auth.identity.sub || auth.idTokenClaims.sub;
      const displayName = auth.identity.name || auth.identity.email || sub;
      const email = auth.identity.email;

      // Sync with backend session in memory
      try {
        const res = await fetch('/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: sub,
            display_name: displayName,
            email: email,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
          setCsrfToken(data.csrf_token);
          setUser(data.user);
        } else {
          setUser({
            sub,
            display_name: displayName,
            email,
            roles: ['requester', 'ML_ENGINEER'],
            active: true,
          });
        }
      } catch {
        setUser({
          sub,
          display_name: displayName,
          email,
          roles: ['requester', 'ML_ENGINEER'],
          active: true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    // Wipe all tokens and session state from memory
    setToken(null);
    setCsrfToken(null);
    setUser(null);
    setNamoIDAuthState(null);
    // Defense-in-depth: Ensure localStorage has no tokens
    localStorage.removeItem('gg_token');
    localStorage.removeItem('gg_csrf');
  };

  useEffect(() => {
    // Defense-in-depth: scrub any stale legacy tokens from localStorage
    localStorage.removeItem('gg_token');
    localStorage.removeItem('gg_csrf');

    // Initialize initial session in memory
    switchPersona(activePersonaId);
  }, []);

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET')) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const res = await fetch(path, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const isJson = res.headers.get('content-type')?.includes('json');
      const errBody = isJson ? await res.json().catch(() => ({})) : await res.text();
      let prob: ProblemDetail;
      if (typeof errBody === 'object' && errBody !== null) {
        if (typeof errBody.detail === 'string') {
          prob = { code: errBody.code || `HTTP_${res.status}`, message: errBody.detail };
        } else if (typeof errBody.detail === 'object') {
          prob = errBody.detail;
        } else {
          prob = errBody;
        }
      } else {
        prob = { code: `HTTP_${res.status}`, message: String(errBody) };
      }

      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET');
      if (isMutation || [403, 409, 422].includes(res.status)) {
        setProblem(prob);
      }
      throw prob;
    }

    const isJson = res.headers.get('content-type')?.includes('json');
    return isJson ? await res.json() : null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        csrfToken,
        namoIDAuth,
        isNamoIDAuthenticated: Boolean(namoIDAuth),
        isLoading,
        activePersonaId,
        personas: PERSONAS,
        problem,
        clearProblem,
        switchPersona,
        setNamoIDAuth,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
