import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Globe,
  Radio,
  FileText,
  Lock,
  Cpu,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  Info,
  Server,
  Zap,
  Terminal,
  Code2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ProvenanceEventNode,
  ProvenanceEventEdge,
  ProvenanceSecurityAlert,
  ProvenanceAuditItem,
  ProvenanceKpis,
} from '../types';

export const ProvenancePage: React.FC = () => {
  const { apiFetch } = useAuth();

  // Primary data states
  const [nodes, setNodes] = useState<ProvenanceEventNode[]>([]);
  const [edges, setEdges] = useState<ProvenanceEventEdge[]>([]);
  const [approvedDestinations, setApprovedDestinations] = useState<string[]>([]);
  const [guardrailRule, setGuardrailRule] = useState<string>('Deny(a) :- ExternalSend(a), Tainted(a), HasSecret(a)');
  const [kpis, setKpis] = useState<ProvenanceKpis | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<ProvenanceSecurityAlert[]>([]);
  const [auditTrail, setAuditTrail] = useState<ProvenanceAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'graph' | 'guardrails' | 'alerts' | 'audit'>('graph');

  // Selected Node for Drawer / Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Network Guardrails Interactive Evaluator State
  const [testEventId, setTestEventId] = useState<string>('evt_send_external');
  const [testAction, setTestAction] = useState<string>('external_send');
  const [testDestination, setTestDestination] = useState<string>('https://unknown-exfil.org/webhook');
  const [customDestination, setCustomDestination] = useState<string>('');
  const [evalResult, setEvalResult] = useState<any | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  // Filter & Search states for Alerts
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>('ALL');
  const [alertSearch, setAlertSearch] = useState<string>('');

  // Filter & Search states for Audit Trail
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditLabelFilter, setAuditLabelFilter] = useState<string>('ALL');
  const [auditDecisionFilter, setAuditDecisionFilter] = useState<string>('ALL');

  // Selected Audit Payload Modal
  const [inspectAuditItem, setInspectAuditItem] = useState<ProvenanceAuditItem | null>(null);

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
      if (data.guardrail_rule) setGuardrailRule(data.guardrail_rule);
      if (data.kpis) setKpis(data.kpis);
      if (data.security_alerts) setSecurityAlerts(data.security_alerts);
      if (data.audit_trail) setAuditTrail(data.audit_trail);
      setLastRefreshed(new Date().toLocaleTimeString());

      // Default select the transmission node or first node if not set
      if (!selectedNodeId && data.nodes && data.nodes.length > 0) {
        const sendNode = data.nodes.find((n: ProvenanceEventNode) => n.event_type === 'external_send');
        setSelectedNodeId(sendNode ? sendNode.id : data.nodes[0].id);
      }
    } catch (err) {
      console.error('Failed to load provenance command center telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setEvalLoading(true);
    const dest = customDestination.trim() !== '' ? customDestination.trim() : testDestination;
    try {
      const res = await apiFetch('/api/provenance/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          event_id: testEventId,
          action: testAction,
          target_destination: dest,
        }),
      });
      setEvalResult(res);
    } catch (err) {
      console.error('Guardrail evaluation error:', err);
      setEvalResult(null);
    } finally {
      setEvalLoading(false);
    }
  };

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // Dependent children for selected node
  const downstreamDependents = useMemo(() => {
    if (!selectedNodeId) return [];
    const childIds = edges.filter((e) => e.source_id === selectedNodeId).map((e) => e.target_id);
    return nodes.filter((n) => childIds.includes(n.id));
  }, [selectedNodeId, edges, nodes]);

  // Predecessor parents for selected node
  const upstreamPredecessors = useMemo(() => {
    if (!selectedNodeId) return [];
    const parentIds = edges.filter((e) => e.target_id === selectedNodeId).map((e) => e.source_id);
    return nodes.filter((n) => parentIds.includes(n.id));
  }, [selectedNodeId, edges, nodes]);

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return securityAlerts.filter((alert) => {
      if (alertSeverityFilter !== 'ALL' && alert.severity !== alertSeverityFilter) return false;
      if (alertSearch.trim()) {
        const q = alertSearch.toLowerCase();
        return (
          alert.title.toLowerCase().includes(q) ||
          alert.description.toLowerCase().includes(q) ||
          alert.agent_id.toLowerCase().includes(q) ||
          alert.event_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [securityAlerts, alertSeverityFilter, alertSearch]);

  // Filtered Audit Trail
  const filteredAuditTrail = useMemo(() => {
    return auditTrail.filter((item) => {
      if (auditLabelFilter === 'TAINTED' && !item.is_tainted) return false;
      if (auditLabelFilter === 'SECRET' && !item.has_secret) return false;
      if (auditLabelFilter === 'DUAL' && (!item.is_tainted || !item.has_secret)) return false;
      if (auditLabelFilter === 'CLEAN' && (item.is_tainted || item.has_secret)) return false;

      if (auditDecisionFilter !== 'ALL' && item.enforcement_decision !== auditDecisionFilter) return false;

      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        return (
          item.event_id.toLowerCase().includes(q) ||
          item.agent_id.toLowerCase().includes(q) ||
          item.action.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q) ||
          (item.policy && item.policy.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [auditTrail, auditLabelFilter, auditDecisionFilter, auditSearch]);

  return (
    <div className="page-container" id="ai-security-command-center">
      {/* 1. Executive SOC Header */}
      <div className="page-header-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                background: '#8b151b',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              SOC ENFORCEMENT
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#15803d', display: 'inline-block' }}></span>
              COMPLETE MEDIATION ACTIVE
            </div>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>
            AI Security Command Center
          </h1>
          <p className="page-subtitle" style={{ maxWidth: '820px' }}>
            Real-time causal event provenance, dynamic taint and confidentiality secret propagation, and reference monitor network team guardrails.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Updated: <strong>{lastRefreshed}</strong>
            </span>
          )}
          <button
            onClick={fetchGraph}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.95rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {/* 2. Datalog Policy Banner */}
      <div
        className="surface-card"
        style={{
          borderLeft: '4px solid #8b151b',
          background: 'linear-gradient(90deg, rgba(139, 21, 27, 0.04) 0%, rgba(255, 255, 255, 1) 100%)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <Radio size={22} color="#8b151b" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Information-Flow Guardrail: <code>{guardrailRule}</code>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              If an AI Agent interacts with an untrusted prompt and subsequently reads confidential data, taint and secret tags automatically propagate. Any candidate external transmission is strictly intercepted and blocked.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#fef3c7',
              color: '#b45309',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #fde68a',
            }}
          >
            Tainted(e) Propagation
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#fee2e2',
              color: '#b91c1c',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #fecaca',
            }}
          >
            HasSecret(e) Tracking
          </span>
        </div>
      </div>

      {/* 3. Security Overview KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        {/* Card 1: Monitored Events */}
        <div
          className="surface-card"
          style={{
            padding: '1.1rem 1.25rem',
            borderLeft: '4px solid #475569',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Monitored Events
            </span>
            <Activity size={17} color="#475569" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {loading ? '...' : kpis?.monitored_events ?? nodes.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            Live Ingest, Tool Calls & Sends
          </div>
        </div>

        {/* Card 2: Risky Events */}
        <div
          className="surface-card"
          style={{
            padding: '1.1rem 1.25rem',
            borderLeft: '4px solid #d97706',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
              Risky Events
            </span>
            <AlertTriangle size={17} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#b45309', lineHeight: 1.1 }}>
            {loading ? '...' : kpis?.risky_events ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            Tainted or Secret Flags Active
          </div>
        </div>

        {/* Card 3: Blocked Transmissions */}
        <div
          className="surface-card"
          style={{
            padding: '1.1rem 1.25rem',
            borderLeft: '4px solid #8b151b',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#8b151b', textTransform: 'uppercase' }}>
              Blocked Transmissions
            </span>
            <ShieldAlert size={17} color="#8b151b" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#8b151b', lineHeight: 1.1 }}>
            {loading ? '...' : kpis?.blocked_transmissions ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            Enforced by Network Guardrails
          </div>
        </div>

        {/* Card 4: Active AI Agents */}
        <div
          className="surface-card"
          style={{
            padding: '1.1rem 1.25rem',
            borderLeft: '4px solid #7c3aed',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
              Active AI Agents
            </span>
            <Cpu size={17} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#6d28d9', lineHeight: 1.1 }}>
            {loading ? '...' : kpis?.active_ai_agents ?? 3}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            {kpis?.active_agents_list ? kpis.active_agents_list.join(', ') : 'AG102, AG201, AG301'}
          </div>
        </div>

        {/* Card 5: Corporate Egress Policy */}
        <div
          className="surface-card"
          style={{
            padding: '1.1rem 1.25rem',
            borderLeft: '4px solid #15803d',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
              Egress Allowlist
            </span>
            <Globe size={17} color="#15803d" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#15803d', lineHeight: 1.1 }}>
            {loading ? '...' : approvedDestinations.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            Approved Corporate Endpoints
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('graph')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: activeTab === 'graph' ? '#8b151b' : 'var(--text-secondary)',
            borderBottom: activeTab === 'graph' ? '3px solid #8b151b' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Activity size={16} /> Live Event Dependency Graph
        </button>

        <button
          onClick={() => setActiveTab('guardrails')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: activeTab === 'guardrails' ? '#8b151b' : 'var(--text-secondary)',
            borderBottom: activeTab === 'guardrails' ? '3px solid #8b151b' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Globe size={16} /> Network Guardrails & Egress Simulator
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: activeTab === 'alerts' ? '#8b151b' : 'var(--text-secondary)',
            borderBottom: activeTab === 'alerts' ? '3px solid #8b151b' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldAlert size={16} />
          Security Alerts
          {securityAlerts.length > 0 && (
            <span
              style={{
                fontSize: '0.7rem',
                background: '#8b151b',
                color: '#ffffff',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontWeight: 800,
              }}
            >
              {securityAlerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: activeTab === 'audit' ? '#8b151b' : 'var(--text-secondary)',
            borderBottom: activeTab === 'audit' ? '3px solid #8b151b' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FileText size={16} /> Enforcement Audit Trail
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE EVENT DEPENDENCY GRAPH & NODE INSPECTOR */}
      {/* ========================================================================= */}
      {activeTab === 'graph' && (
        <div>
          {/* Visual Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Graph Classification Legend:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706' }}></span>
                <strong>Untrusted Input / Tainted(e)</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#b91c1c' }}></span>
                <strong>Sensitive Asset / HasSecret(e)</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8b151b' }}></span>
                <strong>Tainted + Secret (Deny Target)</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#15803d' }}></span>
                <strong>Clean Event</strong>
              </span>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Click any node card to inspect full telemetry, causal sources, and raw payloads.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
            {/* Visual Node Grid */}
            <div className="surface-card" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="#8b151b" />
                Causal Pipeline & Event Dependency Nodes ({nodes.length})
              </h2>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  Loading causal event dependency graph...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.1rem' }}>
                  {nodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isDualThreat = node.is_tainted && node.has_secret;

                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        style={{
                          background: isSelected ? 'rgba(139, 21, 27, 0.04)' : '#ffffff',
                          borderRadius: '8px',
                          padding: '1.1rem',
                          border: isSelected
                            ? '2px solid #8b151b'
                            : isDualThreat
                            ? '2px solid #ef4444'
                            : node.is_tainted
                            ? '1.5px solid #f59e0b'
                            : node.has_secret
                            ? '1.5px solid #f43f5e'
                            : '1px solid var(--border-color)',
                          boxShadow: isSelected ? '0 4px 12px rgba(139, 21, 27, 0.12)' : '0 2px 4px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease-in-out',
                          position: 'relative',
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <code style={{ fontWeight: 800, fontSize: '0.88rem', color: isSelected ? '#8b151b' : 'var(--text-primary)' }}>
                              {node.id}
                            </code>
                          </div>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background:
                                node.event_type === 'external_send'
                                  ? 'rgba(139, 21, 27, 0.1)'
                                  : node.event_type === 'message'
                                  ? 'rgba(217, 119, 6, 0.1)'
                                  : 'rgba(71, 85, 105, 0.1)',
                              color:
                                node.event_type === 'external_send'
                                  ? '#8b151b'
                                  : node.event_type === 'message'
                                  ? '#b45309'
                                  : '#475569',
                            }}
                          >
                            {node.event_type}
                          </span>
                        </div>

                        {/* Principal & Action */}
                        <div style={{ fontSize: '0.82rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                          Principal / Agent: <strong style={{ color: 'var(--text-primary)' }}>{node.principal_id}</strong>
                        </div>
                        {node.action && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                            Action: <code style={{ color: '#0f172a' }}>{node.action}</code>
                          </div>
                        )}
                        {node.resource_id && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                            Resource: <strong style={{ color: '#0f172a' }}>{node.resource_id}</strong>
                          </div>
                        )}
                        {node.target_destination && (
                          <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginBottom: '0.35rem', wordBreak: 'break-all' }}>
                            Target: <code>{node.target_destination}</code>
                          </div>
                        )}

                        {/* Source Classification Tag */}
                        <div style={{ marginTop: '0.6rem', marginBottom: '0.6rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              background:
                                node.label === 'untrusted_input'
                                  ? '#fef3c7'
                                  : node.label === 'sensitive_input'
                                  ? '#fee2e2'
                                  : '#ecfdf5',
                              color:
                                node.label === 'untrusted_input'
                                  ? '#b45309'
                                  : node.label === 'sensitive_input'
                                  ? '#b91c1c'
                                  : '#047857',
                            }}
                          >
                            Source: {node.label}
                          </span>
                        </div>

                        {/* Propagated Labels & Enforcement Status */}
                        <div
                          style={{
                            borderTop: '1px solid var(--border-color)',
                            paddingTop: '0.55rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {node.is_tainted && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '3px',
                                }}
                              >
                                Tainted(e)
                              </span>
                            )}
                            {node.has_secret && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '3px',
                                }}
                              >
                                HasSecret(e)
                              </span>
                            )}
                            {!node.is_tainted && !node.has_secret && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  background: '#ecfdf5',
                                  color: '#047857',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '3px',
                                }}
                              >
                                Clean
                              </span>
                            )}
                          </div>

                          {/* Enforcement Status Badge */}
                          {node.enforcement_status === 'BLOCKED' ? (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background: '#8b151b',
                                color: '#ffffff',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <XCircle size={11} /> BLOCKED
                            </span>
                          ) : node.enforcement_status === 'ALLOWED' ? (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background: '#15803d',
                                color: '#ffffff',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <CheckCircle size={11} /> ALLOWED
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              MONITORED
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Edge Connections List */}
              <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                  Active Causal Dependency Edges ({edges.length})
                </h3>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {edges.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-color)',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <code>{e.source_id}</code>
                      <ArrowRight size={12} color="#64748b" />
                      <code style={{ fontWeight: 700, color: '#8b151b' }}>{e.target_id}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Node Details Inspector */}
            <div
              className="surface-card"
              style={{
                padding: '1.25rem',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                position: 'sticky',
                top: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Eye size={17} color="#8b151b" /> Node Inspector
                </h3>
                {selectedNode && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {selectedNode.event_type}
                  </span>
                )}
              </div>

              {selectedNode ? (
                <div>
                  <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800 }}>
                      Event Identifier
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#8b151b', marginTop: '0.15rem' }}>
                      {selectedNode.id}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Recorded at: {new Date(selectedNode.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>PRINCIPAL AGENT</span>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{selectedNode.principal_id}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>ACTION TYPE</span>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{selectedNode.action || 'None'}</div>
                    </div>
                  </div>

                  {selectedNode.target_destination && (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>OUTBOUND EGRESS TARGET</span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', wordBreak: 'break-all' }}>
                        <code>{selectedNode.target_destination}</code>
                      </div>
                    </div>
                  )}

                  {/* Security Classification */}
                  <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      SECURITY CLASSIFICATIONS
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                        Source: <strong>{selectedNode.label}</strong>
                      </span>
                      {selectedNode.is_tainted && (
                        <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>
                          Tainted
                        </span>
                      )}
                      {selectedNode.has_secret && (
                        <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#b91c1c', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>
                          HasSecret
                        </span>
                      )}
                    </div>

                    {selectedNode.enforcement_status && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>ENFORCEMENT DECISION: </span>
                        <strong style={{ color: selectedNode.enforcement_status === 'BLOCKED' ? '#8b151b' : '#15803d', fontSize: '0.8rem' }}>
                          {selectedNode.enforcement_status}
                        </strong>
                        {selectedNode.enforcement_reason && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {selectedNode.enforcement_reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Causal Lineage: Influencing Predecessors */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Upstream Causal Predecessors ({upstreamPredecessors.length})
                    </div>
                    {upstreamPredecessors.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {upstreamPredecessors.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedNodeId(p.id)}
                            style={{
                              padding: '0.45rem 0.65rem',
                              background: '#f8fafc',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <code>{p.id}</code>
                            <span style={{ fontSize: '0.7rem', color: p.is_tainted ? '#b45309' : p.has_secret ? '#b91c1c' : '#475569' }}>
                              {p.event_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Root input node (no upstream dependencies).
                      </div>
                    )}
                  </div>

                  {/* Downstream Dependents */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Downstream Dependents ({downstreamDependents.length})
                    </div>
                    {downstreamDependents.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {downstreamDependents.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedNodeId(c.id)}
                            style={{
                              padding: '0.45rem 0.65rem',
                              background: '#f8fafc',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <code>{c.id}</code>
                            <span style={{ fontSize: '0.7rem', color: c.enforcement_status === 'BLOCKED' ? '#8b151b' : '#475569', fontWeight: 700 }}>
                              {c.event_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Terminal leaf node (no downstream dependents).
                      </div>
                    )}
                  </div>

                  {/* Raw Payload Inspector */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Node Payload Content
                    </div>
                    <pre
                      style={{
                        background: '#0f172a',
                        color: '#f8fafc',
                        padding: '0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        overflowX: 'auto',
                        maxHeight: '160px',
                        lineHeight: 1.4,
                      }}
                    >
                      {selectedNode.payload ? JSON.stringify(selectedNode.payload, null, 2) : 'No payload body'}
                    </pre>
                  </div>

                  {/* Action Quick Test */}
                  <button
                    onClick={() => {
                      setTestEventId(selectedNode.id);
                      setActiveTab('guardrails');
                    }}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <ExternalLink size={13} /> Test Outbound Egress with this Node
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Select any node in the graph above to inspect its causal dependencies and raw telemetry.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: NETWORK GUARDRAILS & EGRESS SIMULATOR */}
      {/* ========================================================================= */}
      {activeTab === 'guardrails' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left: Approved vs Blocked Outbound Destinations */}
          <div className="surface-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={18} color="#8b151b" /> Network Team Guardrails & Destinations
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              The Network Reference Monitor inspects all AI Agent external socket calls. Outbound transmissions to unapproved destinations or carrying tainted secrets are automatically blocked.
            </p>

            {/* Approved Corporate Destinations */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <CheckCircle size={15} color="#15803d" />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#15803d', margin: 0, textTransform: 'uppercase' }}>
                  Approved Corporate Outbound Allowlist ({approvedDestinations.length})
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {approvedDestinations.map((dest) => (
                  <div
                    key={dest}
                    style={{
                      background: 'rgba(21, 128, 61, 0.05)',
                      border: '1px solid rgba(21, 128, 61, 0.2)',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <code style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>{dest}</code>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                      ALLOWLISTED
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Known Threat & Exfiltration Targets */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <XCircle size={15} color="#8b151b" />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#8b151b', margin: 0, textTransform: 'uppercase' }}>
                  Untrusted / Disallowed Egress Targets
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {[
                  { dest: 'https://attacker.evil.com/exfil', reason: 'Untrusted external server (External Egress Deny)' },
                  { dest: 'https://unknown-exfil.org/webhook', reason: 'Unverified webhook dump (Tainted Secret Leakage)' },
                  { dest: 'https://pastebin.com/leak', reason: 'Public paste dump service' },
                ].map((item) => (
                  <div
                    key={item.dest}
                    style={{
                      background: 'rgba(139, 21, 27, 0.04)',
                      border: '1px solid rgba(139, 21, 27, 0.2)',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <code style={{ fontSize: '0.82rem', fontWeight: 700, color: '#8b151b' }}>{item.dest}</code>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{item.reason}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8b151b', textTransform: 'uppercase' }}>
                      EGRESS BLOCKED
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Enforced Datalog Rules */}
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', color: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Enforced Network Team Policy Rules
              </div>
              <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', lineHeight: 1.6 }}>
                <div># Rule 1: Complete mediation against tainted sensitive leakage</div>
                <div style={{ color: '#fca5a5' }}>Deny(a) :- ExternalSend(a), Tainted(a), HasSecret(a).</div>
                <div style={{ marginTop: '0.4rem', color: '#94a3b8' }}># Rule 2: Strict corporate destination allowlist</div>
                <div style={{ color: '#fef08a' }}>Deny(a) :- ExternalSend(a), not ApprovedDestination(a).</div>
              </div>
            </div>
          </div>

          {/* Right: Interactive Candidate Transmission Evaluator */}
          <div className="surface-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="#d97706" /> Candidate Transmission Test Bench
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Evaluate any candidate network send action against live provenance taint propagation and corporate destination allowlists.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                Select Candidate Event Node:
              </label>
              <select
                value={testEventId}
                onChange={(e) => setTestEventId(e.target.value)}
                className="form-input"
                style={{ width: '100%', padding: '0.65rem' }}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.id} ({n.principal_id} - {n.event_type} - {n.label})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                Candidate Egress Action:
              </label>
              <select
                value={testAction}
                onChange={(e) => setTestAction(e.target.value)}
                className="form-input"
                style={{ width: '100%', padding: '0.65rem' }}
              >
                <option value="external_send">external_send (Outbound HTTP/Socket Transmission)</option>
                <option value="http_post">http_post (REST API Exfiltration)</option>
                <option value="webhook_notify">webhook_notify (External Webhook Dispatch)</option>
                <option value="internal_read">internal_read (Non-egress internal operation)</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                Target Outbound Destination:
              </label>
              <select
                value={testDestination}
                onChange={(e) => {
                  setTestDestination(e.target.value);
                  setCustomDestination('');
                }}
                className="form-input"
                style={{ width: '100%', padding: '0.65rem', marginBottom: '0.5rem' }}
              >
                <optgroup label="Disallowed / Untrusted Endpoints">
                  <option value="https://unknown-exfil.org/webhook">https://unknown-exfil.org/webhook (Untrusted Egress)</option>
                  <option value="https://attacker.evil.com/exfil">https://attacker.evil.com/exfil (Malicious Exfiltration)</option>
                  <option value="https://pastebin.com/leak">https://pastebin.com/leak (Public Dump)</option>
                </optgroup>
                <optgroup label="Approved Corporate Allowlist">
                  {approvedDestinations.map((d) => (
                    <option key={d} value={`https://${d}`}>
                      https://{d} (Allowlisted)
                    </option>
                  ))}
                </optgroup>
              </select>

              <input
                type="text"
                placeholder="Or enter custom URL/destination to test (e.g. https://api.my-domain.com)"
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value)}
                className="form-input"
                style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem' }}
              />
            </div>

            <button
              onClick={handleEvaluate}
              disabled={evalLoading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              }}
            >
              {evalLoading ? (
                <>
                  <RefreshCw size={15} className="spin" /> Evaluating Guardrail Engine...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> Execute Network Guardrail Verification
                </>
              )}
            </button>

            {/* Live Backend Enforcement Verdict */}
            {evalResult && (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '8px',
                  border: evalResult.status === 'ALLOWED' ? '2px solid #15803d' : '2px solid #8b151b',
                  background: evalResult.status === 'ALLOWED' ? 'rgba(21, 128, 61, 0.05)' : 'rgba(139, 21, 27, 0.05)',
                  animation: 'fadeIn 0.2s ease-in-out',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {evalResult.status === 'ALLOWED' ? (
                      <ShieldCheck size={26} color="#15803d" />
                    ) : (
                      <ShieldAlert size={26} color="#8b151b" />
                    )}
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        BACKEND ENFORCEMENT VERDICT
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          color: evalResult.status === 'ALLOWED' ? '#15803d' : '#8b151b',
                        }}
                      >
                        {evalResult.status === 'ALLOWED' ? 'TRANSMISSION ALLOWED' : 'TRANSMISSION BLOCKED'}
                      </h3>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '4px',
                      background: evalResult.status === 'ALLOWED' ? '#15803d' : '#8b151b',
                      color: '#ffffff',
                    }}
                  >
                    {evalResult.status}
                  </span>
                </div>

                <p style={{ margin: '0 0 0.65rem 0', fontSize: '0.88rem', fontWeight: 600 }}>
                  {evalResult.reason || 'Candidate transmission meets all egress and taint-flow policies.'}
                </p>

                {evalResult.policy && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Triggered Policy Rule: <code style={{ fontWeight: 700, color: '#8b151b' }}>{evalResult.policy}</code>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: evalResult.tainted ? '#fef3c7' : '#ecfdf5',
                      color: evalResult.tainted ? '#b45309' : '#047857',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    Tainted: {evalResult.tainted ? 'TRUE' : 'FALSE'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: evalResult.has_secret ? '#fee2e2' : '#ecfdf5',
                      color: evalResult.has_secret ? '#b91c1c' : '#047857',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    HasSecret: {evalResult.has_secret ? 'TRUE' : 'FALSE'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    Target: {evalResult.target_destination || 'None'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REAL-TIME SECURITY ALERTS */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="surface-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} color="#8b151b" /> Real-Time AI Security Alerts ({filteredAlerts.length})
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
                Automated threat detections: suspicious prompts, sensitive data accesses, and attempted external data leakage.
              </p>
            </div>

            {/* Severity Filters */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Severity:</span>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setAlertSeverityFilter(sev)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    borderRadius: '4px',
                    border: alertSeverityFilter === sev ? '1px solid #8b151b' : '1px solid var(--border-color)',
                    background: alertSeverityFilter === sev ? '#8b151b' : '#ffffff',
                    color: alertSeverityFilter === sev ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search alerts by title, description, agent ID, or event ID..."
              value={alertSearch}
              onChange={(e) => setAlertSearch(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.55rem', paddingBottom: '0.55rem' }}
            />
          </div>

          {/* Alert Feed */}
          {filteredAlerts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderLeft:
                      alert.severity === 'CRITICAL'
                        ? '4px solid #8b151b'
                        : alert.severity === 'HIGH'
                        ? '4px solid #d97706'
                        : alert.severity === 'MEDIUM'
                        ? '4px solid #7c3aed'
                        : '4px solid #475569',
                    borderRadius: '6px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '3px',
                          background:
                            alert.severity === 'CRITICAL'
                              ? '#8b151b'
                              : alert.severity === 'HIGH'
                              ? '#d97706'
                              : alert.severity === 'MEDIUM'
                              ? '#7c3aed'
                              : '#475569',
                          color: '#ffffff',
                        }}
                      >
                        {alert.severity}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                        {alert.category}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                      {alert.title}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                      {alert.description}
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>
                        Agent ID: <strong style={{ color: 'var(--text-primary)' }}>{alert.agent_id}</strong>
                      </span>
                      <span>
                        Event Node: <code>{alert.event_id}</code>
                      </span>
                      {alert.action && (
                        <span>
                          Action: <code>{alert.action}</code>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedNodeId(alert.event_id);
                      setActiveTab('graph');
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    View in Graph <ChevronRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No security alerts match the selected severity and search criteria.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ENFORCEMENT AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="surface-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} color="#8b151b" /> Provenance & Enforcement Audit Trail ({filteredAuditTrail.length})
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
                Immutable ledger of agent actions, causal labels, and Network Guardrail enforcement decisions.
              </p>
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={auditLabelFilter}
                onChange={(e) => setAuditLabelFilter(e.target.value)}
                className="form-input"
                style={{ padding: '0.45rem', fontSize: '0.78rem' }}
              >
                <option value="ALL">All Label States</option>
                <option value="TAINTED">Tainted Only</option>
                <option value="SECRET">HasSecret Only</option>
                <option value="DUAL">Tainted + HasSecret</option>
                <option value="CLEAN">Clean Only</option>
              </select>

              <select
                value={auditDecisionFilter}
                onChange={(e) => setAuditDecisionFilter(e.target.value)}
                className="form-input"
                style={{ padding: '0.45rem', fontSize: '0.78rem' }}
              >
                <option value="ALL">All Decisions</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="ALLOWED">ALLOWED</option>
                <option value="MONITORED">MONITORED</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search audit trail by event ID, agent ID, action, target, or policy..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.55rem', paddingBottom: '0.55rem' }}
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Timestamp</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Event ID</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Agent ID</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Type & Action</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Target / Resource</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Labels</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Decision</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditTrail.length > 0 ? (
                  filteredAuditTrail.map((item) => (
                    <tr
                      key={item.event_id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: item.enforcement_decision === 'BLOCKED' ? 'rgba(139, 21, 27, 0.02)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <code style={{ fontWeight: 700, color: '#8b151b' }}>{item.event_id}</code>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>{item.agent_id}</td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div><strong>{item.action}</strong></div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{item.event_type}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <code>{item.target}</code>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {item.is_tainted && (
                            <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>
                              Tainted
                            </span>
                          )}
                          {item.has_secret && (
                            <span style={{ fontSize: '0.68rem', background: '#fee2e2', color: '#b91c1c', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>
                              HasSecret
                            </span>
                          )}
                          {!item.is_tainted && !item.has_secret && (
                            <span style={{ fontSize: '0.68rem', background: '#ecfdf5', color: '#047857', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>
                              Clean
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background:
                              item.enforcement_decision === 'BLOCKED'
                                ? '#8b151b'
                                : item.enforcement_decision === 'ALLOWED'
                                ? '#15803d'
                                : '#f1f5f9',
                            color: item.enforcement_decision === 'MONITORED' ? '#475569' : '#ffffff',
                          }}
                        >
                          {item.enforcement_decision}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <button
                          onClick={() => setInspectAuditItem(item)}
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                      No audit events match the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payload Modal */}
      {inspectAuditItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setInspectAuditItem(null)}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Audit Inspection: <code>{inspectAuditItem.event_id}</code>
              </h3>
              <button onClick={() => setInspectAuditItem(null)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
              <div>Agent: <strong>{inspectAuditItem.agent_id}</strong></div>
              <div>Action: <code>{inspectAuditItem.action}</code></div>
              <div>Decision: <strong style={{ color: inspectAuditItem.enforcement_decision === 'BLOCKED' ? '#8b151b' : '#15803d' }}>{inspectAuditItem.enforcement_decision}</strong></div>
              {inspectAuditItem.enforcement_reason && (
                <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{inspectAuditItem.enforcement_reason}</div>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              RAW EVENT PAYLOAD
            </div>
            <pre
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                padding: '0.85rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                overflowX: 'auto',
                maxHeight: '260px',
              }}
            >
              {inspectAuditItem.payload ? JSON.stringify(inspectAuditItem.payload, null, 2) : 'No payload recorded'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
