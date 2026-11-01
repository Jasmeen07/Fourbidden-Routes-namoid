import React, { useState, useEffect } from 'react';
import { AccessRequest, ReviewSlot, ResourceLimits, ApprovalAssistanceData } from '../types';
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
} from 'lucide-react';

export const ReviewQueuePage: React.FC = () => {
  const { apiFetch, user, activePersonaId } = useAuth();
  const [pendingItems, setPendingItems] = useState<{ request: AccessRequest; slot: ReviewSlot }[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [activeDrawerItem, setActiveDrawerItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [assistanceData, setAssistanceData] = useState<ApprovalAssistanceData | null>(null);
  const [isLoadingAssistance, setIsLoadingAssistance] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const reqList = await apiFetch('/api/requests?view=visible');
      const allRequests: any[] = Array.isArray(reqList) ? reqList : (reqList.requests || []);

      const items: { request: AccessRequest; slot: ReviewSlot }[] = [];

      for (const req of allRequests) {
        if (req.status !== 'IN_REVIEW' && req.status !== 'BLOCKED') continue;

        const reqDetail = await apiFetch(`/api/requests/${req.id}`);
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
          duration_hours: Math.round(reqDetail.duration_minutes / 60) || 1,
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

            // Show slot if user is assigned, holds role (and not requester), or is admin
            if ((isAssigned || hasRole || isAdmin) && (!isUserRequester || isAdmin)) {
              items.push({
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
              });
            }
          }
        }
      }

      setPendingItems(items);
      if (items.length > 0 && !selectedItem) {
        setSelectedItem(items[0]);
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

    await apiFetch(`/api/requests/${activeDrawerItem.request.id}/decisions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setActiveDrawerItem(null);
    await fetchQueue();
  };

  return (
    <div className="page-container" id="review-queue-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Governance Approvals Queue</h1>
          <p className="page-subtitle">
            Organizational hierarchy decision enforcement: Immediate Superior routing and Crucial Data multi-tier escalation.
          </p>
        </div>
      </div>

      {/* KPI Overview Bar */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Queue Workload</div>
            <div className="kpi-val">{pendingItems.length}</div>
            <div className="kpi-sub">Pending Review Slots</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Governance Policy</div>
            <div className="kpi-val" style={{ fontSize: '1.1rem' }}>Hierarchy Bound</div>
            <div className="kpi-sub">Immediate superior or multi-tier</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Separation of Duties</div>
            <div className="kpi-val" style={{ color: '#10b981' }}>Enforced</div>
            <div className="kpi-sub">Datalog self-approval block</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading review queue...</p>
        </div>
      ) : pendingItems.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <CheckSquare size={38} color="#15803d" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Review Queue is All Clear!
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            No pending review slots assigned to your active role (<strong className="font-mono">{user?.roles.join(', ') || 'NONE'}</strong>).
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {/* Left: Pending Requests */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingItems.map((item) => {
              const isSelf = item.request.requester_id === user?.sub;
              const isSelected = selectedItem?.request.id === item.request.id;

              return (
                <div
                  key={item.slot.id}
                  className={`glass-panel ${isSelected ? 'glass-panel-glow' : ''}`}
                  style={{
                    cursor: 'pointer',
                    borderLeft: isSelected ? '5px solid var(--accent-wine)' : undefined,
                  }}
                  onClick={() => setSelectedItem(item)}
                  id={`review-item-${item.slot.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {item.request.resource_name || item.request.resource_id}
                        </h4>

                        <span className="badge badge-tier-sensitive font-mono" style={{ fontSize: '0.7rem' }}>
                          Slot: {item.slot.required_role}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        Requester: <strong style={{ color: isSelf ? '#b91c1c' : 'var(--text-primary)' }}>{item.request.requester_name || item.request.requester_id}</strong>
                        {isSelf && ' (YOU - Self-Review Forbidden)'}
                      </p>
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDrawerItem(item);
                      }}
                      id={`btn-review-${item.slot.id}`}
                    >
                      <span>Review</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    <strong>Stated Purpose:</strong> {item.request.purpose}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                    <span>Duration: <strong>{item.request.duration_hours}h</strong></span>
                    <span>Status: <strong>{item.request.status}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Request FORGE Hierarchy & Accountability Card */}
          {selectedItem && (
            <div>
              <div className="surface-card" style={{ padding: '1.5rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Sparkles size={20} color="var(--accent-wine)" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    Hierarchy & Accountability Details
                  </h3>
                </div>

                {isLoadingAssistance ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading hierarchy guidance...
                  </div>
                ) : assistanceData ? (
                  <div>
                    {/* Requester Identity & Owner Pairing */}
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {assistanceData.requester?.is_agent ? (
                          <Bot size={18} color="#10b981" />
                        ) : (
                          <UserCheck size={18} color="var(--accent-wine)" />
                        )}
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
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
                          background: assistanceData.is_crucial ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: assistanceData.is_crucial ? '#ef4444' : '#10b981',
                          fontWeight: 700,
                        }}
                      >
                        {assistanceData.is_crucial ? 'CRUCIAL DATA (ESCALATED)' : 'STANDARD ROUTING'}
                      </span>
                      {assistanceData.is_cross_dept && (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700 }}>
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
                        <div style={{ background: 'var(--bg-subtle)', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
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

                    {/* Prior Approver Lineage */}
                    {assistanceData.lineage && assistanceData.lineage.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                          Prior Approver Lineage:
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                          {assistanceData.lineage.map((item, idx) => (
                            <div key={idx} style={{ background: 'var(--bg-subtle)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                              <strong>{item.slot_role.toUpperCase()}:</strong> {item.decided_by_sub} &bull;{' '}
                              <span style={{ color: item.status === 'APPROVED' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                                {item.decision.toUpperCase()}
                              </span>
                              {item.rationale && <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{item.rationale}"</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
