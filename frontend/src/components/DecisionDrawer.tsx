import React, { useState, useEffect } from 'react';
import { AccessRequest, ReviewSlot, ApprovalAssistanceData } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle2, 
  Sliders, 
  XCircle, 
  X, 
  Sparkles, 
  HelpCircle, 
  History, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';

interface DecisionDrawerProps {
  request: AccessRequest;
  slot: ReviewSlot;
  onClose: () => void;
  onSubmitDecision: (
    decision: 'approve' | 'narrow' | 'reject',
    rationale: string,
    approvedLimits?: { actions?: string[]; duration_minutes?: number }
  ) => Promise<void>;
}

export const DecisionDrawer: React.FC<DecisionDrawerProps> = ({
  request,
  slot,
  onClose,
  onSubmitDecision,
}) => {
  const { apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<'approve' | 'narrow' | 'reject'>('approve');
  const [rationale, setRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Approval Assistance state
  const [assistanceData, setAssistanceData] = useState<ApprovalAssistanceData | null>(null);
  const [isLoadingAssistance, setIsLoadingAssistance] = useState<boolean>(false);

  // Narrowing state
  const requestedActions = request.actions && request.actions.length > 0 ? request.actions : ['query'];
  const requestedDuration = request.duration_minutes || (request.duration_hours ? request.duration_hours * 60 : 1440);

  const [narrowedActions, setNarrowedActions] = useState<string[]>(requestedActions);
  const [narrowedDurationMinutes, setNarrowedDurationMinutes] = useState<number>(requestedDuration);

  useEffect(() => {
    let isMounted = true;
    const fetchAssistance = async () => {
      setIsLoadingAssistance(true);
      try {
        const data = await apiFetch(`/api/requests/${request.id}/assistance`);
        if (isMounted) {
          setAssistanceData(data);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoadingAssistance(false);
      }
    };

    fetchAssistance();
    return () => { isMounted = false; };
  }, [request.id, apiFetch]);

  const handleActionToggle = (act: string) => {
    if (narrowedActions.includes(act)) {
      if (narrowedActions.length > 1) {
        setNarrowedActions(narrowedActions.filter((a) => a !== act));
      }
    } else {
      if (requestedActions.includes(act)) {
        setNarrowedActions([...narrowedActions, act]);
      }
    }
  };

  const handleDecision = async () => {
    setErrorMsg(null);
    if ((activeTab === 'narrow' || activeTab === 'reject') && !rationale.trim()) {
      setErrorMsg('A detailed rationale is strictly required when narrowing or rejecting.');
      return;
    }

    if (activeTab === 'narrow') {
      if (narrowedActions.length === 0) {
        setErrorMsg('Narrowed scope must contain at least one operation. If all operations are denied, reject the request.');
        return;
      }
      const isSubset = narrowedActions.every((a) => requestedActions.includes(a));
      if (!isSubset) {
        setErrorMsg('Narrowed actions must be a subset of requested actions.');
        return;
      }
      const isActionReduced = narrowedActions.length < requestedActions.length;
      const isDurationReduced = narrowedDurationMinutes < requestedDuration;
      if (!isActionReduced && !isDurationReduced) {
        setErrorMsg('Narrowing must restrict either actions or duration. To approve as submitted, use "Approve As-Is".');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'narrow') {
        await onSubmitDecision('narrow', rationale, {
          actions: narrowedActions,
          duration_minutes: narrowedDurationMinutes,
        });
      } else {
        await onSubmitDecision(activeTab, rationale);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || err.detail?.message || 'Failed to submit decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine role-tailored guidance from assistance payload
  const slotRoleNormalized = (slot.slot_role || slot.required_role || 'manager').toLowerCase().replace(/[^a-z]/g, '');
  let roleKey = 'manager';
  if (slotRoleNormalized.includes('risk') || slotRoleNormalized.includes('security')) {
    roleKey = 'risk_reviewer';
  } else if (slotRoleNormalized.includes('owner') || slotRoleNormalized.includes('resource')) {
    roleKey = 'resource_owner';
  }

  const roleGuidance = assistanceData?.guidance?.[roleKey] || assistanceData?.guidance?.['manager'];

  return (
    <div className="modal-overlay" onClick={onClose} id="decision-drawer">
      <div
        className="modal-content"
        style={{ maxWidth: '780px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="role-chip role-chip-gov font-mono">Review Slot: {slot.slot_role || slot.required_role}</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Record Multi-Party Decision
              </h3>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
              Assigned Role: <strong style={{ color: 'var(--accent-primary)' }}>{slot.slot_role || slot.required_role}</strong> | Request ID: <span className="font-mono">{request.id.slice(0, 8)}...</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-subtle)', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius-md)'
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Intelligent Approval Assistance Panel */}
        {roleGuidance && (
          <div className="assistance-card" style={{ background: '#fffbeb', border: '1px solid #fed7aa', marginBottom: '1.25rem' }}>
            <div className="assistance-header" style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              <Sparkles size={18} />
              <span>FORGE Hierarchy Assistance: {roleGuidance.title}</span>
            </div>

            {/* Focus Areas */}
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                Key Focus Areas:
              </span>
              <ul className="assistance-list" style={{ marginTop: '0.25rem' }}>
                {roleGuidance.focus_areas.map((area, idx) => (
                  <li key={idx}>{area}</li>
                ))}
              </ul>
            </div>

            {/* Key Evaluation Questions */}
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                Evaluation Checklist:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                {roleGuidance.key_questions.map((q, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <HelpCircle size={14} style={{ color: 'var(--accent-amber)', marginTop: '2px', flexShrink: 0 }} />
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prior Decisions Lineage */}
            {assistanceData?.lineage && assistanceData.lineage.length > 0 && (
              <div style={{ borderTop: '1px dashed #fed7aa', paddingTop: '0.6rem', marginTop: '0.6rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <History size={14} /> Prior Approver Lineage:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                  {assistanceData.lineage.map((item, idx) => (
                    <div key={idx} style={{ background: '#ffffff', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid #fed7aa', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.slot_role.toUpperCase()}: <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{item.decided_by_sub}</span>
                        </span>
                        <span className={`badge ${item.status === 'APPROVED' ? 'badge-active' : 'badge-blocked'}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                          {item.decision.toUpperCase()}
                        </span>
                      </div>
                      {item.rationale && (
                        <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          "{item.rationale}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'approve' ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setActiveTab('approve')}
            id="btn-tab-approve"
          >
            <CheckCircle2 size={16} />
            <span>Approve As-Is</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'narrow' ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => setActiveTab('narrow')}
            id="btn-tab-narrow"
          >
            <Sliders size={16} />
            <span>Narrow Scope</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'reject' ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setActiveTab('reject')}
            id="btn-tab-reject"
          >
            <XCircle size={16} />
            <span>Reject Request</span>
          </button>
        </div>

        {/* Tab 1: Approve info */}
        {activeTab === 'approve' && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#065f46', margin: 0 }}>
              You are approving all requested operations (<code>{requestedActions.join(', ')}</code>) and duration ({requestedDuration} minutes) as submitted.
            </p>
          </div>
        )}

        {/* Tab 2: Narrow Scope Configuration */}
        {activeTab === 'narrow' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.825rem', color: '#92400e', margin: 0 }}>
                <strong>Strict Subset Invariant (SG-6):</strong> You can only reduce bounds or deselect operations. Expansion beyond requested limits is mathematically impossible.
              </p>
            </div>

            {/* Allowed Actions Narrowing */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                Permitted Operations (Uncheck to restrict/deny specific actions):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                {requestedActions.map((act) => (
                  <label key={act} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={narrowedActions.includes(act)}
                      onChange={() => handleActionToggle(act)}
                      style={{ accentColor: 'var(--accent-amber)' }}
                    />
                    <span className="font-mono">{act}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Duration Slider Narrowing */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                  Narrowed Duration (Minutes):
                </label>
                <span className="font-mono" style={{ color: 'var(--accent-amber)', fontWeight: 800 }}>
                  {narrowedDurationMinutes} mins ({Math.round(narrowedDurationMinutes / 60)}h)
                </span>
              </div>
              <input
                type="range"
                min="2"
                max={requestedDuration}
                value={narrowedDurationMinutes}
                onChange={(e) => setNarrowedDurationMinutes(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
                id="narrow-duration-slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                <span>Min: 2m</span>
                <span>Original Requested: {requestedDuration}m</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Reject Info */}
        {activeTab === 'reject' && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#9f1239', margin: 0 }}>
              Rejecting this slot immediately short-circuits the request into terminal <strong>REJECTED</strong> state.
            </p>
          </div>
        )}

        {/* Rationale Input */}
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ color: 'var(--text-primary)' }}>
            Decision Rationale {activeTab !== 'approve' ? <span style={{ color: 'var(--accent-rose)' }}>* (Required)</span> : '(Optional)'}:
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder={
              activeTab === 'approve'
                ? 'Optional notes regarding verified business necessity and safety...'
                : activeTab === 'narrow'
                ? 'Explain why permissions or duration were tightened (e.g. data minimization principle)...'
                : 'State explicit justification for denial...'
            }
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            id="decision-rationale-input"
          />
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', color: '#9f1239', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'approve' ? 'btn-success' : activeTab === 'narrow' ? 'btn-warning' : 'btn-danger'}`}
            onClick={handleDecision}
            disabled={isSubmitting}
            id="btn-confirm-decision"
          >
            {isSubmitting ? 'Recording...' : `Confirm ${activeTab.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};
