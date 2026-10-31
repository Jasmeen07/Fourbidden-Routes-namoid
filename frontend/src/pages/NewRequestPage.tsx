import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Resource, ResourceLimits, RiskLensEvaluation } from '../types';
import { useAuth } from '../context/AuthContext';
import { RiskLensCard } from '../components/RiskLensCard';
import { Shield, Clock, AlertTriangle, Send, CheckCircle2, ChevronRight, FileCode } from 'lucide-react';

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
  const [riskEvaluation, setRiskEvaluation] = useState<RiskLensEvaluation | null>(null);
  const [isLoadingRisk, setIsLoadingRisk] = useState<boolean>(false);

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
          risk_score: r.risk_score || 50,
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

  // Live Risk Lens evaluation (debounced)
  useEffect(() => {
    if (!selectedResourceId) return;

    const timer = setTimeout(async () => {
      setIsLoadingRisk(true);
      try {
        const payload = {
          resource_id: selectedResourceId,
          duration_hours: durationHours,
          purpose,
          justification: justification || 'Evaluating model fine-tuning with compliance boundaries',
          requested_limits: {
            max_records: maxRecords,
            max_rps: maxRps,
            max_cost_usd: maxCost,
            allowed_formats: allowedFormats,
            ip_allowlist: ipAllowlist.split(',').map((s) => s.trim()).filter(Boolean),
          },
          required_controls: acknowledgedControls,
        };
        const evalResult = await apiFetch('/api/ai/risk-lens/evaluate', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setRiskEvaluation(evalResult);
      } catch (err) {
        // Soft fail on advisory
      } finally {
        setIsLoadingRisk(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [selectedResourceId, durationHours, purpose, justification, maxRecords, maxRps, maxCost, allowedFormats, ipAllowlist, acknowledgedControls]);

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
        <form onSubmit={handleSubmit} className="glass-panel" id="request-form">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem' }}>
            Request Parameters
          </h3>

          {/* 1. Resource Selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="resource-select">Target Governed Resource</label>
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
              <label className="form-label" htmlFor="duration-slider">Duration (Hours)</label>
              <span className="font-mono" style={{ color: '#818cf8', fontWeight: 700 }}>
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
              style={{ width: '100%', accentColor: '#6366f1' }}
            />
          </div>

          {/* 3. Purpose */}
          <div className="form-group">
            <label className="form-label" htmlFor="purpose-select">Declared Business Purpose</label>
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
            <label className="form-label" htmlFor="justification-input">Accountable Justification</label>
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
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8', marginTop: '1.25rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Resource Limits Specification
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="max-records-input">Max Records</label>
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
              <label className="form-label" htmlFor="max-rps-input">Max RPS (Rate Limit)</label>
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
            <label className="form-label" htmlFor="ip-allowlist-input">Client IP / CIDR Allowlist</label>
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
              <label className="form-label">Mandatory Control Acknowledgements</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(15,23,42,0.6)', padding: '0.75rem', borderRadius: '8px' }}>
                {selectedResource.required_controls.map((ctrl) => (
                  <label key={ctrl} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
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

        {/* Right Advisory Panel */}
        <div>
          <RiskLensCard
            evaluation={riskEvaluation}
            isLoading={isLoadingRisk}
            onApplyRecommendation={(rec) => {
              if (rec.dimension === 'duration_hours') {
                setDurationHours(Number(rec.suggested_value));
              } else if (rec.dimension === 'max_records') {
                setMaxRecords(Number(rec.suggested_value));
              }
            }}
          />

          <div className="glass-panel" style={{ marginTop: '1.25rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} color="#818cf8" />
              <span>Multi-Party Approval Routing</span>
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              Upon submission, GrantGate will automatically route this request through policy-governed review slots based on resource criticality:
            </p>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div>• <strong>Tier 1 Critical:</strong> 3 sequential slots (Data Gov → Security Admin → Executive CISO)</div>
              <div>• <strong>Tier 2 Sensitive:</strong> 2 sequential slots (Data Gov → Security Admin)</div>
              <div>• <strong>Tier 3 Standard:</strong> 1 review slot (Data Gov)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
