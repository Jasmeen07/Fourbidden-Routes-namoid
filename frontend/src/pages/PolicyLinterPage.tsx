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
          <div className="glass-panel" style={{ marginBottom: '1.5rem', background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Linter Assessment Summary
              </h3>
              {report && (
                <span className={`badge ${report.is_valid ? 'badge-active' : 'badge-revoked'}`} style={{ fontWeight: 800 }}>
                  {report.is_valid ? 'ASSURANCE VERIFIED' : 'ACTION REQUIRED'}
                </span>
              )}
            </div>

            {report ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Policy version: <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>{report.version}</strong> | Checked at: <span className="font-mono">{new Date(report.checked_at).toLocaleTimeString()}</span>
                </p>

                {report.findings.length === 0 ? (
                  <div style={{ padding: '1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)', color: '#065f46', fontSize: '0.85rem' }}>
                    <CheckCircle2 size={18} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                    Zero policy violations found. All tiers map to valid review slots and enforce strict Separation of Duties.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {report.findings.map((f, i) => {
                      let icon = <CheckCircle2 size={16} color="var(--accent-cyan)" />;
                      let color = 'var(--accent-cyan)';
                      let bg = '#f0f9ff';
                      let border = '#bae6fd';
                      if (f.level === 'WARN') {
                        icon = <AlertTriangle size={16} color="var(--accent-amber)" />;
                        color = 'var(--accent-amber)';
                        bg = '#fffbeb';
                        border = '#fde68a';
                      } else if (f.level === 'ERROR') {
                        icon = <XCircle size={16} color="var(--accent-rose)" />;
                        color = 'var(--accent-rose)';
                        bg = '#fff1f2';
                        border = '#fecdd3';
                      }

                      return (
                        <div
                          key={i}
                          style={{
                            padding: '0.75rem',
                            background: bg,
                            border: `1px solid ${border}`,
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.65rem',
                          }}
                        >
                          {icon}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="badge font-mono" style={{ background: '#ffffff', color: color, fontSize: '0.68rem', border: `1px solid ${border}` }}>
                                {f.code}
                              </span>
                              {f.path && <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{f.path}</span>}
                            </div>
                            <p style={{ fontSize: '0.825rem', color: 'var(--text-primary)', marginTop: '0.25rem', margin: 0 }}>
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
              <p style={{ color: 'var(--text-secondary)' }}>Running static checks...</p>
            )}
          </div>

          {/* What-If Routing Simulator */}
          <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} color="var(--accent-primary)" />
              <span>What-If Routing Simulator</span>
            </h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Simulate dynamic slot assignment for hypothetical requests under active policy rules.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>Resource</label>
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
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>Requester Role</label>
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

            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem', margin: 0 }}>
                Generated Sequential Slots:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
                {routingPreview.map((slotStr, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                    <ArrowRight size={13} color="var(--accent-primary)" />
                    <span className="font-mono" style={{ fontWeight: 600 }}>{slotStr}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Policy YAML Preview */}
        <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BookOpen size={18} color="var(--accent-primary)" />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Active Policy-as-Code (config/policy.yaml)
            </h4>
          </div>
          <pre
            className="font-mono"
            style={{
              background: 'var(--bg-secondary)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              maxHeight: '520px',
              overflowY: 'auto',
              margin: 0,
            }}
          >
            {rawYaml || '# Loading policy configuration...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
