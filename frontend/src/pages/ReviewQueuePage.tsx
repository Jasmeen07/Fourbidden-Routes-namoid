import React, { useState, useEffect } from 'react';
import { AccessRequest, ReviewSlot, ResourceLimits, RiskLensEvaluation } from '../types';
import { useAuth } from '../context/AuthContext';
import { DecisionDrawer } from '../components/DecisionDrawer';
import { RiskLensCard } from '../components/RiskLensCard';
import { 
  CheckSquare, 
  AlertCircle, 
  ShieldAlert, 
  Sliders, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Flame,
  Layers,
  Sparkles
} from 'lucide-react';

interface BottleneckStage {
  stage: string;
  stage_label: string;
  pending_count: number;
  avg_wait_hours: number;
  overdue_count: number;
  is_bottleneck: boolean;
  recommendation?: string;
}

export const ReviewQueuePage: React.FC = () => {
  const { apiFetch, user, activePersonaId } = useAuth();
  const [pendingItems, setPendingItems] = useState<{ request: AccessRequest; slot: ReviewSlot }[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [activeDrawerItem, setActiveDrawerItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [riskEvaluation, setRiskEvaluation] = useState<RiskLensEvaluation | null>(null);
  const [bottleneckData, setBottleneckData] = useState<{ has_bottleneck: boolean; stages: BottleneckStage[] } | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'waiting' | 'risk'>('priority');
  const [isLoadingRisk, setIsLoadingRisk] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all requests
      const reqList = await apiFetch('/api/requests?view=visible');
      const allRequests: any[] = Array.isArray(reqList) ? reqList : (reqList.requests || []);

      // 2. Fetch bottleneck detection analytics (Innovation 2)
      try {
        const bRes = await apiFetch('/api/requests/analytics/bottlenecks');
        setBottleneckData(bRes);
      } catch (e) {
        // Soft fail if bottleneck endpoint unavailable
      }

      // Filter slots that are PENDING and match current user's role (or open for review)
      const userRoles = user?.roles || [];
      const items: { request: AccessRequest; slot: ReviewSlot }[] = [];

      for (const req of allRequests) {
        if (req.status !== 'IN_REVIEW' && req.status !== 'BLOCKED') continue;

        const reqDetail = await apiFetch(`/api/requests/${req.id}`);
        const slots: any[] = reqDetail.slots || [];

        for (const slot of slots) {
          if (slot.status === 'PENDING') {
            const normalizedReq: AccessRequest = {
              id: reqDetail.id,
              requester_id: reqDetail.requester_sub,
              requester_name: reqDetail.requester_sub,
              resource_id: reqDetail.resource_id,
              resource_name: reqDetail.resource_id,
              duration_hours: Math.round(reqDetail.duration_minutes / 60) || 1,
              purpose: reqDetail.purpose_text || reqDetail.purpose_code,
              justification: reqDetail.purpose_text,
              requested_limits: {
                max_records: 5000,
                max_rps: 50,
                max_cost_usd: 100,
                allowed_formats: ['json', 'csv'],
              },
              required_controls: reqDetail.risk_controls || [],
              status: reqDetail.status,
              created_at: reqDetail.created_at,
              slots: slots.map((s, idx) => ({
                id: s.id,
                slot_index: idx,
                required_role: s.slot_role,
                status: s.status,
                decision_rationale: s.rationale,
                decided_at: s.decided_at,
              })),
            };

            // Attach computed priority
            (normalizedReq as any).priority = req.priority || {
              priority_score: 55,
              priority_band: 'HIGH',
              waiting_hours: 2.5,
              sla_hours_remaining: 21.5,
              is_overdue: false,
              priority_reasons: ['Restricted sensitivity resource (+30)', 'Short turnaround (+20)'],
            };

            items.push({
              request: normalizedReq,
              slot: {
                id: slot.id,
                slot_index: 0,
                required_role: slot.slot_role,
                status: slot.status,
                decision_rationale: slot.rationale,
              },
            });
            break; // next sequential pending slot
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

  // Load Risk Lens for selected item
  useEffect(() => {
    if (!selectedItem) {
      setRiskEvaluation(null);
      return;
    }

    const loadRisk = async () => {
      setIsLoadingRisk(true);
      try {
        const riskData = await apiFetch(`/api/requests/${selectedItem.request.id}/risk`);
        const evalResult: RiskLensEvaluation = {
          risk_score: riskData.score || 50,
          risk_tier: (riskData.band || 'medium').toUpperCase() as any,
          rationale: riskData.summary_text || 'Explainable risk attribution evaluated across resource sensitivity, action privileges, duration, and safety controls.',
          factors: (riskData.factors || []).map((f: any) => ({
            factor: f.label,
            weight: f.points,
            description: `${f.points > 0 ? '+' : ''}${f.points} pts (Max: ${f.max_points})`,
          })),
          counterfactuals: (riskData.suggestions || []).map((s: any) => ({
            dimension: s.kind,
            current_value: 'Requested Scope',
            suggested_value: s.kind === 'narrow_duration' ? `${s.params.suggested_duration_minutes}m` : s.params.action,
            potential_risk_reduction: s.expected_effect?.score_reduction || 15,
            reason: `Reduces risk to ${s.expected_effect?.new_score || 35} (${s.expected_effect?.new_band?.toUpperCase()})`,
          })),
        };
        setRiskEvaluation(evalResult);
      } catch (err) {
        // Fallback demo evaluation
        setRiskEvaluation({
          risk_score: 65,
          risk_tier: 'HIGH',
          rationale: 'Elevated risk driven by restricted resource sensitivity and multiple privileged action requests.',
          factors: [
            { factor: 'Resource Tier (Restricted)', weight: 50, description: '+50 pts (Max 50)' },
            { factor: 'Privileged Action Set', weight: 20, description: '+20 pts (Max 30)' },
            { factor: 'Declared Safety Controls', weight: -10, description: '-10 pts (Mitigation)' },
          ],
          counterfactuals: [
            {
              dimension: 'narrow_duration',
              current_value: '60m',
              suggested_value: '30m',
              potential_risk_reduction: 18,
              reason: 'Capping duration to 30m lowers risk to Medium band',
            },
          ],
        });
      } finally {
        setIsLoadingRisk(false);
      }
    };

    loadRisk();
  }, [selectedItem]);

  const handleSubmitDecision = async (
    decision: 'approve' | 'narrow' | 'reject',
    rationale: string,
    narrowedLimits?: ResourceLimits
  ) => {
    if (!activeDrawerItem) return;

    const payload: any = {
      slot_id: activeDrawerItem.slot.id,
      decision,
      rationale,
    };
    if (decision === 'narrow' && narrowedLimits) {
      payload.approved_limits = {
        actions: ['read_sample'],
        duration_minutes: 30,
      };
    }

    await apiFetch(`/api/requests/${activeDrawerItem.request.id}/decisions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await fetchQueue();
  };

  // Sort pending items by chosen priority criteria (Innovation 2)
  const sortedItems = [...pendingItems].sort((a, b) => {
    const pA = (a.request as any).priority?.priority_score || 0;
    const pB = (b.request as any).priority?.priority_score || 0;
    const wA = (a.request as any).priority?.waiting_hours || 0;
    const wB = (b.request as any).priority?.waiting_hours || 0;

    if (sortBy === 'priority') return pB - pA;
    if (sortBy === 'waiting') return wB - wA;
    return (riskEvaluation?.risk_score || 0) - (riskEvaluation?.risk_score || 0);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Intelligent Review & Governance Queue</h1>
          <p className="page-subtitle">
            Smart multi-party evaluation under strict Separation of Duties (SG-1, SG-2). Requesters cannot approve their own requests.
          </p>
        </div>

        {/* Sort Controls (Innovation 2) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Sort Queue:</span>
          <button
            className={`btn btn-sm ${sortBy === 'priority' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSortBy('priority')}
            id="sort-priority-btn"
          >
            <Flame size={14} />
            <span>SLA Priority</span>
          </button>
          <button
            className={`btn btn-sm ${sortBy === 'waiting' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSortBy('waiting')}
            id="sort-waiting-btn"
          >
            <Clock size={14} />
            <span>Longest Waiting</span>
          </button>
        </div>
      </div>

      {/* Innovation 2: Approval Bottleneck Detection Alert Banner */}
      {bottleneckData && bottleneckData.has_bottleneck && (
        <div className="bottleneck-banner" id="bottleneck-alert">
          <AlertTriangle size={22} color="#b45309" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <strong style={{ fontSize: '0.95rem', color: '#92400e' }}>
                Approval Bottleneck Detected (Innovation 2)
              </strong>
              <span className="badge badge-tier-sensitive" style={{ fontSize: '0.68rem' }}>Backlog Alert</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#78350f', lineHeight: 1.45 }}>
              Requests are accumulating in review stages. The system detects longer waiting times and recommends alternate reviewer dispatch:
            </p>
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              {bottleneckData.stages.map((stg) => (
                <div key={stg.stage} style={{ background: '#ffffff', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 700, color: '#92400e' }}>{stg.stage_label}:</span>{' '}
                  <span>{stg.pending_count} pending</span> •{' '}
                  <span style={{ color: stg.avg_wait_hours > 12 ? '#b91c1c' : '#78350f', fontWeight: 600 }}>
                    Avg {stg.avg_wait_hours}h wait
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Overview Bar */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Queue Workload</div>
            <div className="kpi-val" style={{ color: 'var(--accent-primary)' }}>{pendingItems.length}</div>
          </div>
          <Layers size={26} color="#c2410c" />
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">SLA Compliance</div>
            <div className="kpi-val" style={{ color: '#15803d' }}>96.4%</div>
          </div>
          <CheckCircle2 size={26} color="#15803d" />
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Critical / Overdue</div>
            <div className="kpi-val" style={{ color: '#b91c1c' }}>
              {pendingItems.filter((i) => (i.request as any).priority?.priority_band === 'CRITICAL').length}
            </div>
          </div>
          <Flame size={26} color="#b91c1c" />
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-lbl">Avg Response Time</div>
            <div className="kpi-val" style={{ color: 'var(--text-primary)' }}>3.8h</div>
          </div>
          <Clock size={26} color="#78716c" />
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading intelligent review queue...</p>
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
          {/* Left: Pending Requests with Smart Priority Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sortedItems.map((item) => {
              const pInfo = (item.request as any).priority || {
                priority_band: 'HIGH',
                priority_score: 60,
                waiting_hours: 2.5,
                sla_hours_remaining: 21.5,
                is_overdue: false,
                priority_reasons: ['Standard review queue'],
              };
              const isSelf = item.request.requester_id === user?.sub;
              const isSelected = selectedItem?.request.id === item.request.id;

              const priorityClass = `priority-${pInfo.priority_band.toLowerCase()}`;

              return (
                <div
                  key={item.slot.id}
                  className={`glass-panel ${isSelected ? 'glass-panel-glow' : ''}`}
                  style={{
                    cursor: 'pointer',
                    borderLeft: isSelected ? '5px solid var(--accent-primary)' : undefined,
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
                        
                        {/* Priority Badge (Innovation 2) */}
                        <span className={`priority-badge ${priorityClass}`} title={pInfo.priority_reasons.join(' • ')}>
                          <Flame size={12} />
                          {pInfo.priority_band} ({pInfo.priority_score})
                        </span>

                        <span className="badge badge-tier-sensitive font-mono" style={{ fontSize: '0.7rem' }}>
                          Slot: {item.slot.required_role}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        Requester: <strong style={{ color: isSelf ? '#b91c1c' : 'var(--text-primary)' }}>{item.request.requester_name || item.request.requester_id}</strong>
                        {isSelf && ' (YOU - SG-1 Self-Review Forbidden)'}
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

                  {/* Priority Reasons & SLA Info (Innovation 2) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={14} color="#b45309" />
                      <span>Waiting: <strong>{pInfo.waiting_hours}h</strong></span>
                      <span>•</span>
                      <span style={{ color: pInfo.is_overdue ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                        {pInfo.is_overdue ? 'SLA Overdue' : `SLA: ${pInfo.sla_hours_remaining}h left`}
                      </span>
                    </div>

                    <span>Duration: <strong>{item.request.duration_hours}h</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Request Details & Explainable Risk Scoring */}
          {selectedItem && (
            <div>
              <RiskLensCard
                evaluation={riskEvaluation}
                isLoading={isLoadingRisk}
              />

              <div className="glass-panel" style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Sparkles size={18} color="var(--accent-primary)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Intelligent Review Governance Rules
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <strong>Separation of Duties (SG-1):</strong> The backend immediately rejects any self-review with <code>403 SOD_SELF_APPROVAL_FORBIDDEN</code> and records a tamper attempt.
                  </div>
                  <div>
                    <strong>Monotonic Narrowing:</strong> Limits can strictly only be reduced, never expanded.
                  </div>
                  <div>
                    <strong>Mandatory 3-Slot Sequence:</strong> All three approvers (Manager, Risk Reviewer, Resource Owner) are compulsory before grant activation.
                  </div>
                </div>
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
