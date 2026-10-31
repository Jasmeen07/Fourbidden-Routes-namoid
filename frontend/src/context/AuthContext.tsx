import React, { createContext, useContext, useState, useEffect } from 'react';

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
  isLoading: boolean;
  activePersonaId: string;
  personas: Persona[];
  problem: ProblemDetail | null;
  clearProblem: () => void;
  switchPersona: (personaId: string) => Promise<void>;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('gg_token'));
  const [csrfToken, setCsrfToken] = useState<string | null>(localStorage.getItem('gg_csrf'));
  const [activePersonaId, setActivePersonaId] = useState<string>(localStorage.getItem('gg_persona') || 'alice');
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

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setProblem(errJson.detail || { code: 'AUTH_ERROR', message: 'Failed to switch persona' });
        return;
      }

      const data = await res.json();
      setToken(data.token);
      setCsrfToken(data.csrf_token);
      setUser(data.user);
      setActivePersonaId(personaId);
      localStorage.setItem('gg_token', data.token);
      localStorage.setItem('gg_csrf', data.csrf_token);
      localStorage.setItem('gg_persona', personaId);
    } catch (err: any) {
      setProblem({ code: 'NETWORK_ERROR', message: err.message || 'Network error connecting to backend' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
      const prob: ProblemDetail = typeof errBody === 'object' 
        ? (errBody.detail || errBody)
        : { code: `HTTP_${res.status}`, message: String(errBody) };

      setProblem(prob);
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
        isLoading,
        activePersonaId,
        personas: PERSONAS,
        problem,
        clearProblem,
        switchPersona,
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
