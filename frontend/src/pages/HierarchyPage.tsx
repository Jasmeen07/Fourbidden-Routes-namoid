import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Bot,
  UserCheck,
  Building2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Lock,
  Layers,
  Key,
  Database,
  Activity,
  FileText,
  Calendar,
  Send,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const HierarchyPage: React.FC = () => {
  const { user, apiFetch, activePersonaId, personas, switchPersona } = useAuth();
  const navigate = useNavigate();

  // Active Role Tab (for users with multiple capabilities or switching perspectives)
  const [activeRoleTab, setActiveRoleTab] = useState<'employee' | 'manager' | 'risk_reviewer' | 'resource_owner' | 'admin'>('employee');

  // Dashboard Telemetry
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Renewal Modal
  const [renewModal, setRenewModal] = useState<{ open: boolean; grantId: string; resourceName: string }>({
    open: false,
    grantId: '',
    resourceName: '',
  });
  const [renewMinutes, setRenewMinutes] = useState<number>(1440); // 24 hours
  const [renewJustification, setRenewJustification] = useState<string>('Extending model evaluation for ongoing project sprint.');
  const [isSubmittingRenew, setIsSubmittingRenew] = useState<boolean>(false);

  // Admin Simulator state (retained from original hierarchy)
  const [simRequester, setSimRequester] = useState<string>('AG102');
  const [simResource, setSimResource] = useState<string>('finance.csv');
  const [simPreview, setSimPreview] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/my-access');
      setDashboardData(data);

      // Auto-set initial active role tab based on primary capability
      const profile = data.user_profile;
      if (profile.is_admin && activeRoleTab === 'employee') {
        setActiveRoleTab('employee'); // default to personal access, but admin tab is available
      } else if (profile.is_manager && !profile.is_admin && activeRoleTab === 'employee') {
        // keep employee by default
      }
    } catch (err) {
      console.error('Failed to load my-access dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user, activePersonaId]);

  // Preview approval for admin simulator
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

  useEffect(() => {
    if (activeRoleTab === 'admin' && simRequester && simResource) {
      previewApproval();
    }
  }, [activeRoleTab, simRequester, simResource]);

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRenew(true);
    try {
      const res = await apiFetch('/api/my-access/renew', {
        method: 'POST',
        body: JSON.stringify({
          grant_id: renewModal.grantId,
          additional_minutes: Number(renewMinutes),
          justification: renewJustification.trim(),
        }),
      });
      setRenewModal({ open: false, grantId: '', resourceName: '' });
      setActionSuccess(`Access renewal request submitted: ${res.request_id} queued for mandatory 3-stage governance review.`);
      fetchDashboard();
    } catch (err: any) {
      console.error('Failed to submit renewal:', err);
    } finally {
      setIsSubmittingRenew(false);
    }
  };

  const handleReleaseEarly = async (grantId: string) => {
    try {
      await apiFetch(`/api/grants/${grantId}/release-early`, {
        method: 'POST',
      });
      setActionSuccess(`Grant ${grantId} released early to minimize corporate privilege surface.`);
      fetchDashboard();
    } catch (err: any) {
      console.error(err);
    }
  };

  const profile = dashboardData?.user_profile;
  const empView = dashboardData?.employee_view;
  const mgrView = dashboardData?.manager_view;
  const riskView = dashboardData?.risk_reviewer_view;
  const roView = dashboardData?.resource_owner_view;
  const adminView = dashboardData?.admin_view;

  // Determine available role tabs for this user
  const availableTabs = [
    { id: 'employee', label: 'Employee / Requester' },
    ...(profile?.is_manager ? [{ id: 'manager', label: 'Manager' }] : []),
    ...(profile?.is_risk_reviewer ? [{ id: 'risk_reviewer', label: 'Risk Reviewer' }] : []),
    ...(profile?.is_resource_owner ? [{ id: 'resource_owner', label: 'Resource Owner' }] : []),
    ...(profile?.is_admin ? [{ id: 'admin', label: 'Administrator Console' }] : []),
  ];

  return (
    <div className="page-container" id="my-access-security-page">
      {/* Page Header Row */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 className="page-title">My Access & Security Dashboard</h1>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(139, 21, 27, 0.1)',
                color: 'var(--accent-crimson)',
                border: '1px solid rgba(139, 21, 27, 0.25)',
              }}
            >
              Role-Bound Governance
            </span>
          </div>
          <p className="page-subtitle">
            Personal active access privileges, 3-stage approval tracking, renewal lifecycle, and role-tailored governance oversight.
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
          title="Refresh dashboard"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
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

      {/* Role Navigation Bar */}
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
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveRoleTab(tab.id as any)}
            className={`btn btn-sm ${activeRoleTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              fontSize: '0.825rem',
              fontWeight: activeRoleTab === tab.id ? 700 : 500,
            }}
            id={`role-tab-${tab.id}`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loading && !dashboardData ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3.5rem', background: '#ffffff' }}>
          <Layers className="animate-spin" size={28} color="var(--accent-crimson)" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Loading role-based access information...</p>
        </div>
      ) : (
        <>
          {/* =========================================================================
              VIEW 1: EMPLOYEE / REQUESTER
             ========================================================================= */}
          {activeRoleTab === 'employee' && empView && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Quick Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--accent-forest)',
                    padding: '1.1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Active Access Grants
                    </span>
                    <Key size={16} color="var(--accent-forest)" />
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {empView.my_active_access.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-forest)', fontWeight: 600, marginTop: '0.2rem' }}>
                    Time-Bounded & Governed
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--accent-amber)',
                    padding: '1.1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Expiring Soon (48h)
                    </span>
                    <Clock size={16} color="var(--accent-amber)" />
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {empView.expiring_access.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: 600, marginTop: '0.2rem' }}>
                    Eligible for 1-Click Renewal
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--accent-blue)',
                    padding: '1.1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      My Requests in Review
                    </span>
                    <FileText size={16} color="var(--accent-blue)" />
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {empView.my_access_requests.filter((r: any) => r.status === 'IN_REVIEW' || r.status === 'BLOCKED').length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, marginTop: '0.2rem' }}>
                    In 3-Stage Workflow
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--accent-crimson)',
                    padding: '1.1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Security Alerts
                    </span>
                    <ShieldAlert size={16} color="var(--accent-crimson)" />
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {empView.security_alerts.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-crimson)', fontWeight: 600, marginTop: '0.2rem' }}>
                    Gateway Notifications
                  </div>
                </div>
              </div>

              {/* 1. My Active Access Section */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Key size={18} color="var(--accent-forest)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      My Active Access & Permissions
                    </h3>
                  </div>
                  <button
                    onClick={() => navigate('/catalog')}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    Request New Access
                  </button>
                </div>

                {empView.my_active_access.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    You currently have no active access grants. Visit the Datasets & Models catalog to request access.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Resource Name</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Permission Level</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Resource Owner</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Approved At</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Expiry Date</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Remaining</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empView.my_active_access.map((acc: any) => (
                          <tr key={acc.grant_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {acc.resource_name}
                              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {acc.resource_id}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {acc.actions.map((act: string) => (
                                  <span
                                    key={act}
                                    style={{
                                      fontSize: '0.7rem',
                                      fontFamily: 'monospace',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '4px',
                                      background: 'var(--bg-secondary)',
                                      border: '1px solid var(--border-subtle)',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {act}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {acc.resource_owner}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                              {new Date(acc.activated_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                              {new Date(acc.expires_at).toLocaleDateString()} {new Date(acc.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '999px',
                                  background: acc.remaining_hours <= 48 ? 'rgba(180, 83, 9, 0.12)' : 'rgba(21, 128, 61, 0.12)',
                                  color: acc.remaining_hours <= 48 ? '#b45309' : '#15803d',
                                }}
                              >
                                {acc.remaining_hours}h left
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {acc.is_expiring_soon && (
                                  <button
                                    onClick={() => setRenewModal({ open: true, grantId: acc.grant_id, resourceName: acc.resource_name })}
                                    className="btn btn-sm btn-primary"
                                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                                  >
                                    Renew
                                  </button>
                                )}
                                <button
                                  onClick={() => handleReleaseEarly(acc.grant_id)}
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', color: '#b91c1c' }}
                                  title="Release grant early upon task completion"
                                >
                                  Release Early
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

              {/* 2. My Access Requests & 3-Stage Approval Pipeline */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <FileText size={18} color="var(--accent-crimson)" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    My Access Requests (3-Stage Mandatory Approval Tracking)
                  </h3>
                </div>

                {empView.my_access_requests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    You have not submitted any access requests yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {empView.my_access_requests.map((req: any) => (
                      <div
                        key={req.request_id}
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          background: 'var(--bg-primary)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {req.resource_name}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                              ({req.request_id})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                background: req.status === 'APPROVED' ? 'rgba(21, 128, 61, 0.15)' : req.status === 'REJECTED' ? 'rgba(185, 28, 28, 0.15)' : 'rgba(29, 78, 216, 0.15)',
                                color: req.status === 'APPROVED' ? '#15803d' : req.status === 'REJECTED' ? '#b91c1c' : '#1d4ed8',
                              }}
                            >
                              {req.status}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {new Date(req.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* 3-Stage Mandatory Visual Steps */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '0.75rem',
                            marginTop: '0.5rem',
                          }}
                        >
                          {/* Stage 1: Manager */}
                          <div
                            style={{
                              background: '#ffffff',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.75rem',
                              borderLeft: `3px solid ${req.approval_stages.manager.status === 'APPROVED' ? '#15803d' : req.approval_stages.manager.status === 'REJECTED' ? '#b91c1c' : '#b45309'}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                Stage 1: Manager
                              </span>
                              {req.approval_stages.manager.status === 'APPROVED' ? (
                                <CheckCircle2 size={14} color="#15803d" />
                              ) : req.approval_stages.manager.status === 'REJECTED' ? (
                                <XCircle size={14} color="#b91c1c" />
                              ) : (
                                <Clock size={14} color="#b45309" />
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              Status: {req.approval_stages.manager.status}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              Reviewer: {req.approval_stages.manager.assigned_to}
                            </div>
                          </div>

                          {/* Stage 2: Risk Reviewer */}
                          <div
                            style={{
                              background: '#ffffff',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.75rem',
                              borderLeft: `3px solid ${req.approval_stages.risk_reviewer.status === 'APPROVED' ? '#15803d' : req.approval_stages.risk_reviewer.status === 'REJECTED' ? '#b91c1c' : '#b45309'}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                Stage 2: Risk Reviewer
                              </span>
                              {req.approval_stages.risk_reviewer.status === 'APPROVED' ? (
                                <CheckCircle2 size={14} color="#15803d" />
                              ) : req.approval_stages.risk_reviewer.status === 'REJECTED' ? (
                                <XCircle size={14} color="#b91c1c" />
                              ) : (
                                <Clock size={14} color="#b45309" />
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              Status: {req.approval_stages.risk_reviewer.status}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              Reviewer: {req.approval_stages.risk_reviewer.assigned_to}
                            </div>
                          </div>

                          {/* Stage 3: Resource Owner */}
                          <div
                            style={{
                              background: '#ffffff',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.75rem',
                              borderLeft: `3px solid ${req.approval_stages.resource_owner.status === 'APPROVED' ? '#15803d' : req.approval_stages.resource_owner.status === 'REJECTED' ? '#b91c1c' : '#b45309'}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                Stage 3: Resource Owner
                              </span>
                              {req.approval_stages.resource_owner.status === 'APPROVED' ? (
                                <CheckCircle2 size={14} color="#15803d" />
                              ) : req.approval_stages.resource_owner.status === 'REJECTED' ? (
                                <XCircle size={14} color="#b91c1c" />
                              ) : (
                                <Clock size={14} color="#b45309" />
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              Status: {req.approval_stages.resource_owner.status}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              Reviewer: {req.approval_stages.resource_owner.assigned_to}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Smart Recommendations & Security Alerts Side-by-Side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Smart Recommendations */}
                <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Sparkles size={18} color="var(--accent-crimson)" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Least-Privilege Smart Recommendations
                    </h3>
                  </div>

                  {empView.smart_recommendations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={24} color="#15803d" style={{ margin: '0 auto 0.5rem' }} />
                      No excessive or dormant permissions detected. Your current access adheres to least-privilege principles.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {empView.smart_recommendations.map((rec: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>{rec.title}</strong>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: '#fef3c7',
                                color: '#b45309',
                              }}
                            >
                              {rec.type}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                            {rec.recommendation}
                          </p>
                          {rec.action_suggested === 'release_early' && (
                            <button
                              onClick={() => handleReleaseEarly(rec.grant_id)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#b91c1c' }}
                            >
                              Release Grant Early
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Personal Security & Risk Alerts */}
                <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <ShieldAlert size={18} color="var(--accent-crimson)" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Personal Security & Gateway Alerts
                    </h3>
                  </div>

                  {empView.security_alerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={24} color="#15803d" style={{ margin: '0 auto 0.5rem' }} />
                      No security incidents, policy denials, or unusual activities recorded for your identity.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '280px', overflowY: 'auto' }}>
                      {empView.security_alerts.map((al: any) => (
                        <div
                          key={al.id}
                          style={{
                            padding: '0.65rem',
                            borderRadius: '4px',
                            background: 'rgba(185, 28, 28, 0.05)',
                            border: '1px solid rgba(185, 28, 28, 0.2)',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontWeight: 700, marginBottom: '0.15rem' }}>
                            <span>{al.category}</span>
                            <span>{new Date(al.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div style={{ color: 'var(--text-primary)' }}>{al.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 2: MANAGER OVERSIGHT
             ========================================================================= */}
          {activeRoleTab === 'manager' && mgrView && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Manager KPI Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
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
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Pending Manager Reviews
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-crimson)' }}>
                    {mgrView.pending_approvals_count}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Awaiting your decision</div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--accent-blue)',
                    padding: '1.1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Assigned Direct Reports
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {mgrView.team_members_count}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Under your supervision</div>
                </div>
              </div>

              {/* Pending Approvals Table */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Team Member Requests Awaiting Manager Review ({mgrView.pending_approvals.length})
                  </h3>
                  <button onClick={() => navigate('/reviews')} className="btn btn-sm btn-primary" style={{ fontSize: '0.75rem' }}>
                    Open Approvals Queue
                  </button>
                </div>

                {mgrView.pending_approvals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No pending requests currently require manager sign-off.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Requester</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Target Resource</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Purpose</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Duration</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Submitted</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mgrView.pending_approvals.map((req: any) => (
                          <tr key={req.request_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {req.requester_name}
                              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {req.requester_dept}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{req.resource_name}</td>
                            <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {req.purpose_text}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>{Math.round(req.duration_minutes / 60)}h</td>
                            <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)' }}>
                              {new Date(req.created_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <button
                                onClick={() => navigate('/reviews')}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                              >
                                Review Request
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Team Members Access Overview */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Direct Reports Access Overview
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  {mgrView.team_members.map((tm: any) => (
                    <div
                      key={tm.sub}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{tm.name}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tm.sub}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{tm.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-forest)', fontWeight: 700 }}>
                        {tm.active_grants_count} Active Data Grants
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 3: RISK REVIEWER
             ========================================================================= */}
          {activeRoleTab === 'risk_reviewer' && riskView && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Requests Requiring Independent Risk Assessment ({riskView.risk_review_requests.length})
                  </h3>
                  <button onClick={() => navigate('/reviews')} className="btn btn-sm btn-primary" style={{ fontSize: '0.75rem' }}>
                    Open Reviews Drawer
                  </button>
                </div>

                {riskView.risk_review_requests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No requests currently pending risk assessment.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Target Resource</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Requester</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Classification</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Actions Requested</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskView.risk_review_requests.map((rr: any) => (
                          <tr key={rr.request_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {rr.resource_name}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{rr.requester_name}</td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: rr.is_crucial ? 'rgba(185, 28, 28, 0.15)' : 'rgba(180, 83, 9, 0.15)',
                                  color: rr.is_crucial ? '#b91c1c' : '#b45309',
                                }}
                              >
                                {rr.is_crucial ? 'Crucial / Tier 1' : 'Tier 2 Sensitive'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {rr.actions.join(', ')}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <button
                                onClick={() => navigate('/reviews')}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                              >
                                Assess & Narrow
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Excessive or Suspicious Access */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Suspicious or Excessive Access Alerts
                </h3>
                {riskView.suspicious_access_alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    No high-risk activity detected.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {riskView.suspicious_access_alerts.map((al: any) => (
                      <div
                        key={al.id}
                        style={{
                          padding: '0.65rem',
                          borderRadius: '4px',
                          background: 'rgba(185, 28, 28, 0.05)',
                          border: '1px solid rgba(185, 28, 28, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div>
                          <strong style={{ color: '#b91c1c' }}>{al.category}</strong> from {al.source_ip}
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            User: {al.user_sub || 'Unauthenticated'} • Action Taken: {al.action_taken}
                          </span>
                        </div>
                        <span style={{ fontWeight: 800, color: '#b91c1c' }}>Risk: {al.risk_score}/100</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 4: RESOURCE OWNER
             ========================================================================= */}
          {activeRoleTab === 'resource_owner' && roView && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Datasets & Models Under Your Ownership ({roView.owned_resources.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  {roView.owned_resources.map((res: any) => (
                    <div
                      key={res.id}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>{res.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{res.id}</span>
                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Tier: {res.tier} • Dept: {res.department}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Access Requests for Owned Resources */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Access Requests for Your Resources ({roView.resource_requests.length})
                  </h3>
                  <button onClick={() => navigate('/reviews')} className="btn btn-sm btn-primary" style={{ fontSize: '0.75rem' }}>
                    Open Approvals Queue
                  </button>
                </div>

                {roView.resource_requests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No incoming access requests for your resources.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Resource</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Requester</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Business Justification</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roView.resource_requests.map((rq: any) => (
                          <tr key={rq.request_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{rq.resource_name}</td>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{rq.requester_name}</td>
                            <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rq.purpose_text}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>{rq.status}</td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <button
                                onClick={() => navigate('/reviews')}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              >
                                Review
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
          )}

          {/* =========================================================================
              VIEW 5: ADMINISTRATOR CONSOLE (Retained Org Hierarchy & AI Governance)
             ========================================================================= */}
          {activeRoleTab === 'admin' && adminView && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Hierarchy Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
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
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Human Employees
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {adminView.total_users}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Accountable Humans</div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--accent-forest)',
                    padding: '1.1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Autonomous AI Agents
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {adminView.total_agents}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>100% Paired with Human Owners</div>
                </div>
              </div>

              {/* Retained Live Hierarchy Simulator */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Sparkles size={18} color="var(--accent-crimson)" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Administrator Hierarchy Routing Simulator
                  </h3>
                </div>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Evaluates dynamic PDP routing between Immediate Superior approval (standard non-crucial) and Multi-Tier Escalation (crucial or cross-department data).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Requester</label>
                    <select
                      value={simRequester}
                      onChange={(e) => setSimRequester(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                    >
                      <option value="AG102">AG102 (Engineering AI Agent - Owner: E102 Developer)</option>
                      <option value="AG201">AG201 (Finance AI Agent - Owner: E201 Analyst)</option>
                      <option value="E102">E102 (Developer David - Engineering)</option>
                      <option value="E201">E201 (Analyst Heidi - Finance)</option>
                      <option value="E050">E050 (Engineering Manager Charlie)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Resource</label>
                    <select
                      value={simResource}
                      onChange={(e) => setSimResource(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                    >
                      <option value="engineering.csv">engineering.csv (Engineering - Non-Crucial)</option>
                      <option value="finance.csv">finance.csv (Finance - CRITICAL / Crucial Data)</option>
                      <option value="D-claims-synth">D-claims-synth (Finance - RESTRICTED / Crucial Data)</option>
                    </select>
                  </div>
                </div>

                {simLoading ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    Evaluating hierarchy rules...
                  </div>
                ) : simPreview ? (
                  <div style={{ background: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: simPreview.is_crucial ? '#b91c1c' : '#15803d' }}>
                        {simPreview.is_crucial ? 'CRUCIAL DATA / ESCALATED PIPELINE' : 'STANDARD INTERNAL ACCESS'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Review Stages: <strong>{simPreview.steps?.length || 3}</strong>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(simPreview.steps || []).map((st: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.4rem 0.65rem',
                            borderRadius: '4px',
                            background: '#ffffff',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.75rem',
                          }}
                        >
                          <strong>Stage {idx + 1}:</strong> {st.slot_role} ({st.assigned_name || st.assigned_sub})
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Complete Organisational Hierarchy Table */}
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Enterprise Personnel & Reporting Hierarchy Directory
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Principal ID</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Name</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Type</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Department</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Manager / Superior</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Paired Agent / Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(adminView.hierarchy_tree?.principals || []).map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 700 }}>{p.id}</td>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: p.is_agent ? 'rgba(124, 58, 237, 0.12)' : 'rgba(29, 78, 216, 0.12)',
                                color: p.is_agent ? '#7c3aed' : '#1d4ed8',
                              }}
                            >
                              {p.is_agent ? 'AI Agent' : p.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>{p.department}</td>
                          <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>{p.manager_id || 'Top Level'}</td>
                          <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)' }}>
                            {p.is_agent ? `Owner: ${p.owner_id}` : p.owned_agents?.length ? `${p.owned_agents.length} agent(s)` : 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Renewal Request Modal */}
      {renewModal.open && (
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
              maxWidth: '440px',
              width: '90%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Submit Access Renewal Request
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Renewing access for <strong>{renewModal.resourceName}</strong>. This request will be routed through the mandatory 3-stage review pipeline (Manager, Risk Reviewer, Resource Owner).
            </p>

            <form onSubmit={handleRenewSubmit}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Extension Duration</label>
                <select
                  value={renewMinutes}
                  onChange={(e) => setRenewMinutes(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                >
                  <option value={1440}>24 Hours (1 Day)</option>
                  <option value={2880}>48 Hours (2 Days)</option>
                  <option value={4320}>72 Hours (3 Days)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Renewal Business Justification</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why continuation of access is required..."
                  value={renewJustification}
                  onChange={(e) => setRenewJustification(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRenewModal({ open: false, grantId: '', resourceName: '' })}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRenew || !renewJustification.trim()}
                  className="btn btn-primary"
                >
                  {isSubmittingRenew ? 'Submitting...' : 'Submit for 3-Stage Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
