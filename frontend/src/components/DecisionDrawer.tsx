import React, { useState, useEffect } from 'react';
import { AccessRequest, ReviewSlot, ResourceLimits, ApprovalAssistanceData } from '../types';
import { LimitsDiff } from './LimitsDiff';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle2, 
  Sliders, 
  XCircle, 
  AlertCircle, 
  X, 
  Sparkles, 
  HelpCircle, 
  History, 
  ShieldCheck, 
  ArrowRight,
  UserCheck,
  Check
} from 'lucide-react';

interface DecisionDrawerProps {
  request: AccessRequest;
  slot: ReviewSlot;
  onClose: () => void;
  onSubmitDecision: (decision: 'approve' | 'narrow' | 'reject', rationale: string, narrowedLimits?: ResourceLimits) => Promise<void>;
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

  // Innovation 3: Approval Assistance state
  const [assistanceData, setAssistanceData] = useState<ApprovalAssistanceData | null>(null);
  const [isLoadingAssistance, setIsLoadingAssistance] = useState<boolean>(false);

  // Narrowing state initialized from request.requested_limits
  const [narrowedRecords, setNarrowedRecords] = useState<number>(request.requested_limits.max_records || 1000);
  const [narrowedRps, setNarrowedRps] = useState<number>(request.requested_limits.max_rps || 10);
  const [narrowedCost, setNarrowedCost] = useState<number>(request.requested_limits.max_cost_usd || 50);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(request.requested_limits.allowed_formats || ['json']);
  const [ipFilter, setIpFilter] = useState<string>((request.requested_limits.ip_allowlist || []).join(', '));

  const maxAllowedRecords = request.requested_limits.max_records || 100000;
  const maxAllowedRps = request.requested_limits.max_rps || 100;
  const maxAllowedCost = request.requested_limits.max_cost_usd || 1000;

  useEffect(() => {
    let isMounted = true;
    const fetchAssistance = async () => {
      setIsLoadingAssistance(true);
      try {
        const data = await apiFetch(`/api/requests/${request.id}/assistance`);
        if (isMounted) {
          setAssistanceData(data);
        }
      } catch (err) {
        // Fallback gracefully if assistance API has any issue
      } finally {
        if (isMounted) setIsLoadingAssistance(false);
      }
    };

    fetchAssistance();
    return () => { isMounted = false; };
  }, [request.id, apiFetch]);

  const currentNarrowedLimits: ResourceLimits = {
    ...request.requested_limits,
    max_records: narrowedRecords,
    max_rps: narrowedRps,
    max_cost_usd: narrowedCost,
    allowed_formats: selectedFormats,
    ip_allowlist: ipFilter.trim() ? ipFilter.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
  };

  const handleFormatToggle = (fmt: string) => {
    if (selectedFormats.includes(fmt)) {
      if (selectedFormats.length > 1) {
        setSelectedFormats(selectedFormats.filter((f) => f !== fmt));
      }
    } else {
      if (request.requested_limits.allowed_formats?.includes(fmt)) {
        setSelectedFormats([...selectedFormats, fmt]);
      }
    }
  };

  const handleDecision = async () => {
    setErrorMsg(null);
    if ((activeTab === 'narrow' || activeTab === 'reject') && !rationale.trim()) {
      setErrorMsg('A detailed rationale is strictly required when narrowing or rejecting.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'narrow') {
        await onSubmitDecision('narrow', rationale, currentNarrowedLimits);
      } else {
        await onSubmitDecision(activeTab, rationale);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine role-tailored guidance from assistance payload (Innovation 3)
  const slotRoleNormalized = slot.required_role?.toLowerCase().replace(/[^a-z]/g, '') || 'manager';
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
              <span className="role-chip role-chip-gov font-mono">Slot {slot.slot_index + 1}</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Review Decision
              </h3>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
              Required Role: <strong style={{ color: 'var(--accent-primary)' }}>{slot.required_role}</strong> | Request ID: <span className="font-mono">{request.id.slice(0, 8)}...</span>
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

        {/* Innovation 3: Intelligent Approval Assistance Panel */}
        {roleGuidance && (
          <div className="assistance-card" style={{ background: '#fffbeb', border: '1px solid #fed7aa', marginBottom: '1.25rem' }}>
            <div className="assistance-header" style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              <Sparkles size={18} />
              <span>Intelligent Approval Assistance: {roleGuidance.title}</span>
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

            {/* Decision Lineage */}
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
              You are approving all requested controls, duration ({request.duration_hours}h), and limits as submitted.
            </p>
          </div>
        )}

        {/* Tab 2: Narrow Scope Configuration */}
        {activeTab === 'narrow' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.825rem', color: '#92400e', margin: 0 }}>
                <strong>Strict Subset Invariant:</strong> You can only reduce bounds or restrict actions/formats. Expansion beyond the requested limits is cryptographically rejected.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Max Records Slider */}
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                  Max Records: <strong style={{ color: 'var(--accent-amber)' }}>{narrowedRecords.toLocaleString()}</strong> (Max: {maxAllowedRecords})
                </label>
                <input
                  type="range"
                  min="1"
                  max={maxAllowedRecords}
                  value={narrowedRecords}
                  onChange={(e) => setNarrowedRecords(Math.min(maxAllowedRecords, Number(e.target.value)))}
                  style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
                  id="narrow-records-slider"
                />
              </div>

              {/* Max RPS Slider */}
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                  Max RPS: <strong style={{ color: 'var(--accent-amber)' }}>{narrowedRps} req/s</strong> (Max: {maxAllowedRps})
                </label>
                <input
                  type="range"
                  min="1"
                  max={maxAllowedRps}
                  value={narrowedRps}
                  onChange={(e) => setNarrowedRps(Math.min(maxAllowedRps, Number(e.target.value)))}
                  style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
                  id="narrow-rps-slider"
                />
              </div>
            </div>

            {/* Allowed Formats checkboxes */}
            {request.requested_limits.allowed_formats && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>Permitted Formats (Can only restrict):</label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {request.requested_limits.allowed_formats.map((fmt) => (
                    <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={selectedFormats.includes(fmt)}
                        onChange={() => handleFormatToggle(fmt)}
                      />
                      <span>{fmt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Live Limits Diff */}
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Live Scope Diff:</p>
            <LimitsDiff requested={request.requested_limits} narrowed={currentNarrowedLimits} />
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
                ? 'Optional notes regarding compliance check...'
                : activeTab === 'narrow'
                ? 'Explain why bounds were tightened (e.g. data minimization policy)...'
                : 'State explicit reason for denial...'
            }
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            id="decision-rationale-input"
          />
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', color: '#9f1239', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {errorMsg}
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
