import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Resource, ResourceLimits, ApprovalPreviewResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { Shield, Clock, AlertTriangle, Send, CheckCircle2, ChevronRight, FileCode, Sparkles, ArrowRight, UserCheck, Bot } from 'lucide-react';

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/i,
  /AIzaSy[a-zA-Z0-9_-]{33}/i,
  /ghp_[a-zA-Z0-9]{36}/i,
  /AKIA[0-9A-Z]{16}/,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
  /BEGIN\s+PRIVATE\s+KEY/i,
];

const PREDEFINED_PURPOSES = [
  'Customer Support Chatbot Fine-Tuning',
  'Fraud Detection Model Evaluation',
  'Quarterly Financial Analysis & Reporting',
  'Safety & Red-Teaming Research',
  'Medical Imaging Diagnostics Verification',
  'Compliance & Privacy Audit',
];

export const NewRequestPage: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialResourceId = searchParams.get('resource') || '';

  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>(initialResourceId);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [purpose, setPurpose] = useState<string>(PREDEFINED_PURPOSES[0]);
  const [justification, setJustification] = useState<string>('');
  const [maxRecords, setMaxRecords] = useState<number>(5000);
  const [maxRps, setMaxRps] = useState<number>(10);
  const [maxCost, setMaxCost] = useState<number>(50);
  const [allowedFormats, setAllowedFormats] = useState<string[]>(['json']);
  const [ipAllowlist, setIpAllowlist] = useState<string>('10.0.0.0/16');
  const [acknowledgedControls, setAcknowledgedControls] = useState<string[]>([]);

  const [hasSecretWarning, setHasSecretWarning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approvalPreview, setApprovalPreview] = useState<ApprovalPreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  useEffect(() => {
    const loadResources = async () => {
      try {
        const res = await apiFetch('/api/resources');
        const list = Array.isArray(res) ? res : (res.resources || []);
        const normalized = list.map((r: any) => ({
          ...r,
          type: r.type || r.kind || 'MODEL',
          description: r.description || `Enterprise governed ${r.kind || 'resource'} under tier ${r.tier}`,
          max_duration_hours: r.max_duration_hours || (r.tier === 'RESTRICTED_SYNTHETIC' || r.tier === 'TIER_1_CRITICAL' ? 24 : 72),
          required_controls: r.required_controls || ['activity_logging', 'synthetic_data_only'],
          department: r.department || 'General',
          is_crucial: !!r.is_crucial,
        }));
        setResources(normalized);
        if (!selectedResourceId && normalized.length > 0) {
          setSelectedResourceId(normalized[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadResources();
  }, []);

  const selectedResource = resources.find((r) => r.id === selectedResourceId);

  // Set default acknowledged controls when resource changes
  useEffect(() => {
    if (selectedResource) {
      setAcknowledgedControls(selectedResource.required_controls || []);
      if (durationHours > selectedResource.max_duration_hours) {
        setDurationHours(selectedResource.max_duration_hours);
      }
    }
  }, [selectedResource]);

  // Scan for secret patterns in justification
  useEffect(() => {
    const detected = SECRET_PATTERNS.some((p) => p.test(justification));
    setHasSecretWarning(detected);
  }, [justification]);

  // FORGE Hierarchy Approval Path preview
  useEffect(() => {
    if (!selectedResourceId) return;

    const loadApprovalPath = async () => {
      setIsLoadingPreview(true);
      try {
        const requesterId = user?.sub || 'E102';
        const res = await apiFetch(`/api/hierarchy/preview-approval?requester_id=${requesterId}&resource_id=${selectedResourceId}`);
        setApprovalPreview(res);
      } catch (err) {
        setApprovalPreview(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadApprovalPath();
  }, [selectedResourceId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceId) return;

    setIsSubmitting(true);
    try {
      const payload = {
        resource_id: selectedResourceId,
        duration_hours: durationHours,
        purpose,
        justification,
        requested_limits: {
          max_records: maxRecords,
          max_rps: maxRps,
          max_cost_usd: maxCost,
          allowed_formats: allowedFormats,
          ip_allowlist: ipAllowlist.split(',').map((s) => s.trim()).filter(Boolean),
        },
        required_controls: acknowledgedControls,
      };

      await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      navigate('/requests');
    } catch (err) {
      console.error('Submission failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Submit Governed Access Request</h1>
          <p className="page-subtitle">
            Declare purpose, bound limits, and acknowledge mandatory risk controls under Multi-Party Governance.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Form */}
        <form onSubmit={handleSubmit} className="glass-panel" id="request-form" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Request Parameters
          </h3>

          {/* 1. Resource Selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="resource-select" style={{ color: 'var(--text-primary)' }}>Target Governed Resource</label>
            <select
              id="resource-select"
              className="form-select"
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.tier} - Max {r.max_duration_hours}h)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Duration Slider */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label" htmlFor="duration-slider" style={{ color: 'var(--text-primary)' }}>Duration (Hours)</label>
              <span className="font-mono" style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>
                {durationHours} hours
              </span>
            </div>
            <input
              type="range"
              id="duration-slider"
              min="1"
              max={selectedResource?.max_duration_hours || 72}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          {/* 3. Purpose */}
          <div className="form-group">
            <label className="form-label" htmlFor="purpose-select" style={{ color: 'var(--text-primary)' }}>Declared Business Purpose</label>
            <select
              id="purpose-select"
              className="form-select"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              {PREDEFINED_PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 4. Justification */}
          <div className="form-group">
            <label className="form-label" htmlFor="justification-input" style={{ color: 'var(--text-primary)' }}>Accountable Justification</label>
            <textarea
              id="justification-input"
              className="form-textarea"
              rows={3}
              placeholder="State the technical architecture, safety precautions, and project need..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              required
            />
            {hasSecretWarning && (
              <div className="secret-warning" id="secret-leak-alert">
                <AlertTriangle size={16} />
                <span>
                  <strong>Secret Pattern Detected!</strong> Avoid pasting API keys, tokens, or credentials into justifications.
                </span>
              </div>
            )}
          </div>

          {/* 5. Limits Bounds */}
          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '1.25rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Resource Limits Specification
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="max-records-input" style={{ color: 'var(--text-primary)' }}>Max Records</label>
              <input
                id="max-records-input"
                type="number"
                className="form-input"
                value={maxRecords}
                onChange={(e) => setMaxRecords(Number(e.target.value))}
                min="1"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="max-rps-input" style={{ color: 'var(--text-primary)' }}>Max RPS (Rate Limit)</label>
              <input
                id="max-rps-input"
                type="number"
                className="form-input"
                value={maxRps}
                onChange={(e) => setMaxRps(Number(e.target.value))}
                min="1"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ip-allowlist-input" style={{ color: 'var(--text-primary)' }}>Client IP / CIDR Allowlist</label>
            <input
              id="ip-allowlist-input"
              type="text"
              className="form-input"
              value={ipAllowlist}
              onChange={(e) => setIpAllowlist(e.target.value)}
              placeholder="10.0.0.0/16, 192.168.1.5"
            />
          </div>

          {/* 6. Required Controls Acknowledgement */}
          {selectedResource?.required_controls && selectedResource.required_controls.length > 0 && (
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-primary)' }}>Mandatory Control Acknowledgements</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                {selectedResource.required_controls.map((ctrl) => (
                  <label key={ctrl} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={acknowledgedControls.includes(ctrl)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAcknowledgedControls([...acknowledgedControls, ctrl]);
                        } else {
                          setAcknowledgedControls(acknowledgedControls.filter((c) => c !== ctrl));
                        }
                      }}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span className="font-mono">{ctrl}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={isSubmitting || hasSecretWarning || !justification.trim()}
            id="submit-request-btn"
          >
            <Send size={16} />
            <span>{isSubmitting ? 'Routing to Review Slots...' : 'Submit Access Request'}</span>
          </button>
        </form>

        {/* Right Advisory Panel: FORGE Hierarchy Routing */}
        <div>
          <div className="surface-card" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} color="var(--accent-wine)" />
              <span>FORGE Hierarchy Approval Routing</span>
            </h4>

            {isLoadingPreview ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>
                Calculating organizational approval path...
              </div>
            ) : approvalPreview ? (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span
                    className="badge"
                    style={{
                      background: approvalPreview.is_crucial ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: approvalPreview.is_crucial ? '#ef4444' : '#10b981',
                      fontWeight: 700,
                    }}
                  >
                    {approvalPreview.is_crucial ? 'CRUCIAL DATA / MULTI-TIER' : 'STANDARD ROUTING'}
                  </span>
                  {approvalPreview.is_cross_dept && (
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700 }}>
                      CROSS-DEPT ESCALATION
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {approvalPreview.is_crucial
                    ? 'This request targets high-sensitivity/crucial assets. Per FORGE Datalog policies, it requires multi-tier escalation to the Immediate Superior, Higher-Level Executive, Resource Owner, and Security Officer.'
                    : 'Standard internal request: requires only immediate manager approval.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {approvalPreview.steps.map((stg, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'var(--bg-subtle)',
                        borderRadius: '6px',
                        padding: '0.75rem 0.9rem',
                        borderLeft: stg.is_crucial_escalation ? '3px solid var(--accent-wine)' : '3px solid var(--accent-emerald)',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Step {stg.level}: {stg.slot_role}
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '0.15rem' }}>
                        {stg.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Reviewer: <code>{stg.assigned_sub}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Select a resource to preview the required organizational approval hierarchy.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

