import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grant, PdpDecisionTrace } from '../types';
import { useAuth } from '../context/AuthContext';
import { DecisionTraceViewer } from '../components/DecisionTraceViewer';
import { Terminal, Send, CheckCircle2, ShieldAlert, AlertTriangle, Play } from 'lucide-react';

const COMMON_PURPOSES = [
  'Customer Support Chatbot Fine-Tuning',
  'Fraud Detection Model Evaluation',
  'Quarterly Financial Analysis & Reporting',
  'Safety & Red-Teaming Research',
  'Medical Imaging Diagnostics Verification',
  'Wrong / Undeclared Purpose Test',
];

export const SimulatorPage: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialGrantId = searchParams.get('grant') || '';

  const [grants, setGrants] = useState<Grant[]>([]);
  const [selectedGrantId, setSelectedGrantId] = useState<string>(initialGrantId);
  const [action, setAction] = useState<string>('inference');
  const [declaredPurpose, setDeclaredPurpose] = useState<string>(COMMON_PURPOSES[0]);
  const [clientIp, setClientIp] = useState<string>('10.0.4.15');
  const [samplePayload, setSamplePayload] = useState<string>('{\n  "prompt": "Evaluate governance boundaries for multi-tenant deployment",\n  "max_tokens": 128\n}');

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [decisionTrace, setDecisionTrace] = useState<PdpDecisionTrace | null>(null);

  useEffect(() => {
    const fetchGrants = async () => {
      try {
        const res = await apiFetch('/api/grants');
        setGrants(res.grants || []);
        if (!selectedGrantId && res.grants?.length > 0) {
          setSelectedGrantId(res.grants[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchGrants();
  }, []);

  const selectedGrant = grants.find((g) => g.id === selectedGrantId);

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
    } catch (err: any) {
      // If backend returned DENY via error response or decision trace in problem details
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
            Simulate runtime requests against active grants, test boundary conditions, and observe ordered PDP decision traces.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left: Invocation Parameters Form */}
        <form onSubmit={handleSimulate} className="glass-panel" id="sim-form">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '0.4rem', borderRadius: '8px', color: '#818cf8' }}>
              <Terminal size={18} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
              Simulated PEP Invocation
            </h3>
          </div>

          {/* 1. Grant Selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="sim-grant-select">Target Governed Grant</label>
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
            <label className="form-label" htmlFor="sim-action-select">Invocation Action</label>
            <select
              id="sim-action-select"
              className="form-select"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="inference">inference (Execute model query)</option>
              <option value="query">query (Read dataset records)</option>
              <option value="fine_tune">fine_tune (Train adaptation weights)</option>
              <option value="train">train (Full parameter training)</option>
              <option value="export">export (Bulk export payload)</option>
              <option value="unauthorized_action">unauthorized_action (Deliberate test)</option>
            </select>
          </div>

          {/* 3. Declared Purpose */}
          <div className="form-group">
            <label className="form-label" htmlFor="sim-purpose-select">Declared Runtime Purpose</label>
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
            <label className="form-label" htmlFor="sim-ip-input">Client Source IP</label>
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
            <label className="form-label" htmlFor="sim-payload-input">Request Payload (JSON)</label>
            <textarea
              id="sim-payload-input"
              className="form-textarea font-mono"
              rows={4}
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
            <span>{isExecuting ? 'Evaluating PDP...' : 'Send Request to PEP Gateway'}</span>
          </button>
        </form>

        {/* Right: PDP Explanation & Guide */}
        <div>
          <div className="glass-panel">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
              Deterministic PDP Evaluation Order
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              The Policy Decision Point (PDP) enforces security decisions through a rigorous short-circuit sequence:
            </p>
            <ol style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li><strong>Grant Existence & Active State:</strong> Revoked grants fail immediately with <code>GRANT_REVOKED</code>.</li>
              <li><strong>Subject Identity:</strong> Requesters cannot impersonate other principals.</li>
              <li><strong>Resource Bound:</strong> Validates target resource matches grant authorization.</li>
              <li><strong>Action Entitlement:</strong> Verifies requested action is within granted scope.</li>
              <li><strong>Purpose Alignment:</strong> Verifies declared runtime purpose matches approved scope.</li>
              <li><strong>Limits & IP Verification:</strong> Enforces CIDR bounds, rate limits, and record limits.</li>
            </ol>
          </div>

          {/* Live Decision Trace Viewer */}
          <DecisionTraceViewer trace={decisionTrace} />
        </div>
      </div>
    </div>
  );
};
