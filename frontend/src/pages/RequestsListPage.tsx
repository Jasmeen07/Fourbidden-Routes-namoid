import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccessRequest, RequestStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  ArrowRight,
  Shield,
  Layers,
  Key,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

export const RequestsListPage: React.FC = () => {
  const { apiFetch, user, personas, switchPersona, activePersonaId } = useAuth();
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
  }, [user, activePersonaId]);

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

  const getPersonaForSlotRole = (role?: string) => {
    const rLower = (role || '').toLowerCase();
    if (rLower.includes('manager') || rLower.includes('lead')) return personas.find((p) => p.id === 'carol');
    if (rLower.includes('owner')) return personas.find((p) => p.id === 'david');
    if (rLower.includes('risk') || rLower.includes('compliance')) return personas.find((p) => p.id === 'elena');
    if (rLower.includes('admin') || rLower.includes('executive')) return personas.find((p) => p.id === 'fiona');
    return personas.find((p) => p.id === 'carol');
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

      {/* Prominent Architectural Guide: "Where Do Requests Go For Approval?" */}
      <div
        className="glass-panel"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #cbd5e1',
          borderLeft: '5px solid var(--accent-wine)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <ShieldCheck size={20} color="var(--accent-wine)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Where Do Requests Go For Approval?
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Submitted requests route to 3 sequential reviewer tiers: <strong>Manager (Carol)</strong> &rarr;{' '}
              <strong>Resource Owner (David)</strong> &rarr; <strong>Risk Reviewer (Elena)</strong>. Requesters cannot
              self-approve (SG-1). Once all tiers approve, an <strong>Active Grant</strong> is generated automatically.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/reviews')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--accent-wine)', color: 'var(--accent-wine)' }}
          >
            <span>Open Governance Approvals Queue</span>
            <ArrowRight size={14} />
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
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
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
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';
            const slots = req.slots || [];

            const pendingSlot = slots.find((s) => s.status === 'PENDING');
            const targetPersona = getPersonaForSlotRole(pendingSlot?.slot_role);
            const isUserReviewer =
              pendingSlot &&
              user?.roles?.some((r: string) => r.toLowerCase() === pendingSlot.slot_role.toLowerCase()) &&
              (req.requester_sub !== user?.sub || user?.roles?.some((r: string) => ['admin', 'executive'].includes(r.toLowerCase())));

            return (
              <div
                key={req.id}
                className="glass-panel"
                id={`request-card-${req.id}`}
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', padding: '1.35rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {req.resource_name || req.resource_id}
                      </h3>
                      {getStatusBadge(req.status)}
                      <span className="badge font-mono" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', border: '1px solid #cbd5e1' }}>
                        {req.id.slice(0, 10)}...
                      </span>
                      {req.is_crucial && (
                        <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem', fontWeight: 700 }}>
                          CRUCIAL DATA
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      <strong>Requester:</strong> <span className="font-mono">{req.requester_sub || req.requester_id}</span> |{' '}
                      <strong>Purpose:</strong> {req.purpose_code || req.purpose} |{' '}
                      <strong>Duration:</strong> {req.duration_minutes ? `${req.duration_minutes}m (${Math.round(req.duration_minutes / 60)}h)` : `${req.duration_hours}h`}
                    </p>

                    {req.purpose_text && (
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                        <strong>Justification:</strong> {req.purpose_text}
                      </p>
                    )}

                    {/* Actions Badges */}
                    {req.actions && req.actions.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Operations:
                        </span>
                        {req.actions.map((act) => (
                          <span
                            key={act}
                            className="badge font-mono"
                            style={{ background: '#f8fafc', color: 'var(--accent-primary)', fontSize: '0.72rem', border: '1px solid #cbd5e1' }}
                          >
                            {act}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

                {/* Clear Approval Pipeline Status Action Box */}
                {isOpen && pendingSlot && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      marginTop: '0.5rem',
                      marginBottom: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock size={16} color="#d97706" />
                      <span style={{ fontSize: '0.85rem', color: '#92400e' }}>
                        <strong>Approval In Progress:</strong> Waiting for <strong>{pendingSlot.slot_role.toUpperCase()}</strong> review (Assigned: <code>{pendingSlot.assigned_sub}</code>)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {isUserReviewer ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate('/reviews')}
                          id={`btn-approve-now-${req.id}`}
                        >
                          <span>Approve Slot as {user?.display_name || user?.sub}</span>
                          <ArrowRight size={14} />
                        </button>
                      ) : targetPersona ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#d97706', color: '#92400e' }}
                          onClick={() => {
                            switchPersona(targetPersona.id);
                            navigate('/reviews');
                          }}
                          id={`btn-switch-approve-${req.id}`}
                          title={`Switch to ${targetPersona.name} to approve this review slot`}
                        >
                          <span>Switch to {targetPersona.name} ({targetPersona.role}) to Approve</span>
                          <ChevronRight size={14} />
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reviews')}>
                          <span>View in Approvals Queue</span>
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Fully Approved Active Grant Banner */}
                {isApproved && (
                  <div
                    style={{
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      marginTop: '0.5rem',
                      marginBottom: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={18} color="#059669" />
                      <span style={{ fontSize: '0.875rem', color: '#065f46', fontWeight: 600 }}>
                        All 3 review hierarchy slots approved! Active access grant has been generated and enforced.
                      </span>
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      style={{ background: '#059669', borderColor: '#059669' }}
                      onClick={() => navigate('/grants')}
                      id={`btn-view-grant-${req.id}`}
                    >
                      <Key size={14} />
                      <span>View Active Grant</span>
                    </button>
                  </div>
                )}

                {/* Rejected Status Banner */}
                {isRejected && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      marginTop: '0.5rem',
                      marginBottom: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <XCircle size={18} color="#dc2626" />
                    <span style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: 600 }}>
                      Request was rejected by a required reviewer. Access was not granted.
                    </span>
                  </div>
                )}

                {/* Multi-Slot Review Hierarchy Stepper */}
                {slots.length > 0 && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                      Multi-Party Review Hierarchy Slots ({slots.length})
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {slots.map((s, idx) => {
                        let slotColor = 'var(--accent-primary)';
                        let badgeClass = 'badge-in-review';
                        if (s.status === 'APPROVED') {
                          slotColor = '#059669';
                          badgeClass = 'badge-active';
                        }
                        if (s.status === 'NARROWED') {
                          slotColor = '#d97706';
                          badgeClass = 'badge-tier-sensitive';
                        }
                        if (s.status === 'REJECTED') {
                          slotColor = '#dc2626';
                          badgeClass = 'badge-revoked';
                        }

                        return (
                          <div
                            key={s.id || idx}
                            style={{
                              padding: '0.5rem 0.85rem',
                              background: '#f8fafc',
                              border: `1px solid #cbd5e1`,
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

export default RequestsListPage;
