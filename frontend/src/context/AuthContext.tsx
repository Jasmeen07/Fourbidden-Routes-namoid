import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CompletedHostedAuth } from '@namoidhq/react';
import { handleMockApi } from './mockDataStore';

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
  roles?: string[];
  badgeClass: string;
  description: string;
}

export const PERSONAS: Persona[] = [
  { id: 'priya', name: 'Priya Sharma', role: 'REQUESTOR', roles: ['requester', 'ML_ENGINEER'], badgeClass: 'role-chip-eng', description: 'Lead Data Scientist (Requester)' },
  { id: 'alice', name: 'Alice Chen', role: 'ML_ENGINEER', roles: ['requester', 'ML_ENGINEER'], badgeClass: 'role-chip-eng', description: 'ML Engineer (Requester)' },
  { id: 'bob', name: 'Bob Smith', role: 'ML_ENGINEER', roles: ['requester', 'risk_reviewer', 'ML_ENGINEER'], badgeClass: 'role-chip-eng', description: 'ML Engineer (Peer Reviewer)' },
  { id: 'carol', name: 'Carol Danvers', role: 'DATA_GOVERNANCE', roles: ['manager', 'DATA_GOVERNANCE'], badgeClass: 'role-chip-gov', description: 'Data Governance (Manager Reviewer)' },
  { id: 'david', name: 'David Miller', role: 'SECURITY_ADMIN', roles: ['resource_owner', 'SECURITY_ADMIN'], badgeClass: 'role-chip-sec', description: 'Security Admin (Resource Owner)' },
  { id: 'elena', name: 'Elena Rostova', role: 'COMPLIANCE', roles: ['risk_reviewer', 'COMPLIANCE'], badgeClass: 'role-chip-comp', description: 'Compliance Officer (Risk Reviewer)' },
  { id: 'fiona', name: 'Fiona Gallagher', role: 'EXECUTIVE', roles: ['admin', 'executive', 'risk_reviewer', 'EXECUTIVE'], badgeClass: 'role-chip-exec', description: 'Executive / CISO (Admin & Reviewer)' },
  { id: 'unassigned_user', name: 'Guest User', role: 'NONE', roles: [], badgeClass: 'role-chip-eng', description: 'Unassigned User (Zero Roles)' },
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
    const roles = p.roles || [p.role];
    setUser({
      sub: p.id,
      display_name: p.name,
      roles: roles,
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
      const accessToken = auth.tokens?.access_token || '';
      const idToken = auth.tokens?.id_token || (auth.tokens as any)?.idToken || '';
      setToken(accessToken);

      const sub = auth.identity.sub || auth.idTokenClaims?.sub || 'usr_namoid_demo';
      const displayName = auth.identity.name || auth.identity.email || sub;
      const email = auth.identity.email;

      // Intelligent role inference from claims, email, and sub
      const inferRoles = (): string[] => {
        const rawClaims = (auth.idTokenClaims as any) || {};
        const claimRoles = rawClaims.roles || rawClaims.role || rawClaims.groups;
        if (Array.isArray(claimRoles) && claimRoles.length > 0) {
          return claimRoles.map(String);
        }
        if (typeof claimRoles === 'string' && claimRoles) {
          return [claimRoles];
        }
        const identStr = `${sub} ${email || ''}`.toLowerCase();
        if (identStr.includes('admin') || identStr.includes('ciso') || identStr.includes('fiona') || identStr.includes('ceo')) {
          return ['admin', 'executive', 'risk_reviewer', 'requester'];
        }
        if (identStr.includes('mgr') || identStr.includes('manager') || identStr.includes('carol') || identStr.includes('e050')) {
          return ['manager', 'DATA_GOVERNANCE', 'requester'];
        }
        if (identStr.includes('owner') || identStr.includes('david') || identStr.includes('sec')) {
          return ['resource_owner', 'SECURITY_ADMIN', 'requester'];
        }
        if (identStr.includes('risk') || identStr.includes('compliance') || identStr.includes('elena')) {
          return ['risk_reviewer', 'COMPLIANCE', 'requester'];
        }
        // Standard interactive demo NamoID user: grant full multi-party & admin roles so user can explore Enterprise Architecture, requests, approvals, and grants
        return ['admin', 'executive', 'manager', 'risk_reviewer', 'resource_owner', 'requester', 'ML_ENGINEER'];
      };

      // Authenticate with backend session via real token validation endpoint
      try {
        const res = await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_token: idToken,
            access_token: accessToken,
            nonce: (auth.idTokenClaims as any)?.nonce || '',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
          setCsrfToken(data.csrf_token);
          setUser(data.user);
          return;
        } else {
          // Check if session already established with bearer token
          const meRes = await fetch('/api/me', {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            setUser({
              sub: meData.sub,
              display_name: meData.display_name,
              email: meData.email,
              roles: meData.roles || inferRoles(),
              active: meData.active,
            });
            setCsrfToken(meData.csrf_token);
            return;
          }
        }
      } catch {
        // Backend offline / GitHub Pages fallback
      }

      // Standalone / Offline fallback
      const assignedRoles = inferRoles();
      setUser({
        sub,
        display_name: displayName,
        email,
        roles: assignedRoles,
        active: true,
      });
      setToken(`namoid-session-${sub}`);
      setCsrfToken('namoid-csrf');
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

    const bootstrapAuth = async () => {
      setIsLoading(true);
      try {
        // 1. Check if backend already has an active session cookie (e.g. from NamoID login or prior session)
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const data = await meRes.json();
          setUser({
            sub: data.sub,
            display_name: data.display_name,
            email: data.email,
            roles: data.roles || [],
            active: data.active,
          });
          setCsrfToken(data.csrf_token);
          // If the sub corresponds to a persona, align activePersonaId
          const matchingPersona = PERSONAS.find((p) => p.id === data.sub);
          if (matchingPersona) {
            setActivePersonaId(matchingPersona.id);
            localStorage.setItem('gg_persona', matchingPersona.id);
          }
          setIsLoading(false);
          return;
        }
      } catch {
        // Fall back to persona switch
      }

      // 2. If no active cookie session exists, initialize default demo persona
      await switchPersona(activePersonaId);
    };

    bootstrapAuth();
  }, []);

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    let currentToken = token;
    let currentCsrf = csrfToken;

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET');

    // If this is a mutation and we don't have csrfToken in state yet, fetch /api/me to retrieve session's csrf_token
    if (isMutation && !currentCsrf) {
      try {
        const meRes = await fetch('/api/me', {
          headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.csrf_token) {
            currentCsrf = meData.csrf_token;
            setCsrfToken(currentCsrf);
          }
        }
      } catch {
        // Continue
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    if (currentCsrf && isMutation) {
      headers['X-CSRF-Token'] = currentCsrf;
    }

    let res: Response | null = null;
    let networkFailed = false;

    try {
      res = await fetch(path, {
        ...options,
        headers,
      });
    } catch {
      networkFailed = true;
    }

    const isHtmlOrNotFound = !res || res.status === 404 || res.status === 405 || (res.headers.get('content-type')?.includes('text/html') ?? false);

    if (!res || networkFailed || (isHtmlOrNotFound && path.startsWith('/api/'))) {
      return handleMockApi(path, options, user);
    }

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

      // If failed with CSRF_TOKEN_INVALID, attempt a one-time fresh token sync from /api/me and retry
      if (isMutation && (prob.code === 'CSRF_TOKEN_INVALID' || prob.message?.includes('X-CSRF-Token'))) {
        try {
          const meRes = await fetch('/api/me', {
            headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.csrf_token && meData.csrf_token !== currentCsrf) {
              setCsrfToken(meData.csrf_token);
              headers['X-CSRF-Token'] = meData.csrf_token;
              const retryRes = await fetch(path, { ...options, headers });
              if (retryRes.ok) {
                const retryJson = retryRes.headers.get('content-type')?.includes('json');
                return retryJson ? await retryRes.json() : null;
              }
            }
          }
        } catch {
          // Fall through to error handler
        }
      }

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
