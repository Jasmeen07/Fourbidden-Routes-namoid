import React, { useState, useEffect } from 'react';
import { AccessRequest, ReviewSlot, ResourceLimits, RiskLensEvaluation } from '../types';
import { useAuth } from '../context/AuthContext';
import { DecisionDrawer } from '../components/DecisionDrawer';
import { RiskLensCard } from '../components/RiskLensCard';
import { CheckSquare, AlertCircle, ShieldAlert, Sliders, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export const ReviewQueuePage: React.FC = () => {
  const { apiFetch, user, activePersonaId } = useAuth();
  const [pendingItems, setPendingItems] = useState<{ request: AccessRequest; slot: ReviewSlot }[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [activeDrawerItem, setActiveDrawerItem] = useState<{ request: AccessRequest; slot: ReviewSlot } | null>(null);
  const [riskEvaluation, setRiskEvaluation] = useState<RiskLensEvaluation | null>(null);
  const [isLoadingRisk, setIsLoadingRisk] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      // Get all requests
      const data = await apiFetch('/api/requests');
      const allRequests: AccessRequest[] = data.requests || [];

      // Filter slots that are PENDING and match current user's role (or open for review)
      const userRoles = user?.roles || [];
      const items: { request: AccessRequest; slot: ReviewSlot }[] = [];

      for (const req of allRequests) {
        if (req.status !== 'IN_REVIEW' && req.status !== 'BLOCKED') continue;

        for (const slot of req.slots) {
          if (slot.status === 'PENDING') {
            // Find the first pending slot (sequential order)
            const isEligibleRole = userRoles.includes(slot.required_role);
            items.push({ request: req, slot });
            break; // only next pending slot in sequence
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
        const payload = {
          resource_id: selectedItem.request.resource_id,
          duration_hours: selectedItem.request.duration_hours,
          purpose: selectedItem.request.purpose,
          justification: selectedItem.request.justification,
          requested_limits: selectedItem.request.requested_limits,
          required_controls: selectedItem.request.required_controls,
        };
        const evalResult = await apiFetch('/api/ai/risk-lens/evaluate', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setRiskEvaluation(evalResult);
      } catch (err) {
        // Soft fail
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
      decision,
      rationale,
    };
    if (decision === 'narrow' && narrowedLimits) {
      payload.narrowed_limits = narrowedLimits;
    }

    await apiFetch(`/api/reviews/${activeDrawerItem.slot.id}/decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await fetchQueue();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Review & Governance Queue</h1>
          <p className="page-subtitle">
            Accountable human review under Separation of Duties (SG-1, SG-2). Requesters cannot approve their own requests.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>Loading review queue...</p>
        </div>
      ) : pendingItems.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <CheckSquare size={36} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
            Queue is All Clear!
          </h3>
          <p style={{ color: '#94a3b8' }}>
            No pending review slots assigned to your active role (<strong className="font-mono">{user?.roles.join(', ') || 'NONE'}</strong>).
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {/* Left: Pending Requests List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingItems.map((item) => {
              const isSelf = item.request.requester_id === user?.sub;
              const hasRole = user?.roles.includes(item.slot.required_role);
              const isSelected = selectedItem?.request.id === item.request.id;

              return (
                <div
                  key={item.slot.id}
                  className={`glass-panel ${isSelected ? 'glass-panel-glow' : ''}`}
                  style={{
                    cursor: 'pointer',
                    borderLeft: isSelected ? '4px solid #6366f1' : undefined,
                  }}
                  onClick={() => setSelectedItem(item)}
                  id={`review-item-${item.slot.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                          {item.request.resource_name || item.request.resource_id}
                        </h4>
                        <span className="badge badge-tier-sensitive font-mono" style={{ fontSize: '0.7rem' }}>
                          Slot {item.slot.slot_index + 1}: {item.slot.required_role}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Requester: <strong style={{ color: isSelf ? '#f43f5e' : '#e2e8f0' }}>{item.request.requester_name || item.request.requester_id}</strong>
                        {isSelf && ' (YOU - Self Review Forbidden)'}
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

                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    <strong>Purpose:</strong> {item.request.purpose}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <span>Duration: <strong>{item.request.duration_hours}h</strong></span>
                    <span>Max Records: <strong>{item.request.requested_limits.max_records?.toLocaleString() || 'N/A'}</strong></span>
                    <span>Max RPS: <strong>{item.request.requested_limits.max_rps || 'N/A'}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Request Details & Risk Lens */}
          {selectedItem && (
            <div>
              <RiskLensCard
                evaluation={riskEvaluation}
                isLoading={isLoadingRisk}
              />

              <div className="glass-panel" style={{ marginTop: '1.25rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
                  Slot Review Security Controls
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: '#cbd5e1' }}>
                  <div>
                    <strong>SoD Invariant (SG-1):</strong> A requester can NEVER review or approve their own request under any circumstance.
                  </div>
                  <div>
                    <strong>Dual-Slot Invariant (SG-2):</strong> The same reviewer cannot decide multiple slots on the same request.
                  </div>
                  <div>
                    <strong>Monotonic Narrowing:</strong> Any modifications to limits can only shrink bounds, never expand them.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decision Drawer Modal */}
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
