import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, HostedAuthButton, NamoIDSignIn, useAuthConfig } from '@namoidhq/react';
import type { CompletedHostedAuth } from '@namoidhq/react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, CheckCircle2, ArrowRight, AlertTriangle, ExternalLink } from 'lucide-react';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { setNamoIDAuth, user, isNamoIDAuthenticated, logout } = useAuth();
  const { config, loading: configLoading } = useAuthConfig();
  const redirectUri = `${window.location.origin}/auth/callback`;

  const handleSignInComplete = async (result: CompletedHostedAuth) => {
    // 6. Validate the authentication response
    if (!result || !result.tokens?.access_token) {
      console.error('Validation failed: Missing access token');
      return;
    }
    // 7. Store in memory via AuthContext
    await setNamoIDAuth(result);
    navigate('/catalog', { replace: true });
  };

  const handleSignInError = (error: Error) => {
    console.error('NamoID sign-in error:', error);
  };

  const isClosedMode = config?.access_mode === 'closed';

  return (
    <div style={{ maxWidth: 540, margin: '3.5rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2.25rem', boxShadow: 'var(--shadow-md)' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, #c2410c 0%, #b45309 100%)',
            color: '#ffffff',
            boxShadow: 'var(--shadow-glow)',
            marginBottom: '1rem',
          }}>
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            GrantGate
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
            Autonomous Access Governance with NamoID
          </p>
        </div>

        {/* Closed Access Mode Warning & Resolution Guidance */}
        {isClosedMode && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.15rem',
            marginBottom: '1.5rem',
            fontSize: '0.835rem',
            color: '#92400e',
            lineHeight: 1.55,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.45rem', color: '#b45309' }}>
              <AlertTriangle size={17} color="#d97706" />
              <span>NamoID Console Setting: Access Mode is "Closed"</span>
            </div>
            <p style={{ marginBottom: '0.65rem' }}>
              Your NamoID project sandbox (<code>{config?.issuer?.replace('https://', '')}</code>) is currently rejecting sign-ins with <strong>HTTP 403 Forbidden</strong> because its Access Mode is set to Closed.
            </p>
            <div style={{ background: '#fef3c7', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.65rem' }}>
              <p style={{ fontWeight: 650, marginBottom: '0.35rem', color: '#78350f' }}>To enable sign-ins in your NamoID Console:</p>
              <ol style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
                <li>Log in to <a href="https://console.namoid.in" target="_blank" rel="noreferrer" style={{ color: '#b45309', fontWeight: 700, textDecoration: 'underline' }}>console.namoid.in <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a></li>
                <li>Go to <strong>Project Settings &rarr; Access Policy</strong> and switch from <strong>Closed</strong> to <strong>Open</strong> (or Invite-Only).</li>
                <li>Under <strong>Allowed Redirect URIs</strong>, add: <code className="font-mono" style={{ background: '#ffffff', padding: '0.1rem 0.35rem', borderRadius: 4 }}>{redirectUri}</code></li>
              </ol>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary"
                style={{ fontSize: '0.785rem', padding: '0.3rem 0.65rem' }}
              >
                Continue in Dev Persona Mode &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Status if already signed in */}
        {isNamoIDAuthenticated && user ? (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.75rem',
            textAlign: 'center',
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#047857', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
              <CheckCircle2 size={18} />
              <span>Signed In via NamoID</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#065f46', marginBottom: '1rem' }}>
              Authenticated as <strong>{user.display_name}</strong> ({user.sub})
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem' }}
              >
                Go to Dashboard <ArrowRight size={14} style={{ marginLeft: '0.3rem' }} />
              </button>
              <button
                onClick={() => logout()}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Primary Official Quickstart Component from NamoID Console */}
            <div style={{ marginBottom: '1.75rem' }}>
              <SignIn
                redirectUri={redirectUri}
                title="Sign In with NamoID"
                description="Continue with the verified sign-in methods configured in your NamoID tenant."
                buttonLabel="Sign In with NamoID"
              />
            </div>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: '1.5rem 0',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span>OR EMBEDDED CEREMONY</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>

            {/* Official NamoIDSignIn drop-in component */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}>
              <NamoIDSignIn
                redirectUri={redirectUri}
                onComplete={handleSignInComplete}
                onError={handleSignInError}
                title="Direct Verification"
                description="Sign in securely with one of your NamoID configured methods."
                buttonLabel="Launch NamoID Auth"
                appearance={{
                  theme: 'light',
                  accent: '#c2410c',
                  radius: 8,
                }}
              />
            </div>
          </>
        )}

        {/* Security & Memory Isolation Guarantee */}
        <div style={{
          marginTop: '1.75rem',
          padding: '0.85rem',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}>
          <Shield size={16} color="#c2410c" style={{ flexShrink: 0 }} />
          <span>
            <strong>Token Isolation:</strong> All NamoID tokens are kept strictly in React volatile memory, never in localStorage.
          </span>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
