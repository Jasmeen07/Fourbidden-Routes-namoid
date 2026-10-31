import React, { useState, useEffect } from 'react';
import { PolicyLintReport, PolicyFinding, Resource } from '../types';
import { useAuth } from '../context/AuthContext';
import { BookOpen, CheckCircle2, AlertTriangle, XCircle, Play, Shield, ArrowRight } from 'lucide-react';

export const PolicyLinterPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [report, setReport] = useState<PolicyLintReport | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLinting, setIsLinting] = useState<boolean>(false);
  const [rawYaml, setRawYaml] = useState<string>('');

  // What-if simulator state
  const [simResource, setSimResource] = useState<string>('');
  const [simRole, setSimRole] = useState<string>('ML_ENGINEER');
  const [routingPreview, setRoutingPreview] = useState<string[]>([]);

  const runLinter = async () => {
    setIsLinting(true);
    try {
      const data = await apiFetch('/api/policy/lint');
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLinting(false);
    }
  };

  useEffect(() => {
    runLinter();

    const loadData = async () => {
      try {
        const resData = await apiFetch('/api/resources');
        const list = Array.isArray(resData) ? resData : (resData.resources || []);
        setResources(list);
        if (list.length > 0) {
          setSimResource(list[0].id);
        }

        const policyData = await apiFetch('/api/policy');
        if (policyData.raw_yaml) {
          setRawYaml(policyData.raw_yaml);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, []);

  // Update what-if preview
  useEffect(() => {
    const res = resources.find((r) => r.id === simResource);
    if (!res) {
      setRoutingPreview([]);
      return;
    }

    if (res.tier === 'TIER_1_CRITICAL') {
      setRoutingPreview(['Slot 1: DATA_GOVERNANCE', 'Slot 2: SECURITY_ADMIN', 'Slot 3: EXECUTIVE']);
    } else if (res.tier === 'TIER_2_SENSITIVE') {
      setRoutingPreview(['Slot 1: DATA_GOVERNANCE', 'Slot 2: SECURITY_ADMIN']);
    } else {
      setRoutingPreview(['Slot 1: DATA_GOVERNANCE']);
    }
  }, [simResource, simRole, resources]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Policy-as-Code Assurance & Linter</h1>
          <p className="page-subtitle">
            Automated static analysis for policy rules, role coverage, and multi-tier routing assurance (AI Track Module 4).
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={runLinter}
          disabled={isLinting}
          id="btn-run-linter"
        >
          <Play size={15} />
          <span>{isLinting ? 'Linting Rules...' : 'Run Assurance Linter'}</span>
        </button>
      </div>

      <div className="grid-2">
        {/* Left: Linter Report & Findings */}
        <div>
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                Linter Assessment Summary
              </h3>
              {report && (
                <span className={`badge ${report.is_valid ? 'badge-active' : 'badge-revoked'}`} style={{ fontWeight: 700 }}>
                  {report.is_valid ? 'ASSURANCE VERIFIED' : 'ACTION REQUIRED'}
                </span>
              )}
            </div>

            {report ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
                  Policy version: <strong className="font-mono">{report.version}</strong> | Checked at: <span className="font-mono">{new Date(report.checked_at).toLocaleTimeString()}</span>
                </p>

                {report.findings.length === 0 ? (
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#a7f3d0', fontSize: '0.85rem' }}>
                    <CheckCircle2 size={18} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                    Zero policy violations found. All tiers map to valid review slots and enforce strict Separation of Duties.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {report.findings.map((f, i) => {
                      let icon = <CheckCircle2 size={16} color="#38bdf8" />;
                      let color = '#38bdf8';
                      if (f.level === 'WARN') {
                        icon = <AlertTriangle size={16} color="#f59e0b" />;
                        color = '#f59e0b';
                      } else if (f.level === 'ERROR') {
                        icon = <XCircle size={16} color="#f43f5e" />;
                        color = '#f43f5e';
                      }

                      return (
                        <div
                          key={i}
                          style={{
                            padding: '0.75rem',
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: `1px solid ${color}40`,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.65rem',
                          }}
                        >
                          {icon}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="badge font-mono" style={{ background: `${color}20`, color: color, fontSize: '0.68rem' }}>
                                {f.code}
                              </span>
                              {f.path && <span className="font-mono" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{f.path}</span>}
                            </div>
                            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                              {f.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: '#94a3b8' }}>Running static checks...</p>
            )}
          </div>

          {/* What-If Routing Simulator */}
          <div className="glass-panel">
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} color="#818cf8" />
              <span>What-If Routing Simulator</span>
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Simulate dynamic slot assignment for hypothetical requests under active policy rules.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Resource</label>
                <select
                  className="form-select"
                  value={simResource}
                  onChange={(e) => setSimResource(e.target.value)}
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.tier})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Requester Role</label>
                <select
                  className="form-select"
                  value={simRole}
                  onChange={(e) => setSimRole(e.target.value)}
                >
                  <option value="ML_ENGINEER">ML_ENGINEER</option>
                  <option value="DATA_GOVERNANCE">DATA_GOVERNANCE</option>
                  <option value="SECURITY_ADMIN">SECURITY_ADMIN</option>
                  <option value="COMPLIANCE">COMPLIANCE</option>
                  <option value="EXECUTIVE">EXECUTIVE</option>
                </select>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                Generated Sequential Slots:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {routingPreview.map((slotStr, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#38bdf8' }}>
                    <ArrowRight size={13} color="#6366f1" />
                    <span className="font-mono">{slotStr}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Policy YAML Preview */}
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BookOpen size={18} color="#818cf8" />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              Active Policy-as-Code (config/policy.yaml)
            </h4>
          </div>
          <pre
            className="font-mono"
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              maxHeight: '520px',
              overflowY: 'auto',
            }}
          >
            {rawYaml || '# Loading policy configuration...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
