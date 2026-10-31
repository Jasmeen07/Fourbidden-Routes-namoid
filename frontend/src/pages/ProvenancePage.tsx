import React, { useState, useEffect } from 'react';
import {
  Share2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Globe,
  Radio,
  FileText,
  Lock,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProvenanceEventNode, ProvenanceEventEdge } from '../types';

export const ProvenancePage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [nodes, setNodes] = useState<ProvenanceEventNode[]>([]);
  const [edges, setEdges] = useState<ProvenanceEventEdge[]>([]);
  const [approvedDestinations, setApprovedDestinations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Network Guardrails Interactive Evaluator
  const [testEventId, setTestEventId] = useState<string>('evt_send_external');
  const [testDestination, setTestDestination] = useState<string>('https://attacker.evil.com/exfil');
  const [evalResult, setEvalResult] = useState<any | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    fetchGraph();
  }, []);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/provenance/events');
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setApprovedDestinations(data.approved_destinations || []);
    } catch (err) {
      console.error('Failed to load provenance graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setEvalLoading(true);
    try {
      const res = await apiFetch('/api/provenance/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          event_id: testEventId,
          action: 'external_send',
          target_destination: testDestination,
        }),
      });
      setEvalResult(res);
    } catch (err) {
      console.error('Evaluation error:', err);
      setEvalResult(null);
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="page-container" id="provenance-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Event Dependency Graphs & Network Team Guardrails</h1>
          <p className="page-subtitle">
            Causal event provenance, dynamic taint and confidentiality secret propagation, and reference monitor network guardrails.
          </p>
        </div>
        <button onClick={fetchGraph} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} /> Refresh Graph
        </button>
      </div>

      {/* Policy Notice Box */}
      <div
        className="surface-card"
        style={{
          borderLeft: '4px solid var(--accent-wine)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <Radio size={24} color="var(--accent-wine)" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            FORGE Complete Mediation Datalog Rule: <code>Deny(a) :- ExternalSend(a), Tainted(a), HasSecret(a)</code>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            If an AI Agent interacts with an untrusted prompt or message and then reads confidential data, the event graph automatically propagates
            taint and secret tags. Any subsequent attempt to transmit this payload to an external destination is strictly intercepted and blocked.
          </div>
        </div>
      </div>

      {/* Visual Dependency Graph Nodes */}
      <div className="surface-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Share2 size={18} color="var(--accent-wine)" /> Provenance Event Dependency Pipeline
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading provenance graph nodes and causal dependencies...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {nodes.map((node) => {
              const isTainted = node.is_tainted || (node.propagated_labels && node.propagated_labels.includes('tainted'));
              const hasSecret = node.has_secret || (node.propagated_labels && node.propagated_labels.includes('has_secret'));

              return (
                <div
                  key={node.id}
                  style={{
                    background: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: isTainted && hasSecret ? '2px solid #ef4444' : isTainted ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <code style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-wine)' }}>{node.id}</code>
                    <span className="badge" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      {node.event_type}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Principal: <strong>{node.principal_id}</strong>
                  </div>
                  {node.action && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Action: <code>{node.action}</code>
                    </div>
                  )}
                  {node.target_destination && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Target: <code>{node.target_destination}</code>
                    </div>
                  )}

                  {/* Initial Label Tag */}
                  <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background:
                          node.label === 'untrusted_input'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : node.label === 'sensitive_input'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)',
                        color:
                          node.label === 'untrusted_input'
                            ? '#f59e0b'
                            : node.label === 'sensitive_input'
                            ? '#ef4444'
                            : '#10b981',
                      }}
                    >
                      Source: {node.label}
                    </span>
                  </div>

                  {/* Propagated Labels */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {isTainted && (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.7rem' }}>
                        Tainted(e)
                      </span>
                    )}
                    {hasSecret && (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.7rem' }}>
                        HasSecret(e)
                      </span>
                    )}
                    {!isTainted && !hasSecret && (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.7rem' }}>
                        Clean
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Network Guardrail Evaluation */}
      <div className="surface-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={18} color="var(--accent-wine)" /> Network Team Guardrails Live Test
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Evaluate candidate external network transmissions against destination allowlists and information-flow taint exfiltration policies.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Candidate Event Node:
            </label>
            <select
              value={testEventId}
              onChange={(e) => setTestEventId(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '0.6rem' }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id} ({n.event_type} - {n.label})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Outbound Destination:
            </label>
            <select
              value={testDestination}
              onChange={(e) => setTestDestination(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '0.6rem' }}
            >
              <optgroup label="Unapproved / Exfiltration Targets">
                <option value="https://attacker.evil.com/exfil">https://attacker.evil.com/exfil (Untrusted)</option>
                <option value="https://pastebin.com/leak">https://pastebin.com/leak (Public Dump)</option>
              </optgroup>
              <optgroup label="Approved Corporate Allowlist">
                {approvedDestinations.map((d) => (
                  <option key={d} value={d}>
                    {d} (Allowlisted)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={evalLoading}
          className="btn-primary"
          style={{ marginBottom: '1.25rem' }}
        >
          {evalLoading ? 'Checking Network Guardrail...' : 'Evaluate Network Guardrail'}
        </button>

        {/* Evaluation Output */}
        {evalResult && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '8px',
              border: evalResult.status === 'ALLOWED' ? '1px solid #10b981' : '1px solid #ef4444',
              background: evalResult.status === 'ALLOWED' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              {evalResult.status === 'ALLOWED' ? (
                <ShieldCheck size={20} color="#10b981" />
              ) : (
                <ShieldAlert size={20} color="#ef4444" />
              )}
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: evalResult.status === 'ALLOWED' ? '#10b981' : '#ef4444',
                }}
              >
                VERDICT: {evalResult.status}
              </h3>
            </div>

            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
              <strong>Policy Reason:</strong> {evalResult.reason}
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Enforced Policy Rule: <code>{evalResult.policy}</code>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <span className="badge" style={{ background: evalResult.tainted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)' }}>
                Tainted: {evalResult.tainted ? 'TRUE' : 'FALSE'}
              </span>
              <span className="badge" style={{ background: evalResult.has_secret ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }}>
                HasSecret: {evalResult.has_secret ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
