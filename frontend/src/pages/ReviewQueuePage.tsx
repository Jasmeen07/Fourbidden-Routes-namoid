import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccessRequest, ReviewSlot, ApprovalAssistanceData } from '../types';
import { useAuth } from '../context/AuthContext';
import { DecisionDrawer } from '../components/DecisionDrawer';
import {
  CheckSquare,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
  Bot,
  UserCheck,
  History,
  CheckCircle2,
  Users,
  ChevronRight,
  Key,
} from 'lucide-react';

export const ReviewQueuePage: React.FC = () => {
  const { apiFetch, user, activePersonaId, personas, switchPersona } = useAuth();
  const navigate = useNavigate();
  const [myItems, setMyItems] = useState<{ request: AccessRequest; slot: ReviewSlot }[]>([]);
  const [allOrgItems, setAllOrgItems] = useState<{ request: AccessRequest; slot: ReviewSlot }[]>([]);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [selectedItem, setSelectedItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [activeDrawerItem, setActiveDrawerItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [assistanceData, setAssistanceData] = useState<ApprovalAssistanceData | null>(null);
  const [isLoadingAssistance, setIsLoadingAssistance] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [successToast, setSuccessToast] = useState<{ message: string; grantId?: string } | null>(null);

  const currentPersona = personas.find((p) => p.id === activePersonaId) || personas[0];

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const reqList = await apiFetch('/api/requests?view=visible');
      const allRequests: any[] = Array.isArray(reqList) ? reqList : (reqList.requests || []);

      const userSlots: { request: AccessRequest; slot: ReviewSlot }[] = [];
      const orgSlots: { request: AccessRequest; slot: ReviewSlot }[] = [];

      for (const req of allRequests) {
        if (req.status !== 'IN_REVIEW' && req.status !== 'BLOCKED') continue;

        let reqDetail = req;
        if (!req.slots || req.slots.length === 0) {
          reqDetail = await apiFetch(`/api/requests/${req.id}`).catch(() => req);
        }
        const slots: any[] = reqDetail.slots || [];

        const normalizedReq: AccessRequest = {
          id: reqDetail.id,
          requester_sub: reqDetail.requester_sub,
          requester_id: reqDetail.requester_sub,
          requester_name: reqDetail.requester_name || req.requester_name || reqDetail.requester_sub,
          requester_dept: reqDetail.requester_dept || req.requester_dept || 'Engineering',
          resource_id: reqDetail.resource_id,
          resource_name: reqDetail.resource_name || req.resource_name || reqDetail.resource_id,
          duration_minutes: reqDetail.duration_minutes,
          duration_hours: Math.round((reqDetail.duration_minutes || 1440) / 60) || 1,
          purpose_code: reqDetail.purpose_code,
          purpose_text: reqDetail.purpose_text,
          purpose: reqDetail.purpose_code,
          justification: reqDetail.purpose_text,
          actions: reqDetail.actions || [],
          risk_controls: reqDetail.risk_controls || [],
          status: reqDetail.status,
          created_at: reqDetail.created_at,
          is_crucial: reqDetail.is_crucial || req.is_crucial,
          slots: slots.map((s, idx) => ({
            id: s.id,
            slot_index: idx,
            slot_role: s.slot_role,
            required_role: s.slot_role,
            assigned_sub: s.assigned_sub,
            status: s.status,
            decision: s.decision,
            rationale: s.rationale,
            decision_rationale: s.rationale,
            decided_by_sub: s.decided_by_sub,
            decided_at: s.decided_at,
          })),
        };

        const isUserRequester = reqDetail.requester_sub === user?.sub;
        const isAdmin = user?.roles?.some((r: string) => ['admin', 'executive'].includes(r.toLowerCase())) || false;

        for (const slot of slots) {
          if (slot.status === 'PENDING') {
            const isAssigned = slot.assigned_sub === user?.sub;
            const hasRole = user?.roles?.some((r: string) => r.toLowerCase() === slot.slot_role.toLowerCase()) || false;

            const itemObj = {
              request: normalizedReq,
              slot: {
                id: slot.id,
                slot_index: 0,
                slot_role: slot.slot_role,
                required_role: slot.slot_role,
                assigned_sub: slot.assigned_sub,
                status: slot.status,
                rationale: slot.rationale,
                decision_rationale: slot.rationale,
              },
            };

            orgSlots.push(itemObj);

            // Show in userSlots if user is assigned or holds role (and not requester), or is admin
            if ((isAssigned || hasRole || isAdmin) && (!isUserRequester || isAdmin)) {
              userSlots.push(itemObj);
            }
          }
        }
      }

      setMyItems(userSlots);
      setAllOrgItems(orgSlots);

      // Default selection
      const listToSelectFrom = userSlots.length > 0 ? userSlots : orgSlots;
      if (listToSelectFrom.length > 0 && !selectedItem) {
        setSelectedItem(listToSelectFrom[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [user, activePersonaId]);

  // Load FORGE Assistance for selected item
  useEffect(() => {
    if (!selectedItem) {
      setAssistanceData(null);
      return;
    }

    const loadAssistance = async () => {
      setIsLoadingAssistance(true);
      try {
        const data = await apiFetch(`/api/requests/${selectedItem.request.id}/assistance`);
        setAssistanceData(data);
      } catch {
        setAssistanceData(null);
      } finally {
        setIsLoadingAssistance(false);
      }
    };

    loadAssistance();
  }, [selectedItem]);

  const handleSubmitDecision = async (
    decision: 'approve' | 'narrow' | 'reject',
    rationale: string,
    narrowedLimits?: { actions?: string[]; duration_minutes?: number }
  ) => {
    if (!activeDrawerItem) return;

    const payload: any = {
      slot_id: activeDrawerItem.slot.id,
      decision,
      rationale: rationale || null,
    };
    if (decision === 'narrow' && narrowedLimits) {
      payload.approved_limits = {
        actions: narrowedLimits.actions || activeDrawerItem.request.actions,
        duration_minutes: narrowedLimits.duration_minutes || activeDrawerItem.request.duration_minutes,
      };
    }

    try {
      const res = await apiFetch(`/api/requests/${activeDrawerItem.request.id}/decisions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const reqStatus = res?.request_status || (res?.request ? res.request.status : 'IN_REVIEW');
      if (reqStatus === 'APPROVED') {
        setSuccessToast({
          message: `All approval tiers complete for ${activeDrawerItem.request.resource_name}! Active Grant automatically generated.`,
          grantId: res?.grant_id,
        });
      } else if (decision === 'reject') {
        setSuccessToast({
          message: `Request for ${activeDrawerItem.request.resource_name} was rejected.`,
        });
      } else {
        setSuccessToast({
          message: `${activeDrawerItem.slot.slot_role} slot approved. Request advanced to next governance reviewer.`,
        });
      }

      setActiveDrawerItem(null);
      await fetchQueue();
      setTimeout(() => setSuccessToast(null), 8000);
    } catch (err) {
      console.error('Decision submission failed', err);
    }
  };

  // Helper to map slot role to persona
  const getPersonaForSlotRole = (role: string) => {
    const rLower = (role || '').toLowerCase();
    if (rLower.includes('manager') || rLower.includes('lead')) return personas.find((p) => p.id === 'carol');
    if (rLower.includes('owner')) return personas.find((p) => p.id === 'david');
    if (rLower.includes('risk') || rLower.includes('compliance')) return personas.find((p) => p.id === 'elena');
    if (rLower.includes('admin') || rLower.includes('executive')) return personas.find((p) => p.id === 'fiona');
    return personas.find((p) => p.id === 'carol');
  };

  const displayedItems = activeTab === 'my' ? myItems : allOrgItems;

  return (
    <div className="page-container" id="review-queue-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Governance Approvals Queue</h1>
          <p className="page-subtitle">
            Multi-Party Hierarchy Review: Immediate Superior (Manager) → Resource Owner → Compliance & Risk Reviewer.
          </p>
        </div>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            color: '#065f46',
            fontSize: '0.925rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={20} color="#059669" />
            <span style={{ fontWeight: 600 }}>{successToast.message}</span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#059669', borderColor: '#059669' }}
            onClick={() => navigate('/grants')}
          >
            <Key size={14} />
            <span>View Active Grants</span>
          </button>
        </div>
      )}

      {/* Prominent Architectural Guide: "Where Do Requests Go For Approval?" */}
      <div
        className="glass-panel"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #cbd5e1',
          borderLeft: '5px solid var(--accent-wine)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <ShieldCheck size={20} color="var(--accent-wine)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Where Do Requests Go For Approval?
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Per <strong>Blueprint §9.1 &amp; SG-1 (Separation of Duties)</strong>, requesters cannot approve their own requests.
              Each access submission routes through 3 mandatory governance tiers before an <strong>Active Grant</strong> is automatically minted:
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 650 }}>EVALUATION SWITCHER:</span>
            {personas.map((p) => {
              const isCurrent = p.id === activePersonaId;
              return (
                <button
                  key={p.id}
                  onClick={() => switchPersona(p.id)}
                  className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    border: isCurrent ? undefined : '1px solid #cbd5e1',
                  }}
                  title={`Switch active persona to ${p.name} (${p.role})`}
                >
                  {p.name.split(' ')[0]} ({p.role.split(' ')[0]})
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Step Approval Pipeline Diagram */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tier 1: Line Management</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>Carol Danvers (Manager)</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Verifies business purpose &amp; team justification.</div>
          </div>

          <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tier 2: Technical Custodian</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>David Miller (Resource Owner)</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Authorizes dataset/model access limits &amp; operations.</div>
          </div>

          <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tier 3: Compliance &amp; Risk</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>Elena Rostova (Risk Reviewer)</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Enforces synthetic constraints, logging, &amp; duration bounds.</div>
          </div>
        </div>
      </div>

      {/* KPI Overview Bar */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">My Pending Slots</div>
            <div className="kpi-val" style={{ color: myItems.length > 0 ? '#e11d48' : 'var(--text-primary)' }}>
              {myItems.length}
            </div>
            <div className="kpi-sub">Assigned to {currentPersona.name} ({currentPersona.role})</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Organization Pipeline</div>
            <div className="kpi-val">{allOrgItems.length}</div>
            <div className="kpi-sub">Total Pending Review Slots in System</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Separation of Duties (SG-1)</div>
            <div className="kpi-val" style={{ color: '#10b981', fontSize: '1.2rem' }}>Strictly Enforced</div>
            <div className="kpi-sub">Self-approval physically blocked at backend</div>
          </div>
        </div>
      </div>

      {/* Tab Switcher: "My Review Queue" vs "All Organization Pending Approvals" */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'my' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('my')}
          id="tab-my-reviews"
        >
          <span>My Review Queue ({myItems.length})</span>
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('all')}
          id="tab-all-reviews"
        >
          <span>All Organization Pending Approvals ({allOrgItems.length})</span>
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading review queue...</p>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <CheckSquare size={42} color="#059669" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            {activeTab === 'my'
              ? `No Pending Review Slots for ${currentPersona.name} (${currentPersona.role})`
              : 'All Governance Reviews Complete!'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto 1.25rem auto', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {activeTab === 'my'
              ? `You are signed in as ${currentPersona.name}. If you submitted an access request, GrantGate prohibits self-approval. To approve your request, switch to Carol (Manager), David (Resource Owner), or Elena (Risk Reviewer).`
              : 'There are no access requests awaiting governance decisions in the system.'}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {allOrgItems.length > 0 && activeTab === 'my' && (
              <button className="btn btn-primary" onClick={() => setActiveTab('all')}>
                <span>View {allOrgItems.length} Organization Review Slots</span>
                <ArrowRight size={14} />
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/requests/new')}>
              Create Access Request
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/grants')}>
              View Active Grants
            </button>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {/* Left: Pending Review Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {displayedItems.map((item) => {
              const isSelf = item.request.requester_id === user?.sub || item.request.requester_sub === user?.sub;
              const isSelected = selectedItem?.request.id === item.request.id && selectedItem?.slot.id === item.slot.id;
              const targetPersona = getPersonaForSlotRole(item.slot.slot_role);
              const isUserEligible =
                user?.roles?.some((r: string) => r.toLowerCase() === item.slot.slot_role.toLowerCase()) &&
                (!isSelf || user?.roles?.some((r: string) => ['admin', 'executive'].includes(r.toLowerCase())));

              return (
                <div
                  key={`${item.request.id}-${item.slot.id}`}
                  className={`glass-panel ${isSelected ? 'glass-panel-glow' : ''}`}
                  style={{
                    cursor: 'pointer',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderLeft: isSelected ? '5px solid var(--accent-wine)' : '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                  }}
                  onClick={() => setSelectedItem(item)}
                  id={`review-item-${item.slot.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.65rem', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                          {item.request.resource_name || item.request.resource_id}
                        </h4>
                        <span className="badge badge-tier-sensitive font-mono" style={{ fontSize: '0.72rem' }}>
                          Slot: {item.slot.slot_role.toUpperCase()}
                        </span>
                        {item.request.is_crucial && (
                          <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem', fontWeight: 700 }}>
                            CRUCIAL DATA
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0' }}>
                        Requester: <strong style={{ color: isSelf ? '#b91c1c' : 'var(--text-primary)' }}>{item.request.requester_name || item.request.requester_id}</strong>
                        {isSelf && ' (YOU - Self-Approval Blocked)'} | Dept: {item.request.requester_dept}
                      </p>
                    </div>

                    {/* Action Button */}
                    {isUserEligible ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDrawerItem(item);
                        }}
                        id={`btn-review-${item.slot.id}`}
                      >
                        <span>Review &amp; Decide</span>
                        <ArrowRight size={14} />
                      </button>
                    ) : targetPersona ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ borderColor: 'var(--accent-wine)', color: 'var(--accent-wine)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          switchPersona(targetPersona.id);
                          setActiveDrawerItem(item);
                        }}
                        id={`btn-switch-review-${item.slot.id}`}
                        title={`Switch to ${targetPersona.name} to approve this slot`}
                      >
                        <span>Switch to {targetPersona.name.split(' ')[0]}</span>
                        <ChevronRight size={14} />
                      </button>
                    ) : null}
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                    <strong>Stated Purpose:</strong> {item.request.purpose_text || item.request.purpose_code || item.request.purpose}
                  </p>

                  {/* Multi-Slot Pipeline Progress for this request */}
                  {item.request.slots && item.request.slots.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.65rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      {item.request.slots.map((s, idx) => {
                        const isDone = s.status === 'APPROVED' || s.status === 'NARROWED';
                        const isThisSlot = s.id === item.slot.id;
                        return (
                          <div
                            key={s.id || idx}
                            style={{
                              padding: '0.25rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: isDone ? '#ecfdf5' : isThisSlot ? '#fef3c7' : '#f1f5f9',
                              color: isDone ? '#047857' : isThisSlot ? '#b45309' : '#64748b',
                              border: `1px solid ${isDone ? '#a7f3d0' : isThisSlot ? '#fde68a' : '#e2e8f0'}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <span>{isDone ? '✓' : isThisSlot ? '⏳' : '○'}</span>
                            <span>{s.slot_role}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid #e2e8f0',
                      paddingTop: '0.65rem',
                    }}
                  >
                    <span>Duration: <strong>{item.request.duration_hours}h</strong></span>
                    <span>Status: <strong style={{ color: '#d97706' }}>{item.request.status}</strong></span>
                    <span>Assigned: <code className="font-mono">{item.slot.assigned_sub}</code></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Request FORGE Hierarchy & Accountability Card */}
          {selectedItem && (
            <div>
              <div className="surface-card" style={{ padding: '1.5rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Sparkles size={20} color="var(--accent-wine)" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Hierarchy &amp; Review Accountability
                  </h3>
                </div>

                {isLoadingAssistance ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading hierarchy guidance...
                  </div>
                ) : assistanceData ? (
                  <div>
                    {/* Requester Identity & Owner Pairing */}
                    <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {assistanceData.requester?.is_agent ? (
                          <Bot size={18} color="#10b981" />
                        ) : (
                          <UserCheck size={18} color="var(--accent-wine)" />
                        )}
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          Requester: {assistanceData.requester?.sub} ({assistanceData.requester?.is_agent ? 'Autonomous AI Agent' : 'Human Employee'})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Department: <strong>{assistanceData.requester?.department}</strong>
                      </div>
                      {assistanceData.requester?.is_agent && (
                        <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.25rem', fontWeight: 600 }}>
                          Accountable Human Owner: {assistanceData.requester?.owner_sub || 'Assigned Supervisor'}
                        </div>
                      )}
                    </div>

                    {/* Governance Escalation Status */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          background: assistanceData.is_crucial ? '#fee2e2' : '#ecfdf5',
                          color: assistanceData.is_crucial ? '#b91c1c' : '#047857',
                          fontWeight: 700,
                        }}
                      >
                        {assistanceData.is_crucial ? 'CRUCIAL DATA (ESCALATED)' : 'STANDARD ROUTING'}
                      </span>
                      {assistanceData.is_cross_dept && (
                        <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                          CROSS-DEPT ACCESS
                        </span>
                      )}
                    </div>

                    {/* Reviewer Guidance for Active Slot */}
                    {(() => {
                      const roleKey = selectedItem.slot.slot_role || selectedItem.slot.required_role || 'manager';
                      const guidance = assistanceData.guidance ? (assistanceData.guidance[roleKey] || assistanceData.guidance['manager']) : undefined;
                      if (!guidance) return null;
                      return (
                        <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--accent-wine)' }}>
                            {guidance.title}
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {guidance.focus_areas.map((fa: string, i: number) => (
                              <li key={i}>{fa}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Quick Action to Open Drawer from Hierarchy card */}
                    <div style={{ marginTop: '1.25rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => {
                          const targetPersona = getPersonaForSlotRole(selectedItem.slot.slot_role);
                          const isEligible = user?.roles?.some((r: string) => r.toLowerCase() === selectedItem.slot.slot_role.toLowerCase());
                          if (!isEligible && targetPersona) {
                            switchPersona(targetPersona.id);
                          }
                          setActiveDrawerItem(selectedItem);
                        }}
                      >
                        <span>Launch Review Decision Drawer</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Select a pending request to inspect accountable ownership and review guidance.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decision Drawer Modal with Intelligent Approval Assistance */}
      {activeDrawerItem && (
        <DecisionDrawer
          request={activeDrawerItem.request}
          slot={activeDrawerItem.slot}
          onClose={() => setActiveDrawerItem(null)}
          onSubmitDecision={handleSubmitDecision}
        />
      )}
    </div>
  );
};

export default ReviewQueuePage;
