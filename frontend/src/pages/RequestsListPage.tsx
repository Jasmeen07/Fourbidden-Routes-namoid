import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccessRequest, RequestStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle, Ban, ArrowRight, Shield, Layers } from 'lucide-react';

export const RequestsListPage: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/requests?view=visible');
      const list = Array.isArray(data) ? data : (data.requests || []);
      setRequests(list);
    } catch (err) {
      console.error('Failed to fetch requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleWithdraw = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to withdraw this access request?')) return;
    try {
      await apiFetch(`/api/requests/${requestId}/withdraw`, { method: 'POST' });
      await fetchRequests();
    } catch (err) {
      console.error('Withdrawal failed', err);
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'IN_REVIEW':
        return <span className="badge badge-in-review">In Review</span>;
      case 'BLOCKED':
        return <span className="badge badge-blocked">Blocked (No Reviewer)</span>;
      case 'APPROVED':
        return <span className="badge badge-active">Approved</span>;
      case 'REJECTED':
        return <span className="badge badge-revoked">Rejected</span>;
      case 'WITHDRAWN':
        return <span className="badge badge-expired">Withdrawn</span>;
      default:
        return <span className="badge badge-in-review">{status}</span>;
    }
  };

  const filtered = requests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'OPEN') return r.status === 'IN_REVIEW' || r.status === 'BLOCKED';
    return r.status === filterStatus;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Access Requests</h1>
          <p className="page-subtitle">
            Track multi-slot review progress, inspect scope limits, and withdraw open submissions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/requests/new')} id="btn-create-request">
            <Plus size={16} />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['ALL', 'OPEN', 'APPROVED', 'REJECTED', 'WITHDRAWN'].map((tab) => (
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
          <p style={{ color: 'var(--text-secondary)' }}>Loading access requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Layers size={36} color="var(--accent-primary)" style={{ margin: '0 auto 0.75rem auto' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No access requests found matching the filter.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/requests/new')}>
            Create Access Request
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filtered.map((req) => {
            const isOpen = req.status === 'IN_REVIEW' || req.status === 'BLOCKED';
            const slots = req.slots || [];
            const isUserReviewer = slots.some((s) => s.status === 'PENDING' && (s.assigned_sub === user?.sub || user?.roles.includes(s.slot_role)) && req.requester_sub !== user?.sub);

            return (
              <div key={req.id} className="glass-panel" id={`request-card-${req.id}`} style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {req.resource_name || req.resource_id}
                      </h3>
                      {getStatusBadge(req.status)}
                      <span className="badge font-mono" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.7rem', border: '1px solid var(--border-subtle)' }}>
                        {req.id.slice(0, 8)}...
                      </span>
                      {req.is_crucial && (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700 }}>
                          CRUCIAL DATA
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      <strong>Requester:</strong> <span className="font-mono">{req.requester_sub || req.requester_id}</span> | <strong>Purpose:</strong> {req.purpose_code || req.purpose} | <strong>Duration:</strong> {req.duration_minutes ? `${req.duration_minutes}m (${Math.round(req.duration_minutes / 60)}h)` : `${req.duration_hours}h`}
                    </p>
                    {req.purpose_text && (
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                        <strong>Justification:</strong> {req.purpose_text}
                      </p>
                    )}
                    {/* Actions Badges */}
                    {req.actions && req.actions.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Operations:</span>
                        {req.actions.map((act) => (
                          <span key={act} className="badge font-mono" style={{ background: 'var(--bg-secondary)', color: 'var(--accent-primary)', fontSize: '0.72rem', border: '1px solid var(--border-subtle)' }}>
                            {act}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isUserReviewer && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/reviews')}
                        id={`btn-review-${req.id}`}
                      >
                        <span>Review Queue</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                    {isOpen && req.requester_sub === user?.sub && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleWithdraw(req.id)}
                        id={`btn-withdraw-${req.id}`}
                      >
                        <Ban size={14} />
                        <span>Withdraw</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-Slot Review Stepper */}
                {slots.length > 0 && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                      Multi-Party Review Hierarchy Slots ({slots.length})
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {slots.map((s, idx) => {
                        let slotColor = 'var(--accent-primary)';
                        let badgeClass = 'badge-in-review';
                        if (s.status === 'APPROVED') { slotColor = 'var(--accent-emerald)'; badgeClass = 'badge-active'; }
                        if (s.status === 'NARROWED') { slotColor = 'var(--accent-amber)'; badgeClass = 'badge-tier-sensitive'; }
                        if (s.status === 'REJECTED') { slotColor = 'var(--accent-rose)'; badgeClass = 'badge-revoked'; }

                        return (
                          <div
                            key={s.id || idx}
                            style={{
                              padding: '0.5rem 0.85rem',
                              background: 'var(--bg-secondary)',
                              border: `1px solid var(--border-subtle)`,
                              borderLeft: `4px solid ${slotColor}`,
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.8rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                              minWidth: '180px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {s.slot_role}
                              </span>
                              <span className={`badge ${badgeClass} font-mono`} style={{ fontSize: '0.68rem' }}>
                                {s.status}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Assigned: <code className="font-mono">{s.assigned_sub}</code>
                            </span>
                            {s.rationale && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.1rem' }}>
                                "{s.rationale}"
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
