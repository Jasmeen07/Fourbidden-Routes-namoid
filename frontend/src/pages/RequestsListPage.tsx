import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccessRequest, RequestStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { LimitsDiff } from '../components/LimitsDiff';
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle, Ban, ArrowRight, Shield } from 'lucide-react';

export const RequestsListPage: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchRequests = async () => {
    try {
      const data = await apiFetch('/api/requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error(err);
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
          <p style={{ color: 'var(--text-secondary)' }}>Loading requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No access requests found matching the filter.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/catalog')}>
            Explore Catalog
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filtered.map((req) => {
            const isOpen = req.status === 'IN_REVIEW' || req.status === 'BLOCKED';

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
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      <strong>Requester:</strong> <span className="font-mono">{req.requester_name || req.requester_id}</span> | <strong>Purpose:</strong> {req.purpose}
                    </p>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                      <strong>Justification:</strong> {req.justification}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isOpen && (
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
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    Multi-Party Review Slots
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {req.slots.map((s) => {
                      let slotColor = 'var(--accent-primary)';
                      let badgeClass = 'badge-in-review';
                      if (s.status === 'APPROVED') { slotColor = 'var(--accent-emerald)'; badgeClass = 'badge-active'; }
                      if (s.status === 'NARROWED') { slotColor = 'var(--accent-amber)'; badgeClass = 'badge-tier-sensitive'; }
                      if (s.status === 'REJECTED') { slotColor = 'var(--accent-rose)'; badgeClass = 'badge-revoked'; }

                      return (
                        <div
                          key={s.id}
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
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Slot {s.slot_index + 1}: {s.required_role}</span>
                            <span className={`badge ${badgeClass} font-mono`} style={{ fontSize: '0.7rem' }}>
                              {s.status}
                            </span>
                          </div>
                          {s.decision_rationale && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              "{s.decision_rationale}"
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Limits representation */}
                <LimitsDiff requested={req.requested_limits} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
