import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNamoID, completeHostedAuthRedirect } from '@namoidhq/react';
import type { CompletedHostedAuth } from '@namoidhq/react';
import { useAuth } from '../context/AuthContext';
import { Shield, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const client = useNamoID();
  const navigate = useNavigate();
  const location = useLocation();
  const { setNamoIDAuth } = useAuth();

  const [status, setStatus] = useState<string>('Validating authorization response with NamoID...');
  const [error, setError] = useState<string | null>(null);
  const [validatedData, setValidatedData] = useState<CompletedHostedAuth | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    // Avoid double execution in React StrictMode
    if (processedRef.current) return;
    processedRef.current = true;

    async function handleCallback() {
      try {
        setStatus('Completing hosted authentication redirect ceremony...');
        
        // 5. Implement completeHostedAuthRedirect with official SDK
        const result: CompletedHostedAuth = await completeHostedAuthRedirect(
          client,
          window.location.href
        );

        // 6. Validate the authentication response
        if (!result) {
          throw new Error('Authentication failed: Received empty response from NamoID');
        }

        if (!result.tokens || !result.tokens.access_token) {
          throw new Error('Validation failed: Missing access_token in token response');
        }

        if (!result.identity || !result.identity.sub) {
          throw new Error('Validation failed: Missing user identity subject (sub)');
        }

        if (!result.idTokenClaims || !result.idTokenClaims.iss || !result.idTokenClaims.aud) {
          throw new Error('Validation failed: Missing required ID token claims (iss or aud)');
        }

        // Validate subject consistency
        if (result.identity.sub !== result.idTokenClaims.sub) {
          throw new Error('Security violation: ID token subject does not match userinfo identity');
        }

        setStatus('Authentication verified successfully! Storing session in memory...');
        setValidatedData(result);

        // 7. Store tokens strictly in memory (via AuthContext state)
        await setNamoIDAuth(result);

        // Small delay so user sees confirmation, then transition to dashboard
        setTimeout(() => {
          navigate('/catalog', { replace: true });
        }, 800);
      } catch (err: any) {
        console.error('NamoID Callback Error:', err);
        setError(err.message || 'An error occurred during authentication validation.');
      }
    }

    handleCallback();
  }, [client, location, navigate, setNamoIDAuth]);

  return (
    <div style={{ maxWidth: 540, margin: '4rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '0.85rem', background: '#fef3c7', borderRadius: '50%', marginBottom: '1.25rem' }}>
          {error ? (
            <AlertTriangle size={32} color="#dc2626" />
          ) : validatedData ? (
            <CheckCircle2 size={32} color="#15803d" />
          ) : (
            <Shield size={32} color="#c2410c" />
          )}
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          {error ? 'Authentication Failed' : validatedData ? 'Verification Successful' : 'Processing NamoID Auth'}
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {error ? error : status}
        </p>

        {validatedData && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
            fontSize: '0.825rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subject (sub):</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>{validatedData.identity.sub}</span>
            </div>
            {validatedData.identity.name && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Name:</span>
                <span style={{ fontWeight: 600 }}>{validatedData.identity.name}</span>
              </div>
            )}
            {validatedData.identity.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                <span style={{ fontWeight: 600 }}>{validatedData.identity.email}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Storage Isolation:</span>
              <span style={{ color: '#15803d', fontWeight: 600 }}>Strict In-Memory</span>
            </div>
          </div>
        )}

        {error ? (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary"
            >
              Return to Sign In
            </button>
            <button
              onClick={() => navigate('/catalog')}
              className="btn btn-secondary"
            >
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>Redirecting to Governance Catalog</span>
            <ArrowRight size={14} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
