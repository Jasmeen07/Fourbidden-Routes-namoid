import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grant, PdpDecisionTrace } from '../types';
import { useAuth } from '../context/AuthContext';
import { DecisionTraceViewer } from '../components/DecisionTraceViewer';
import { 
  Terminal, 
  Send, 
  CheckCircle2, 
  ShieldAlert, 
  AlertTriangle, 
  Play, 
  ShieldX, 
  Sparkles, 
  ShieldCheck, 
  Flame, 
  RefreshCw,
  BellRing
} from 'lucide-react';

const COMMON_PURPOSES = [
  'Customer Support Chatbot Fine-Tuning',
  'Fraud Detection Model Evaluation',
  'Quarterly Financial Analysis & Reporting',
  'Safety & Red-Teaming Research',
  'Medical Imaging Diagnostics Verification',
  'Unauthorized Commercial Extraction / Secondary Monetization',
];

interface ViolationEvent {
  seq: number;
  ts: string;
  actor_sub: string;
  resource_id: string;
  action: string;
  declared_purpose: string;
  decision_code: string;
  grant_id?: string;
}

export const SimulatorPage: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialGrantId = searchParams.get('grant') || '';

  const [grants, setGrants] = useState<Grant[]>([]);
  const [selectedGrantId, setSelectedGrantId] = useState<string>(initialGrantId);
  const [action, setAction] = useState<string>('query');
  const [declaredPurpose, setDeclaredPurpose] = useState<string>(COMMON_PURPOSES[0]);
  const [clientIp, setClientIp] = useState<string>('10.0.4.15');
  const [samplePayload, setSamplePayload] = useState<string>('{\n  "prompt": "Evaluate governance boundaries for multi-tenant deployment",\n  "max_tokens": 128\n}');

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [decisionTrace, setDecisionTrace] = useState<PdpDecisionTrace | null>(null);
  const [recentViolations, setRecentViolations] = useState<ViolationEvent[]>([]);
  const [isLoadingViolations, setIsLoadingViolations] = useState<boolean>(false);

  const fetchGrants = async () => {
    try {
      const res = await apiFetch('/api/grants');
      const list = res.grants || [];
      setGrants(list);
      if (!selectedGrantId && list.length > 0) {
        setSelectedGrantId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchViolations = async () => {
    setIsLoadingViolations(true);
    try {
      const list = await apiFetch('/api/sim/violations');
      setRecentViolations(list || []);
    } catch (err) {
      // Soft fail
    } finally {
      setIsLoadingViolations(false);
    }
  };

  useEffect(() => {
    fetchGrants();
    fetchViolations();
  }, []);

  const selectedGrant = grants.find((g) => g.id === selectedGrantId);

  // 1-Click Preset Scenarios (Innovation 4)
  const applyPresetScenario = (scenario: 'legitimate' | 'purpose_mismatch' | 'scope_exceeded' | 'zombie') => {
    if (!selectedGrant && grants.length > 0) {
      setSelectedGrantId(grants[0].id);
    }

    if (scenario === 'legitimate') {
      setAction('query');
      setDeclaredPurpose('Customer Support Chatbot Fine-Tuning');
    } else if (scenario === 'purpose_mismatch') {
      setAction('query');
      setDeclaredPurpose('Unauthorized Commercial Extraction / Secondary Monetization');
    } else if (scenario === 'scope_exceeded') {
      setAction('export');
      setDeclaredPurpose('Customer Support Chatbot Fine-Tuning');
    } else if (scenario === 'zombie') {
      // Try to find a revoked or expired grant, or simulate with current
      const deadGrant = grants.find(g => g.effective_status === 'REVOKED' || g.effective_status === 'EXPIRED');
      if (deadGrant) {
        setSelectedGrantId(deadGrant.id);
      }
      setAction('query');
      setDeclaredPurpose('Customer Support Chatbot Fine-Tuning');
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrantId) return;

    setIsExecuting(true);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(samplePayload);
      } catch {
        parsedPayload = { raw: samplePayload };
      }

      const simPayload = {
        grant_id: selectedGrantId,
        action,
        declared_purpose: declaredPurpose,
        client_ip: clientIp,
        resource_id: selectedGrant?.resource_id,
        payload: parsedPayload,
      };

      const result = await apiFetch('/api/sim/invoke', {
        method: 'POST',
        body: JSON.stringify(simPayload),
      });

      setDecisionTrace(result.decision_trace || result);
      // Refresh violations list to catch newly logged violations
      fetchViolations();
    } catch (err: any) {
      if (err.trace || err.decision_trace) {
        setDecisionTrace(err.trace || err.decision_trace);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Policy Enforcement Point (PEP) Simulator</h1>
          <p className="page-subtitle">
            Simulate runtime requests, enforce purpose bounds, detect scope violations, and observe ordered PDP decision traces (Innovation 4).
          </p>
        </div>
      </div>

      {/* Preset Scenario Quick-Bar (Innovation 4) */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            <Sparkles size={16} color="var(--accent-primary)" />
            <span>Preset Verification Scenarios (Innovation 4: Purpose & Scope Enforcement):</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to auto-configure test inputs</span>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => applyPresetScenario('legitimate')}
            style={{ borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5' }}
          >
            <ShieldCheck size={14} />
            <span>Legitimate Access (In-Scope) &rarr; ALLOW</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => applyPresetScenario('purpose_mismatch')}
            style={{ borderColor: '#fed7aa', color: '#c2410c', background: '#fff7ed' }}
          >
            <ShieldAlert size={14} />
            <span>Purpose Mismatch Violation &rarr; DENY</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => applyPresetScenario('scope_exceeded')}
            style={{ borderColor: '#fecdd3', color: '#be123c', background: '#fff1f2' }}
          >
            <ShieldX size={14} />
            <span>Scope Exceeded (Export) &rarr; DENY</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => applyPresetScenario('zombie')}
            style={{ borderColor: '#e2e8f0', color: '#475569', background: '#f8fafc' }}
          >
            <Flame size={14} />
            <span>Zombie Access (Revoked) &rarr; DENY</span>
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Left: Invocation Parameters Form */}
        <form onSubmit={handleSimulate} className="glass-panel" id="sim-form" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <div style={{ background: '#ffedd5', padding: '0.45rem', borderRadius: '8px', color: 'var(--accent-primary)' }}>
              <Terminal size={18} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Simulated PEP Invocation
            </h3>
          </div>

          {/* 1. Grant Selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="sim-grant-select" style={{ color: 'var(--text-primary)' }}>Target Governed Grant</label>
            <select
              id="sim-grant-select"
              className="form-select"
              value={selectedGrantId}
              onChange={(e) => setSelectedGrantId(e.target.value)}
            >
              {grants.length === 0 ? (
                <option value="">No grants available (submit a request first)</option>
              ) : (
                grants.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.resource_name || g.resource_id} — {g.effective_status || g.status} ({g.id.slice(0, 8)}...)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Action Selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="sim-action-select" style={{ color: 'var(--text-primary)' }}>Invocation Action</label>
            <select
              id="sim-action-select"
              className="form-select"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="query">query (Read dataset records)</option>
              <option value="inference">inference (Execute model query)</option>
              <option value="fine_tune">fine_tune (Train adaptation weights)</option>
              <option value="train">train (Full parameter training)</option>
              <option value="export">export (Bulk export payload — High Risk)</option>
              <option value="unauthorized_action">unauthorized_action (Deliberate test)</option>
            </select>
          </div>

          {/* 3. Declared Purpose */}
          <div className="form-group">
            <label className="form-label" htmlFor="sim-purpose-select" style={{ color: 'var(--text-primary)' }}>Declared Runtime Purpose</label>
            <select
              id="sim-purpose-select"
              className="form-select"
              value={declaredPurpose}
              onChange={(e) => setDeclaredPurpose(e.target.value)}
            >
              {COMMON_PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 4. Client IP */}
          <div className="form-group">
            <label className="form-label" htmlFor="sim-ip-input" style={{ color: 'var(--text-primary)' }}>Client Source IP</label>
            <input
              id="sim-ip-input"
              type="text"
              className="form-input"
              value={clientIp}
              onChange={(e) => setClientIp(e.target.value)}
            />
          </div>

          {/* 5. Sample Payload */}
          <div className="form-group">
            <label className="form-label" htmlFor="sim-payload-input" style={{ color: 'var(--text-primary)' }}>Request Payload (JSON)</label>
            <textarea
              id="sim-payload-input"
              className="form-textarea font-mono"
              rows={3}
              value={samplePayload}
              onChange={(e) => setSamplePayload(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isExecuting || !selectedGrantId}
            id="btn-run-sim"
          >
            <Play size={16} />
            <span>{isExecuting ? 'Evaluating PDP Pipeline...' : 'Send Request to PEP Gateway'}</span>
          </button>
        </form>

        {/* Right: PDP Explanation & Guide */}
        <div>
          <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Deterministic PDP Evaluation Order (§6.6)
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              The Policy Decision Point (PDP) enforces runtime access through a rigorous deterministic short-circuit sequence:
            </p>
            <ol style={{ paddingLeft: '1.25rem', fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: 0 }}>
              <li><strong>Grant Existence & Active State:</strong> Revoked grants fail immediately with <code>DENY_GRANT_REVOKED</code>.</li>
              <li><strong>Subject Identity:</strong> Requesters cannot impersonate other principals.</li>
              <li><strong>Resource Bound:</strong> Validates target resource matches grant authorization.</li>
              <li><strong>Action Entitlement:</strong> Verifies requested action is in approved grant action set.</li>
              <li><strong>Purpose Alignment (Inno 4):</strong> Verifies declared runtime purpose matches approved scope.</li>
              <li><strong>Limits & IP Verification:</strong> Enforces CIDR bounds, rate limits, and record limits.</li>
            </ol>
          </div>

          {/* Live Decision Trace Viewer */}
          <DecisionTraceViewer trace={decisionTrace} />

          {/* Innovation 4: Recent Violations Stream */}
          <div className="glass-panel" style={{ marginTop: '1.5rem', background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <BellRing size={16} color="var(--accent-rose)" />
                <span>Recent Purpose & Scope Violations (Innovation 4)</span>
              </div>
              <button 
                type="button" 
                onClick={fetchViolations} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Refresh violations"
              >
                <RefreshCw size={14} className={isLoadingViolations ? 'spin' : ''} />
              </button>
            </div>

            {recentViolations.length === 0 ? (
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                No runtime access violations recorded yet. Run a violation preset above to test alert logging.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {recentViolations.slice(0, 4).map((v) => (
                  <div key={v.seq} style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#9f1239' }}>{v.decision_code}</span>
                      <span className="font-mono" style={{ fontSize: '0.7rem', color: '#be123c' }}>
                        {new Date(v.ts).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Actor: <strong>{v.actor_sub}</strong> | Action: <code>{v.action}</code> | Resource: <code>{v.resource_id}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
