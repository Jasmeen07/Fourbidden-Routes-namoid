import React, { useState, useEffect } from 'react';
import {
  Users,
  Bot,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Key,
  ShieldCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Principal, ApprovalPreviewResponse } from '../types';

export const HierarchyPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [departments, setDepartments] = useState<Record<string, Principal[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Approval Path Simulator state
  const [simRequester, setSimRequester] = useState<string>('AG102');
  const [simResource, setSimResource] = useState<string>('finance.csv');
  const [simPreview, setSimPreview] = useState<ApprovalPreviewResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    fetchHierarchy();
  }, []);

  useEffect(() => {
    if (simRequester && simResource) {
      previewApproval();
    }
  }, [simRequester, simResource]);

  const fetchHierarchy = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/hierarchy');
      setPrincipals(data.principals || []);
      setDepartments(data.departments || {});
    } catch (err) {
      console.error('Failed to load hierarchy:', err);
    } finally {
      setLoading(false);
    }
  };

  const previewApproval = async () => {
    setSimLoading(true);
    try {
      const res = await apiFetch(`/api/hierarchy/preview-approval?requester_id=${simRequester}&resource_id=${simResource}`);
      setSimPreview(res);
    } catch (err) {
      console.error('Failed to preview approval:', err);
      setSimPreview(null);
    } finally {
      setSimLoading(false);
    }
  };

  const humanPrincipals = principals.filter((p) => !p.is_agent);
  const agentPrincipals = principals.filter((p) => p.is_agent);

  const deptList = Object.keys(departments);

  return (
    <div className="page-container" id="hierarchy-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Enterprise Organizational Hierarchy & AI Agent Governance</h1>
          <p className="page-subtitle">
            Accountable Human-AI Agent pairing, delegated authority constraints, and hierarchy-based approval routing.
          </p>
        </div>
      </div>

      {/* Top Stats Banner */}
      <div className="grid-3-col" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-wine)' }}>
          <div className="stat-label">
            <Users size={16} /> Human Employees
          </div>
          <div className="stat-val">{humanPrincipals.length}</div>
          <div className="stat-sub">Executives, Managers, Engineers & Analysts</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
          <div className="stat-label">
            <Bot size={16} /> Autonomous AI Agents
          </div>
          <div className="stat-val">{agentPrincipals.length}</div>
          <div className="stat-sub">100% paired with accountable human owners</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
          <div className="stat-label">
            <ShieldCheck size={16} /> FORGE Policy Rule
          </div>
          <div className="stat-val" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Immediate Superior Routing
          </div>
          <div className="stat-sub">Crucial data escalates to Executive, Owner & Security</div>
        </div>
      </div>

      {/* Interactive Approval Path Simulator */}
      <div className="surface-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Sparkles size={20} color="var(--accent-wine)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Live Hierarchy Approval Path Simulator
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Demonstrates how the FORGE PDP dynamically decides between <strong>Immediate Superior</strong> approval
          (routine internal requests) and <strong>Multi-Tier Escalation</strong> (crucial data like <code>finance.csv</code> or cross-department access).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Select Requester (Human or AI Agent):
            </label>
            <select
              value={simRequester}
              onChange={(e) => setSimRequester(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '0.6rem' }}
            >
              <optgroup label="AI Agents (with Human Owners)">
                <option value="AG102">AG102 (Engineering AI Agent - Owner: E102 Developer)</option>
                <option value="AG201">AG201 (Finance AI Agent - Owner: E201 Analyst)</option>
                <option value="AG301">AG301 (Network AI Agent - Owner: E301 Network Admin)</option>
              </optgroup>
              <optgroup label="Human Employees">
                <option value="E102">E102 (Developer David - Engineering)</option>
                <option value="E201">E201 (Analyst Heidi - Finance)</option>
                <option value="E301">E301 (Admin Judy - Network)</option>
                <option value="E050">E050 (Engineering Manager Charlie)</option>
                <option value="E060">E060 (Finance Manager Grace)</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Select Target Resource:
            </label>
            <select
              value={simResource}
              onChange={(e) => setSimResource(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '0.6rem' }}
            >
              <option value="engineering.csv">engineering.csv (Engineering - Non-Crucial)</option>
              <option value="network_logs.csv">network_logs.csv (Network - Non-Crucial)</option>
              <option value="finance.csv">finance.csv (Finance - CRITICAL / Crucial Data)</option>
              <option value="D-claims-synth">D-claims-synth (Finance - RESTRICTED / Crucial Data)</option>
            </select>
          </div>
        </div>

        {simLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
            Evaluating FORGE hierarchy rules...
          </div>
        ) : simPreview ? (
          <div style={{ background: 'var(--bg-subtle)', borderRadius: '8px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  className="badge"
                  style={{
                    background: simPreview.is_crucial ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: simPreview.is_crucial ? '#ef4444' : '#10b981',
                    fontWeight: 700,
                  }}
                >
                  {simPreview.is_crucial ? 'CRUCIAL DATA / ESCALATED' : 'STANDARD INTERNAL ACCESS'}
                </span>
                {simPreview.is_cross_dept && (
                  <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700 }}>
                    CROSS-DEPARTMENT ACCESS
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Required Review Slots: <strong>{simPreview.steps.length}</strong>
              </div>
            </div>

            {/* Step Pipeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {simPreview.steps.map((stg, idx) => (
                <React.Fragment key={idx}>
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      padding: '0.85rem 1.1rem',
                      borderRadius: '8px',
                      border: stg.is_crucial_escalation ? '2px solid var(--accent-wine)' : '1px solid var(--border-color)',
                      minWidth: '200px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-wine)', textTransform: 'uppercase' }}>
                      Level {stg.level}: {stg.slot_role}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem' }}>
                      {stg.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Assigned: <code>{stg.assigned_sub}</code>
                    </div>
                  </div>
                  {idx < simPreview.steps.length - 1 && (
                    <ArrowRight size={20} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {simPreview.is_crucial
                ? 'FORGE Policy: Sensitive datasets require multi-stage approval from Immediate Superior, Executive Authority, Resource Owner, and Independent Security Officer (R001).'
                : 'FORGE Policy: Standard same-department non-crucial requests only require immediate manager approval.'}
            </div>
          </div>
        ) : null}
      </div>

      {/* Department Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedDept('ALL')}
          className={`btn-filter ${selectedDept === 'ALL' ? 'active' : ''}`}
        >
          All Departments ({principals.length})
        </button>
        {deptList.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDept(d)}
            className={`btn-filter ${selectedDept === d ? 'active' : ''}`}
          >
            {d} ({departments[d]?.length || 0})
          </button>
        ))}
      </div>

      {/* Principals Grid */}
      <div className="grid-2-col" style={{ gap: '1.25rem' }}>
        {principals
          .filter((p) => selectedDept === 'ALL' || p.department === selectedDept)
          .map((p) => (
            <div
              key={p.id}
              className="surface-card"
              style={{
                padding: '1.25rem',
                borderLeft: p.is_agent ? '4px solid var(--accent-emerald)' : '4px solid var(--accent-wine)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {p.is_agent ? <Bot size={22} color="#10b981" /> : <UserCheck size={22} color="var(--accent-wine)" />}
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{p.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      ID: <code>{p.id}</code> &bull; Dept: <strong>{p.department}</strong>
                    </span>
                  </div>
                </div>

                <span
                  className="badge"
                  style={{
                    background: p.is_agent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(197, 59, 59, 0.15)',
                    color: p.is_agent ? '#10b981' : 'var(--accent-wine)',
                    fontWeight: 700,
                  }}
                >
                  {p.is_agent ? 'AI AGENT' : p.role.toUpperCase()}
                </span>
              </div>

              {p.is_agent ? (
                <div style={{ background: 'var(--bg-subtle)', borderRadius: '6px', padding: '0.85rem', marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    Accountable Human Owner: <strong>{p.owner_id}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Delegated Permissions Constraint (FORGE §7.3):
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {p.delegated_permissions && p.delegated_permissions.length > 0 ? (
                      p.delegated_permissions.map((act) => (
                        <span
                          key={act}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                          }}
                        >
                          <Key size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {act}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No permissions delegated</span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>
                    Reports to Manager: <strong>{p.manager_id || 'None (Executive Board)'}</strong>
                  </div>
                  {p.owned_agents && p.owned_agents.length > 0 && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Owned Autonomous Agents:</span>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                        {p.owned_agents.map((ag) => (
                          <span key={ag.id} className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                            <Bot size={12} style={{ marginRight: '4px', display: 'inline' }} />
                            {ag.name} ({ag.id})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
