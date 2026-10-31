import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Resource, ApprovalPreviewResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { Shield, Clock, AlertTriangle, Send, CheckCircle2, ChevronRight, Sparkles, ArrowRight, Check } from 'lucide-react';

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/i,
  /AIzaSy[a-zA-Z0-9_-]{33}/i,
  /ghp_[a-zA-Z0-9]{36}/i,
  /AKIA[0-9A-Z]{16}/,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
  /BEGIN\s+PRIVATE\s+KEY/i,
];

const POLICY_PURPOSES = [
  { code: 'MODEL_EVALUATION', label: 'Model Evaluation & Benchmark' },
  { code: 'BIAS_AUDIT', label: 'Fairness & Bias Audit' },
  { code: 'FRAUD_RULE_TUNING', label: 'Fraud Detection Rule Tuning' },
  { code: 'PROTOTYPE_DEMO', label: 'Prototype Demo & Research' },
  { code: 'SECURITY_REDTEAM_SIM', label: 'Security Red-Teaming Simulation' },
  { code: 'ANALYTICS_REPORTING', label: 'Quarterly Analytics & Reporting' },
];

const RISK_CONTROLS_CATALOG = [
  { code: 'activity_logging', label: 'Activity Logging & PDP Audit Trail' },
  { code: 'synthetic_data_only', label: 'Synthetic Data Only (No Production Data)' },
  { code: 'isolated_workspace', label: 'Isolated Execution Workspace' },
  { code: 'output_filtering', label: 'Output Redaction & Filtering' },
  { code: 'no_export', label: 'No Raw Data Export' },
  { code: 'human_review_of_outputs', label: 'Human-in-the-Loop Review of Outputs' },
  { code: 'retention_limit_declared', label: 'Strict Retention Limit Declared' },
];

export const NewRequestPage: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialResourceId = searchParams.get('resource') || '';

  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>(initialResourceId);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [purposeCode, setPurposeCode] = useState<string>(POLICY_PURPOSES[0].code);
  const [justification, setJustification] = useState<string>('Evaluation of model reasoning and accuracy boundaries for quarterly safety report.');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [acknowledgedControls, setAcknowledgedControls] = useState<string[]>([]);

  const [hasSecretWarning, setHasSecretWarning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
          required_controls: r.required_controls || (r.tier === 'RESTRICTED_SYNTHETIC' ? ['activity_logging', 'synthetic_data_only', 'isolated_workspace'] : ['activity_logging', 'synthetic_data_only']),
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

  // Set default actions and required controls when resource changes
  useEffect(() => {
    if (selectedResource) {
      const acts = (selectedResource.allowed_actions || []).map((a: any) => typeof a === 'string' ? a : a.name);
      setSelectedActions(acts);

      const reqCtrls = selectedResource.required_controls || ['activity_logging', 'synthetic_data_only'];
      setAcknowledgedControls(Array.from(new Set([...reqCtrls, 'activity_logging'])));

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
      } catch {
        setApprovalPreview(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadApprovalPath();
  }, [selectedResourceId, user]);

  const handleActionToggle = (actionName: string) => {
    if (selectedActions.includes(actionName)) {
      if (selectedActions.length > 1) {
        setSelectedActions(selectedActions.filter((a) => a !== actionName));
      }
    } else {
      setSelectedActions([...selectedActions, actionName]);
    }
  };

  const handleControlToggle = (controlCode: string) => {
    if (acknowledgedControls.includes(controlCode)) {
      setAcknowledgedControls(acknowledgedControls.filter((c) => c !== controlCode));
    } else {
      setAcknowledgedControls([...acknowledgedControls, controlCode]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceId) return;
    if (selectedActions.length === 0) {
      setSubmitError('At least one action must be selected.');
      return;
    }
    if (!justification.trim()) {
      setSubmitError('Please provide an accountable business justification.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        resource_id: selectedResourceId,
        purpose_code: purposeCode,
        purpose_text: justification.trim(),
        actions: selectedActions,
        duration_minutes: durationHours * 60,
        risk_controls: acknowledgedControls,
      };

      await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      navigate('/requests');
    } catch (err: any) {
      console.error('Submission failed', err);
      setSubmitError(err?.message || err?.detail?.message || 'Failed to submit request. Please check policy bounds.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowedActionNames = selectedResource
    ? (selectedResource.allowed_actions || []).map((a: any) => (typeof a === 'string' ? a : a.name))
    : [];

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

      {submitError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '8px', color: '#991b1b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{submitError}</span>
        </div>
      )}

      <div className="grid-2">
        {/* Left Form */}
        <form onSubmit={handleSubmit} className="glass-panel" id="request-form" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Request Specification
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

          {/* 2. Actions Selector */}
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Requested Operations (Actions)</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Must be subset of resource actions</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {allowedActionNames.map((act) => (
                <label key={act} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={selectedActions.includes(act)}
                    onChange={() => handleActionToggle(act)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span className="font-mono">{act}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Duration Slider */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label" htmlFor="duration-slider" style={{ color: 'var(--text-primary)' }}>Duration (Hours)</label>
              <span className="font-mono" style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>
                {durationHours} hours ({durationHours * 60} mins)
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

          {/* 4. Purpose Code */}
          <div className="form-group">
            <label className="form-label" htmlFor="purpose-select" style={{ color: 'var(--text-primary)' }}>Declared Business Purpose</label>
            <select
              id="purpose-select"
              className="form-select"
              value={purposeCode}
              onChange={(e) => setPurposeCode(e.target.value)}
            >
              {POLICY_PURPOSES.map((p) => (
                <option key={p.code} value={p.code}>{p.label} ({p.code})</option>
              ))}
            </select>
          </div>

          {/* 5. Justification */}
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

          {/* 6. Required Controls Acknowledgement */}
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-primary)' }}>Mandatory Risk Controls</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {RISK_CONTROLS_CATALOG.map((ctrl) => {
                const isRequired = selectedResource?.required_controls?.includes(ctrl.code);
                return (
                  <label key={ctrl.code} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={acknowledgedControls.includes(ctrl.code)}
                      onChange={() => handleControlToggle(ctrl.code)}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span>{ctrl.label}</span>
                    {isRequired && (
                      <span className="badge font-mono" style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                        REQUIRED
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={isSubmitting || hasSecretWarning || !justification.trim() || selectedActions.length === 0}
            id="submit-request-btn"
          >
            <Send size={16} />
            <span>{isSubmitting ? 'Routing to Review Slots...' : 'Submit Governed Access Request'}</span>
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
                    ? 'This request targets high-sensitivity or crucial assets. Per FORGE Datalog policies, it requires multi-tier escalation to the Immediate Superior, Higher-Level Executive, Resource Owner, and Security Officer.'
                    : 'Standard internal request: requires immediate manager approval.'}
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
