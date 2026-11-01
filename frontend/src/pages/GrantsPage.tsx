import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grant, GrantStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/CountdownTimer';
import { LimitsDiff } from '../components/LimitsDiff';
import {
  Key,
  ShieldAlert,
  Terminal,
  AlertTriangle,
  X,
  CheckCircle2,
  History,
  Activity,
  CheckCheck,
  Clock,
  Zap,
  LogOut,
  Flame,
  ShieldCheck,
  ArrowRight,
  Plus,
} from 'lucide-react';

export const GrantsPage: React.FC = () => {
  const { apiFetch, user, activePersonaId } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [filterScope, setFilterScope] = useState<'all' | 'mine'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Revoke modal state
  const [revokingGrant, setRevokingGrant] = useState<Grant | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [isEmergency, setIsEmergency] = useState<boolean>(false);
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState<boolean>(false);

  // Innovation 5: Early Release modal state
  const [releasingGrant, setReleasingGrant] = useState<Grant | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string>('Project task completed ahead of schedule.');
  const [isSubmittingRelease, setIsSubmittingRelease] = useState<boolean>(false);
  const [releaseSuccessMsg, setReleaseSuccessMsg] = useState<string | null>(null);

  const fetchGrants = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch(`/api/grants?status=all&scope=${filterScope}`);
      const list = Array.isArray(data) ? data : (data.grants || []);
      setGrants(list);
    } catch (err) {
      console.error('Failed to load grants', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, [user, activePersonaId, filterScope]);

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingGrant || !revokeReason.trim()) return;

    setIsSubmittingRevoke(true);
    try {
      await apiFetch(`/api/grants/${revokingGrant.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({
          reason_code: 'POLICY_VIOLATION',
          emergency: isEmergency,
          note: revokeReason.trim(),
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

  const handleEarlyReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releasingGrant) return;

    setIsSubmittingRelease(true);
    try {
      await apiFetch(`/api/grants/${releasingGrant.id}/release-early`, {
        method: 'POST',
        body: JSON.stringify({
          reason_code: 'PURPOSE_COMPLETE',
          emergency: false,
          note: releaseNotes.trim() || 'Early self-release: task completed ahead of schedule.',
        }),
      }).catch(async () => {
        // Fallback to revoke endpoint if release-early is alias
        await apiFetch(`/api/grants/${releasingGrant.id}/revoke`, {
          method: 'POST',
          body: JSON.stringify({
            reason_code: 'PURPOSE_COMPLETE',
            emergency: false,
            note: releaseNotes.trim() || 'Early self-release: task completed ahead of schedule.',
          }),
        });
      });

      setReleaseSuccessMsg(
        `Grant ${releasingGrant.id.slice(0, 8)}... was successfully released early. Organizational risk exposure reduced.`
      );
      setReleasingGrant(null);
      setReleaseNotes('Project task completed ahead of schedule.');
      await fetchGrants();
      setTimeout(() => setReleaseSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Early release failed', err);
    } finally {
      setIsSubmittingRelease(false);
    }
  };

  const filtered = grants.filter((g) => {
    const eff = g.effective_status || g.status;
    if (filterStatus === 'ALL') return true;
    return eff === filterStatus;
  });

  const activeCount = grants.filter((g) => (g.effective_status || g.status) === 'ACTIVE').length;
  const expiredCount = grants.filter((g) => (g.effective_status || g.status) === 'EXPIRED').length;
  const revokedCount = grants.filter((g) => (g.effective_status || g.status) === 'REVOKED').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Active Governed Grants &amp; Utilization</h1>
          <p className="page-subtitle">
            Time-bounded access tokens derived strictly from approved review trails. Tracks real-time utilization and supports proactive self-release (Innovation 5).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/reviews')}>
            <span>Review Pending Approvals</span>
            <ArrowRight size={14} />
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/requests/new')}>
            <Plus size={16} />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Prominent Architectural Guide: "How Governed Grants Are Formed & Monitored" */}
      <div
        className="glass-panel"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #cbd5e1',
          borderLeft: '5px solid #059669',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Key size={20} color="#059669" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                How Governed Grants Work
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Access Grants are minted automatically by the <strong>Policy Decision Point (PDP)</strong> once all 3
              multi-party review tiers (Manager, Resource Owner, Risk Reviewer) submit their approval. Each grant is
              strictly time-bounded, scoped to declared operations &amp; purpose, and verified on every simulated access attempt.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {releaseSuccessMsg && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            color: '#065f46',
            fontSize: '0.9rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <CheckCheck size={18} />
          <span>{releaseSuccessMsg}</span>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Active Governed Grants</div>
            <div className="kpi-val" style={{ color: '#059669' }}>{activeCount}</div>
            <div className="kpi-sub">PDP authorization active</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Expired / Swept</div>
            <div className="kpi-val">{expiredCount}</div>
            <div className="kpi-sub">Auto-terminated by Clock</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Revoked Grants</div>
            <div className="kpi-val" style={{ color: revokedCount > 0 ? '#e11d48' : 'var(--text-primary)' }}>
              {revokedCount}
            </div>
            <div className="kpi-sub">Early release or emergency revoke</div>
          </div>
        </div>
      </div>

      {/* Dual Filter Bars: Scope Toggle & Status Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '0.75rem',
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ACTIVE', 'EXPIRED', 'REVOKED', 'ALL'].map((tab) => (
            <button
              key={tab}
              className={`btn btn-sm ${filterStatus === tab ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus(tab)}
              id={`tab-status-${tab.toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Scope Filter Switcher */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>SCOPE:</span>
          <button
            className={`btn btn-sm ${filterScope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterScope('all')}
            style={{ borderRadius: '9999px', fontSize: '0.75rem', padding: '0.2rem 0.65rem' }}
          >
            All Governed Grants
          </button>
          <button
            className={`btn btn-sm ${filterScope === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterScope('mine')}
            style={{ borderRadius: '9999px', fontSize: '0.75rem', padding: '0.2rem 0.65rem' }}
          >
            My Grants Only
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading governed grants...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <Key size={42} color="var(--accent-primary)" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            No Grants Found Matching "{filterStatus}"
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto 1.25rem auto', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Grants appear here once submitted access requests complete all multi-party approval slots (Manager, Resource Owner, Risk Reviewer).
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/reviews')}>
              <span>Review Open Approval Slots</span>
              <ArrowRight size={14} />
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/requests')}>
              View Access Requests
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/requests/new')}>
              Submit New Request
            </button>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Resource &amp; Tier</th>
                <th>Subject</th>
                <th>Time Remaining</th>
                <th>Utilization (Inno 5)</th>
                <th>Granted Scope</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const eff = g.effective_status || g.status;
                const isRevoked = eff === 'REVOKED';
                const invocations = g.invocation_count ?? 0;
                const utilStatus = g.utilization_status || (invocations > 0 ? 'ACTIVE_UTILIZING' : 'NEVER_USED');

                // Determine if active user can release this grant early
                const canReleaseEarly = eff === 'ACTIVE';

                return (
                  <tr key={g.id} id={`grant-row-${g.id}`}>
                    <td>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{g.resource_name || g.resource_id}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          ID: <span className="font-mono">{g.id.slice(0, 10)}...</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {g.requester_sub || g.subject_name || g.subject_id}
                      </span>
                    </td>
                    <td>
                      <CountdownTimer expiresAt={g.expires_at} isRevoked={isRevoked} />
                    </td>
                    <td>
                      {/* Innovation 5: Smart Utilization Badges */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {utilStatus === 'ACTIVE_UTILIZING' ? (
                          <span className="util-badge util-active">
                            <Activity size={12} />
                            <span>Active ({invocations} uses)</span>
                          </span>
                        ) : utilStatus === 'REVIEW_SUGGESTED' ? (
                          <span className="util-badge util-dormant">
                            <Clock size={12} />
                            <span>Dormant (&gt;24h)</span>
                          </span>
                        ) : (
                          <span className="util-badge util-never">
                            <Clock size={12} />
                            <span>Never Used</span>
                          </span>
                        )}
                        {g.last_used_at && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Last: {new Date(g.last_used_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div>
                          Operations: <strong style={{ color: 'var(--text-primary)' }}>{g.actions ? g.actions.join(', ') : 'All'}</strong>
                        </div>
                        <div>
                          Purpose: <strong style={{ color: 'var(--text-primary)' }}>{g.purpose_code || 'General'}</strong>
                        </div>
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
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/simulator?grant=${g.id}`)}
                          title="Test with PEP Simulator"
                          id={`btn-sim-${g.id}`}
                        >
                          <Terminal size={14} />
                          <span>Simulate</span>
                        </button>

                        {/* Innovation 5: Requester Self-Release Early */}
                        {canReleaseEarly && (
                          <button
                            className="btn btn-sm"
                            style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
                            onClick={() => setReleasingGrant(g)}
                            title="Release access early to reduce organizational risk"
                            id={`btn-release-${g.id}`}
                          >
                            <LogOut size={14} />
                            <span>Release Early</span>
                          </button>
                        )}

                        {eff === 'ACTIVE' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setRevokingGrant(g)}
                            id={`btn-revoke-${g.id}`}
                            title="Execute administrative/emergency revocation"
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

      {/* Innovation 5: Early Release Confirmation Modal */}
      {releasingGrant && (
        <div className="modal-overlay" onClick={() => setReleasingGrant(null)} id="release-modal">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#dcfce7', padding: '0.45rem', borderRadius: '8px', color: '#15803d' }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Proactive Early Release (Innovation 5)
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Grant ID: <span className="font-mono">{releasingGrant.id.slice(0, 8)}...</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReleasingGrant(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEarlyReleaseSubmit}>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                }}
              >
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#166534', margin: '0 0 0.35rem 0' }}>
                  Principle of Least Privilege in Action
                </h4>
                <p style={{ fontSize: '0.825rem', color: '#15803d', margin: 0, lineHeight: 1.5 }}>
                  Releasing access when your task is complete closes your authorization token ahead of time. This proactive hygiene eliminates idle privileges, protects sensitive data, and contributes to organizational compliance metrics.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" htmlFor="release-notes-input" style={{ color: 'var(--text-primary)' }}>
                  Completion Notes / Hand-off Summary:
                </label>
                <textarea
                  id="release-notes-input"
                  className="form-textarea"
                  rows={2}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="Task completed ahead of schedule..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReleasingGrant(null)}
                  disabled={isSubmittingRelease}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingRelease}
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  {isSubmittingRelease ? 'Releasing Access...' : 'Confirm Early Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {revokingGrant && (
        <div className="modal-overlay" onClick={() => setRevokingGrant(null)} id="revoke-modal">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#fee2e2', padding: '0.45rem', borderRadius: '8px', color: '#dc2626' }}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Revoke Governed Access Grant
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Grant ID: <span className="font-mono">{revokingGrant.id.slice(0, 8)}...</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRevokingGrant(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRevokeSubmit}>
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                }}
              >
                <p style={{ fontSize: '0.825rem', color: '#991b1b', margin: 0, lineHeight: 1.5 }}>
                  <strong>Warning:</strong> Revocation terminates access immediately across all downstream Policy Decision Points (PDP). This operation is immutable and recorded in the audit trail.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" htmlFor="revoke-reason-input" style={{ color: 'var(--text-primary)' }}>
                  Reason for Revocation (Required):
                </label>
                <textarea
                  id="revoke-reason-input"
                  className="form-textarea"
                  rows={2}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Security audit finding, policy violation, or operational sunset..."
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    id="emergency-revoke-checkbox"
                  />
                  <span style={{ fontWeight: 650, color: isEmergency ? '#dc2626' : 'var(--text-primary)' }}>
                    Flag as Emergency Revocation (High Priority Alert)
                  </span>
                </label>
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
                >
                  {isSubmittingRevoke ? 'Revoking...' : isEmergency ? 'Confirm Emergency Revocation' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GrantsPage;
