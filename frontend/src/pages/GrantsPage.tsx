import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grant, GrantStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/CountdownTimer';
import { LimitsDiff } from '../components/LimitsDiff';
import { Key, ShieldAlert, Terminal, AlertTriangle, X, CheckCircle2, History } from 'lucide-react';

export const GrantsPage: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Revoke modal state
  const [revokingGrant, setRevokingGrant] = useState<Grant | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [isEmergency, setIsEmergency] = useState<boolean>(false);
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState<boolean>(false);

  const fetchGrants = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/grants');
      setGrants(data.grants || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, [user]);

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingGrant || !revokeReason.trim()) return;

    setIsSubmittingRevoke(true);
    try {
      await apiFetch(`/api/grants/${revokingGrant.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({
          reason: revokeReason,
          is_emergency: isEmergency,
        }),
      });
      setRevokingGrant(null);
      setRevokeReason('');
      setIsEmergency(false);
      await fetchGrants();
    } catch (err) {
      console.error('Revocation failed', err);
    } finally {
      setIsSubmittingRevoke(false);
    }
  };

  const filtered = grants.filter((g) => {
    const eff = g.effective_status || g.status;
    if (filterStatus === 'ALL') return true;
    return eff === filterStatus;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Active Governed Grants</h1>
          <p className="page-subtitle">
            Time-bounded access tokens derived strictly from approved review trails. Subject to immediate emergency revocation.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['ACTIVE', 'EXPIRED', 'REVOKED', 'ALL'].map((tab) => (
          <button
            key={tab}
            className={`btn btn-sm ${filterStatus === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>Loading governed grants...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Key size={36} color="#6366f1" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
            No Grants Found
          </h3>
          <p style={{ color: '#94a3b8' }}>
            No grants matching status "{filterStatus}". Submit and approve access requests to generate grants.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Resource & Tier</th>
                <th>Subject</th>
                <th>Time Remaining</th>
                <th>Granted Scope</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const eff = g.effective_status || g.status;
                const isRevoked = eff === 'REVOKED';

                return (
                  <tr key={g.id} id={`grant-row-${g.id}`}>
                    <td>
                      <div>
                        <strong style={{ color: '#fff' }}>{g.resource_name || g.resource_id}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                          ID: <span className="font-mono">{g.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: '#cbd5e1' }}>{g.subject_name || g.subject_id}</span>
                    </td>
                    <td>
                      <CountdownTimer expiresAt={g.expires_at} isRevoked={isRevoked} />
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        <div>Records: <strong>{g.granted_limits.max_records?.toLocaleString() || 'All'}</strong></div>
                        <div>RPS: <strong>{g.granted_limits.max_rps || 'Default'}</strong></div>
                      </div>
                    </td>
                    <td>
                      {isRevoked ? (
                        <span className="badge badge-revoked">
                          {g.is_emergency ? 'EMERGENCY REVOKED' : 'REVOKED'}
                        </span>
                      ) : eff === 'EXPIRED' ? (
                        <span className="badge badge-expired">EXPIRED</span>
                      ) : (
                        <span className="badge badge-active">ACTIVE</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/simulator?grant=${g.id}`)}
                          title="Test with PEP Simulator"
                          id={`btn-sim-${g.id}`}
                        >
                          <Terminal size={14} />
                          <span>Simulate</span>
                        </button>

                        {eff === 'ACTIVE' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setRevokingGrant(g)}
                            id={`btn-revoke-${g.id}`}
                          >
                            <ShieldAlert size={14} />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Revoke Modal */}
      {revokingGrant && (
        <div className="modal-overlay" onClick={() => setRevokingGrant(null)} id="revoke-modal">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(244, 63, 94, 0.2)', padding: '0.4rem', borderRadius: '8px', color: '#f43f5e' }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                    Revoke Governed Grant
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Grant ID: <span className="font-mono">{revokingGrant.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRevokingGrant(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRevokeSubmit}>
              {/* Emergency toggle */}
              <div
                style={{
                  background: isEmergency ? 'rgba(244, 63, 94, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                  border: isEmergency ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid var(--border-subtle)',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    id="emergency-revoke-checkbox"
                    style={{ width: '18px', height: '18px', accentColor: '#f43f5e' }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, color: isEmergency ? '#fda4af' : '#fff', fontSize: '0.9rem' }}>
                      Declare Emergency Revocation (Break-Glass Protocol)
                    </span>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      Immediately invalidates PEP cache, halts all inflight connections, and records an unalterable security audit event.
                    </p>
                  </div>
                </label>
              </div>

              {/* Justification input */}
              <div className="form-group">
                <label className="form-label" htmlFor="revoke-reason-input">
                  Revocation Justification <span style={{ color: '#f43f5e' }}>* (Required)</span>
                </label>
                <textarea
                  id="revoke-reason-input"
                  className="form-textarea"
                  rows={3}
                  placeholder="Detail the security or operational rationale for terminating access..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRevokingGrant(null)}
                  disabled={isSubmittingRevoke}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={isSubmittingRevoke || !revokeReason.trim()}
                  id="btn-confirm-revoke"
                >
                  {isSubmittingRevoke ? 'Revoking...' : isEmergency ? 'Execute Emergency Revocation' : 'Revoke Grant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
