import React, { useState } from 'react';
import { AccessRequest, ReviewSlot, ResourceLimits } from '../types';
import { LimitsDiff } from './LimitsDiff';
import { CheckCircle2, Sliders, XCircle, AlertCircle, X } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'approve' | 'narrow' | 'reject'>('approve');
  const [rationale, setRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Narrowing state initialized from request.requested_limits
  const [narrowedRecords, setNarrowedRecords] = useState<number>(request.requested_limits.max_records || 1000);
  const [narrowedRps, setNarrowedRps] = useState<number>(request.requested_limits.max_rps || 10);
  const [narrowedCost, setNarrowedCost] = useState<number>(request.requested_limits.max_cost_usd || 50);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(request.requested_limits.allowed_formats || ['json']);
  const [ipFilter, setIpFilter] = useState<string>((request.requested_limits.ip_allowlist || []).join(', '));

  const maxAllowedRecords = request.requested_limits.max_records || 100000;
  const maxAllowedRps = request.requested_limits.max_rps || 100;
  const maxAllowedCost = request.requested_limits.max_cost_usd || 1000;

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
      // Can only select if was originally in requested_limits
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

  return (
    <div className="modal-overlay" onClick={onClose} id="decision-drawer">
      <div
        className="modal-content"
        style={{ maxWidth: '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
              Slot {slot.slot_index + 1} Review Decision
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Required Role: <strong className="font-mono" style={{ color: '#818cf8' }}>{slot.required_role}</strong> | Request ID: <span className="font-mono">{request.id.slice(0, 8)}...</span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Action Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
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
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>
              You are approving all requested controls, duration ({request.duration_hours}h), and limits as submitted.
            </p>
          </div>
        )}

        {/* Tab 2: Narrow Scope Configuration */}
        {activeTab === 'narrow' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#fde68a' }}>
                <strong>Strict Subset Invariant:</strong> You can only reduce bounds or restrict actions/formats. Expansion beyond the requested limits is cryptographically rejected.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Max Records Slider */}
              <div className="form-group">
                <label className="form-label">
                  Max Records: <strong style={{ color: '#fbbf24' }}>{narrowedRecords.toLocaleString()}</strong> (Max: {maxAllowedRecords})
                </label>
                <input
                  type="range"
                  min="1"
                  max={maxAllowedRecords}
                  value={narrowedRecords}
                  onChange={(e) => setNarrowedRecords(Math.min(maxAllowedRecords, Number(e.target.value)))}
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                  id="narrow-records-slider"
                />
              </div>

              {/* Max RPS Slider */}
              <div className="form-group">
                <label className="form-label">
                  Max RPS: <strong style={{ color: '#fbbf24' }}>{narrowedRps} req/s</strong> (Max: {maxAllowedRps})
                </label>
                <input
                  type="range"
                  min="1"
                  max={maxAllowedRps}
                  value={narrowedRps}
                  onChange={(e) => setNarrowedRps(Math.min(maxAllowedRps, Number(e.target.value)))}
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                  id="narrow-rps-slider"
                />
              </div>
            </div>

            {/* Allowed Formats checkboxes */}
            {request.requested_limits.allowed_formats && (
              <div className="form-group">
                <label className="form-label">Permitted Formats (Can only restrict):</label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {request.requested_limits.allowed_formats.map((fmt) => (
                    <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
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
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>Live Scope Diff:</p>
            <LimitsDiff requested={request.requested_limits} narrowed={currentNarrowedLimits} />
          </div>
        )}

        {/* Tab 3: Reject Info */}
        {activeTab === 'reject' && (
          <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
              Rejecting this slot immediately short-circuits the request into terminal <strong>REJECTED</strong> state.
            </p>
          </div>
        )}

        {/* Rationale Input */}
        <div className="form-group">
          <label className="form-label">
            Decision Rationale {activeTab !== 'approve' ? <span style={{ color: '#f43f5e' }}>* (Required)</span> : '(Optional)'}:
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
          <div style={{ padding: '0.75rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1rem' }}>
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
