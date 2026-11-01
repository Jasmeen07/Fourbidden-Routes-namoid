import { AccessRequest, Grant, Resource, GovernanceNotification, NotificationSlotSummary } from '../types';
import type { UserInfo } from './AuthContext';

const STORAGE_KEY_REQUESTS = 'gg_mock_requests';
const STORAGE_KEY_GRANTS = 'gg_mock_grants';
const STORAGE_KEY_NOTIFICATIONS = 'gg_mock_notifications';

export const INITIAL_RESOURCES: Resource[] = [
  {
    id: 'D-customers-synth',
    name: 'Synthetic Customer Profiles Dataset',
    type: 'DATASET',
    tier: 'RESTRICTED_SYNTHETIC',
    description: 'De-identified customer demographics, transactions, and behavior logs for evaluation.',
    allowed_actions: ['read_sample', 'read_full', 'export_masked'],
    max_duration_hours: 24,
    required_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    department: 'Customer Intelligence',
    is_active: true,
  },
  {
    id: 'D-claims-synth',
    name: 'Synthetic Insurance Claims Dataset',
    type: 'DATASET',
    tier: 'RESTRICTED_SYNTHETIC',
    description: 'Synthetically generated insurance claim submissions for fraud detection and risk scoring.',
    allowed_actions: ['read_sample', 'read_full'],
    max_duration_hours: 24,
    required_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    department: 'Risk Operations',
    is_active: true,
  },
  {
    id: 'M-sentiment-v1',
    name: 'Customer Sentiment Model v1',
    type: 'MODEL',
    tier: 'INTERNAL_SYNTHETIC',
    description: 'Fine-tuned transformer model for real-time customer sentiment and conversational scoring.',
    allowed_actions: ['query', 'fine_tune'],
    max_duration_hours: 72,
    required_controls: ['activity_logging', 'synthetic_data_only'],
    department: 'AI Engineering',
    is_active: true,
  },
  {
    id: 'M-credit-risk-v2',
    name: 'Credit Risk Scoring Model',
    type: 'MODEL',
    tier: 'TIER_1_CRITICAL',
    description: 'Tier-1 critical machine learning model evaluating borrower risk and probability of default.',
    allowed_actions: ['query'],
    max_duration_hours: 12,
    required_controls: ['activity_logging', 'synthetic_data_only', 'output_filtering'],
    department: 'Risk Analytics',
    is_active: true,
  },
];

export const INITIAL_REQUESTS: AccessRequest[] = [
  {
    id: 'req_ce1533b83e90',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Customer Intelligence',
    resource_id: 'D-customers-synth',
    resource_name: 'Synthetic Customer Profiles Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'MODEL_EVALUATION',
    purpose_text: 'Evaluation of model reasoning and accuracy boundaries for quarterly safety report.',
    actions: ['read_sample', 'read_full', 'export_masked'],
    duration_minutes: 1440,
    duration_hours: 24,
    risk_controls: ['activity_logging', 'synthetic_data_only'],
    status: 'IN_REVIEW',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    slots: [
      {
        id: 'slot_mgr_01',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'PENDING',
      },
      {
        id: 'slot_own_01',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'PENDING',
      },
      {
        id: 'slot_rsk_01',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'PENDING',
      },
    ],
  },
  {
    id: 'req_6b7cb0ad54c1',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Risk Operations',
    resource_id: 'D-claims-synth',
    resource_name: 'Synthetic Insurance Claims Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'FRAUD_RULE_TUNING',
    purpose_text: 'Evaluating claims classifier accuracy on synthetic data.',
    actions: ['read_sample'],
    duration_minutes: 720,
    duration_hours: 12,
    risk_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    status: 'IN_REVIEW',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    slots: [
      {
        id: 'slot_mgr_02',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'PENDING',
      },
      {
        id: 'slot_own_02',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'PENDING',
      },
      {
        id: 'slot_rsk_02',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'PENDING',
      },
    ],
  },
  {
    id: 'req_demo_approved',
    requester_sub: 'alice',
    requester_id: 'alice',
    requester_name: 'Alice Chen',
    requester_dept: 'AI Engineering',
    resource_id: 'M-sentiment-v1',
    resource_name: 'Customer Sentiment Model v1',
    resource_tier: 'INTERNAL_SYNTHETIC',
    purpose_code: 'PROTOTYPE_DEMO',
    purpose_text: 'Production readiness validation and sentiment scoring benchmarking.',
    actions: ['query'],
    duration_minutes: 2880,
    duration_hours: 48,
    risk_controls: ['activity_logging', 'synthetic_data_only'],
    status: 'APPROVED',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    slots: [
      {
        id: 'slot_mgr_03',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Approved for scheduled evaluation window.',
        decided_by_sub: 'carol',
        decided_at: new Date(Date.now() - 3600000 * 23).toISOString(),
      },
      {
        id: 'slot_own_03',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Technical resource access confirmed safe.',
        decided_by_sub: 'david',
        decided_at: new Date(Date.now() - 3600000 * 22).toISOString(),
      },
      {
        id: 'slot_rsk_03',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Synthetic data boundary verified with strict logging.',
        decided_by_sub: 'elena',
        decided_at: new Date(Date.now() - 3600000 * 21).toISOString(),
      },
    ],
  },
  {
    id: 'req_priya_claims_approved',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Risk Operations',
    resource_id: 'D-claims-synth',
    resource_name: 'Synthetic Insurance Claims Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'FRAUD_RULE_TUNING',
    purpose_text: 'Evaluating claims classifier accuracy on synthetic data.',
    actions: ['read_sample'],
    duration_minutes: 1440,
    duration_hours: 24,
    risk_controls: ['activity_logging', 'synthetic_data_only', 'isolated_workspace'],
    status: 'APPROVED',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    slots: [
      {
        id: 'slot_priya_mgr_01',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Approved for fraud detection benchmarking in isolated workspace.',
        decided_by_sub: 'carol',
        decided_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'slot_priya_own_01',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Synthetic claims dataset sample read parameters verified.',
        decided_by_sub: 'david',
        decided_at: new Date(Date.now() - 3600000 * 4.5).toISOString(),
      },
      {
        id: 'slot_priya_rsk_01',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'NARROWED',
        decision: 'NARROW',
        rationale: 'Approved with duration capped at 24h and activity logging enforced (SG-6).',
        approved_limits: { duration_minutes: 1440, actions: ['read_sample'] },
        decided_by_sub: 'elena',
        decided_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
  },
  {
    id: 'req_priya_credit_rejected',
    requester_sub: 'priya',
    requester_id: 'priya',
    requester_name: 'Priya Sharma',
    requester_dept: 'Customer Intelligence',
    resource_id: 'M-credit-risk-v2',
    resource_name: 'Credit Risk Scoring Model',
    resource_tier: 'TIER_1_CRITICAL',
    purpose_code: 'MODEL_EVALUATION',
    purpose_text: 'Model bias audit and quarterly scoring benchmark.',
    actions: ['query'],
    duration_minutes: 720,
    duration_hours: 12,
    risk_controls: ['activity_logging', 'output_filtering'],
    status: 'REJECTED',
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
    slots: [
      {
        id: 'slot_priya_rej_mgr',
        slot_index: 0,
        slot_role: 'manager',
        assigned_sub: 'carol',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Business justification confirmed for quarterly risk modeling.',
        decided_by_sub: 'carol',
        decided_at: new Date(Date.now() - 3600000 * 9).toISOString(),
      },
      {
        id: 'slot_priya_rej_own',
        slot_index: 1,
        slot_role: 'resource_owner',
        assigned_sub: 'david',
        status: 'APPROVED',
        decision: 'APPROVE',
        rationale: 'Model query endpoint available.',
        decided_by_sub: 'david',
        decided_at: new Date(Date.now() - 3600000 * 8.5).toISOString(),
      },
      {
        id: 'slot_priya_rej_rsk',
        slot_index: 2,
        slot_role: 'risk_reviewer',
        assigned_sub: 'elena',
        status: 'REJECTED',
        decision: 'REJECT',
        rationale: 'Tier-1 critical model export violates SG-2 cross-tier policy without hardware containment.',
        decided_by_sub: 'elena',
        decided_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ],
  },
];

export const INITIAL_GRANTS: Grant[] = [
  {
    id: 'grant_synth_cust_01',
    request_id: 'req_demo_approved',
    requester_sub: 'alice',
    subject_id: 'alice',
    subject_name: 'Alice Chen',
    resource_id: 'M-sentiment-v1',
    resource_name: 'Customer Sentiment Model v1',
    resource_tier: 'INTERNAL_SYNTHETIC',
    purpose_code: 'PROTOTYPE_DEMO',
    actions: ['query'],
    duration_seconds: 172800,
    status: 'ACTIVE',
    effective_status: 'ACTIVE',
    activated_at: new Date(Date.now() - 3600000 * 21).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 27).toISOString(),
    invocation_count: 58,
    utilization_status: 'ACTIVE_UTILIZING',
  },
  {
    id: 'grant_claims_priya_02',
    request_id: 'req_priya_claims_approved',
    requester_sub: 'priya',
    subject_id: 'priya',
    subject_name: 'Priya Sharma',
    resource_id: 'D-claims-synth',
    resource_name: 'Synthetic Insurance Claims Dataset',
    resource_tier: 'RESTRICTED_SYNTHETIC',
    purpose_code: 'FRAUD_RULE_TUNING',
    actions: ['read_sample'],
    duration_seconds: 86400,
    status: 'ACTIVE',
    effective_status: 'ACTIVE',
    activated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 20).toISOString(),
    invocation_count: 24,
    utilization_status: 'ACTIVE_UTILIZING',
  },
];

export const INITIAL_NOTIFICATIONS: GovernanceNotification[] = [
  {
    id: 'notif_001',
    to_sub: 'priya',
    kind: 'REQUEST_APPROVED',
    ref_id: 'grant_claims_priya_02',
    request_id: 'req_priya_claims_approved',
    grant_id: 'grant_claims_priya_02',
    resource_name: 'Synthetic Insurance Claims Dataset',
    title: 'Access Request Approved',
    message: 'Access request req_priya_claims for Synthetic Insurance Claims Dataset was APPROVED by all reviewers! An active grant is now enforced.',
    summary_breakdown: [
      {
        slot_role: 'Manager',
        reviewer_name: 'Carol Danvers',
        reviewer_sub: 'carol',
        decision: 'APPROVED',
        rationale: 'Approved for fraud detection benchmarking in isolated workspace.',
        decided_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        slot_role: 'Resource Owner',
        reviewer_name: 'David Miller',
        reviewer_sub: 'david',
        decision: 'APPROVED',
        rationale: 'Synthetic claims dataset sample read parameters verified.',
        decided_at: new Date(Date.now() - 3600000 * 4.5).toISOString(),
      },
      {
        slot_role: 'Risk Reviewer',
        reviewer_name: 'Elena Rostova',
        reviewer_sub: 'elena',
        decision: 'NARROWED',
        rationale: 'Approved with duration capped at 24h and activity logging enforced (SG-6).',
        decided_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    read: false,
  },
  {
    id: 'notif_002',
    to_sub: 'priya',
    kind: 'REQUEST_REJECTED',
    ref_id: 'req_priya_credit_rejected',
    request_id: 'req_priya_credit_rejected',
    resource_name: 'Credit Risk Scoring Model',
    title: 'Access Request Rejected',
    message: 'Access request req_priya_credit for Credit Risk Scoring Model was REJECTED by Elena Rostova (Risk Reviewer).',
    summary_breakdown: [
      {
        slot_role: 'Manager',
        reviewer_name: 'Carol Danvers',
        reviewer_sub: 'carol',
        decision: 'APPROVED',
        rationale: 'Business justification confirmed for quarterly risk modeling.',
        decided_at: new Date(Date.now() - 3600000 * 9).toISOString(),
      },
      {
        slot_role: 'Resource Owner',
        reviewer_name: 'David Miller',
        reviewer_sub: 'david',
        decision: 'APPROVED',
        rationale: 'Model query endpoint available.',
        decided_at: new Date(Date.now() - 3600000 * 8.5).toISOString(),
      },
      {
        slot_role: 'Risk Reviewer',
        reviewer_name: 'Elena Rostova',
        reviewer_sub: 'elena',
        decision: 'REJECTED',
        rationale: 'Tier-1 critical model export violates SG-2 cross-tier policy without hardware containment.',
        decided_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    read: false,
  },
  {
    id: 'notif_003',
    to_sub: 'priya',
    kind: 'SECURITY_ALERT',
    ref_id: 'audit_event_join_block',
    resource_name: 'Employee Records → Salary Records',
    title: 'Security Alert: Join Blocked',
    message: 'Blocked join attempt on Employee Records → Salary Records under SG-2 separation rule.',
    summary_breakdown: [],
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    read: true,
  },
];


function getStoredRequests(): AccessRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REQUESTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall back to initial
  }
  return INITIAL_REQUESTS;
}

function saveStoredRequests(requests: AccessRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
  } catch {}
}

function getStoredGrants(): Grant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GRANTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall back to initial
  }
  return INITIAL_GRANTS;
}

function saveStoredGrants(grants: Grant[]) {
  try {
    localStorage.setItem(STORAGE_KEY_GRANTS, JSON.stringify(grants));
  } catch {}
}

function getStoredNotifications(): GovernanceNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall back to initial
  }
  return INITIAL_NOTIFICATIONS;
}

function saveStoredNotifications(notifs: GovernanceNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifs));
  } catch {}
}


export function handleMockApi(path: string, options: RequestInit = {}, currentUser?: UserInfo | null): any {
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(path, 'http://localhost');
  const pathname = url.pathname;

  // 1. Resources
  if (pathname === '/api/resources' && method === 'GET') {
    return INITIAL_RESOURCES;
  }

  // 2. Requests list
  if (pathname === '/api/requests' && method === 'GET') {
    const requests = getStoredRequests();
    const view = url.searchParams.get('view') || 'mine';
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isAdmin = roles.includes('admin') || roles.includes('executive');

    if (view === 'mine') {
      return requests.filter((r) => r.requester_sub === sub);
    }
    if (view === 'assigned') {
      return requests.filter((r) => {
        if (r.requester_sub === sub) return false;
        return r.slots?.some(
          (s) => s.status === 'PENDING' && (s.assigned_sub === sub || roles.includes(s.slot_role.toLowerCase()))
        );
      });
    }
    if (view === 'visible' || view === 'all') {
      if (isAdmin) return requests;
      return requests.filter(
        (r) =>
          r.requester_sub === sub ||
          r.slots?.some((s) => s.assigned_sub === sub || roles.includes(s.slot_role.toLowerCase()))
      );
    }
    return requests;
  }

  // 3. Submit Request
  if (pathname === '/api/requests' && method === 'POST') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const resId = body.resource_id;
    const resource = INITIAL_RESOURCES.find((r) => r.id === resId) || INITIAL_RESOURCES[0];
    const sub = currentUser?.sub || 'priya';
    const displayName = currentUser?.display_name || 'Priya Sharma';

    const newReqId = `req_${Date.now().toString(36)}`;
    const newReq: AccessRequest = {
      id: newReqId,
      requester_sub: sub,
      requester_id: sub,
      requester_name: displayName,
      requester_dept: 'Engineering',
      resource_id: resId,
      resource_name: resource.name,
      resource_tier: resource.tier,
      purpose_code: body.purpose_code || 'MODEL_EVALUATION',
      purpose_text: body.purpose_text || 'Business evaluation purpose declared under multi-party governance.',
      actions: body.actions || resource.allowed_actions,
      duration_minutes: body.duration_minutes || 1440,
      duration_hours: Math.round((body.duration_minutes || 1440) / 60),
      risk_controls: body.risk_controls || ['activity_logging', 'synthetic_data_only'],
      status: 'IN_REVIEW',
      created_at: new Date().toISOString(),
      slots: [
        {
          id: `slot_mgr_${Date.now()}`,
          slot_index: 0,
          slot_role: 'manager',
          assigned_sub: 'carol',
          status: 'PENDING',
        },
        {
          id: `slot_own_${Date.now() + 1}`,
          slot_index: 1,
          slot_role: 'resource_owner',
          assigned_sub: 'david',
          status: 'PENDING',
        },
        {
          id: `slot_rsk_${Date.now() + 2}`,
          slot_index: 2,
          slot_role: 'risk_reviewer',
          assigned_sub: 'elena',
          status: 'PENDING',
        },
      ],
    };

    const requests = getStoredRequests();
    saveStoredRequests([newReq, ...requests]);
    return newReq;
  }

  // 4. Single Request detail
  if (pathname.startsWith('/api/requests/') && method === 'GET' && !pathname.includes('/slots/') && !pathname.includes('/withdraw')) {
    const reqId = pathname.replace('/api/requests/', '');
    const requests = getStoredRequests();
    const req = requests.find((r) => r.id === reqId);
    if (!req) return requests[0];
    return req;
  }

  // 5. Review slot decision
  const isDecisionRoute =
    (pathname.endsWith('/decisions') || (pathname.includes('/slots/') && pathname.endsWith('/decision'))) &&
    method === 'POST';
  if (isDecisionRoute) {
    const parts = pathname.split('/');
    const reqId = parts[3];
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const slotId = body.slot_id || (parts[4] === 'slots' ? parts[5] : null);
    const requests = getStoredRequests();

    const reqIdx = requests.findIndex((r) => r.id === reqId);
    if (reqIdx >= 0) {
      const req = { ...requests[reqIdx] };
      const slot = req.slots.find((s) => s.id === slotId || (body.slot_role && s.slot_role === body.slot_role));
      if (slot) {
        const decUpper = String(body.decision || 'APPROVE').toUpperCase();
        slot.decision = decUpper;
        slot.status = decUpper === 'REJECT' ? 'REJECTED' : (decUpper === 'NARROW' || body.approved_limits ? 'NARROWED' : 'APPROVED');
        slot.rationale = body.rationale || 'Reviewed and decided under multi-party governance.';
        slot.decided_by_sub = currentUser?.sub || 'reviewer';
        slot.decided_at = new Date().toISOString();
        if (body.approved_limits) {
          slot.approved_limits = body.approved_limits;
        }
      }

      // Check all slots
      const allApproved = req.slots.every((s) => s.status === 'APPROVED' || s.status === 'NARROWED');
      const anyRejected = req.slots.some((s) => s.status === 'REJECTED');

      if (anyRejected) {
        req.status = 'REJECTED';

        // Notify requester of rejection with reviewer breakdown
        const rejectingSlot = req.slots.find((s) => s.status === 'REJECTED');
        const revName = currentUser?.display_name || currentUser?.sub || rejectingSlot?.assigned_sub || 'Reviewer';
        const notifs = getStoredNotifications();
        const breakdown: NotificationSlotSummary[] = req.slots.map((s) => ({
          slot_role: s.slot_role,
          reviewer_name:
            s.decided_by_sub && currentUser && s.decided_by_sub === currentUser.sub
              ? (currentUser.display_name || currentUser.sub)
              : s.decided_by_sub || s.assigned_sub || 'Assigned Reviewer',
          reviewer_sub: s.decided_by_sub || s.assigned_sub || 'reviewer',
          decision: (s.status as any) || 'PENDING',
          rationale: s.rationale || 'Pending review',
          decided_at: s.decided_at,
        }));


        notifs.unshift({
          id: `notif_${Date.now().toString(36)}`,
          to_sub: req.requester_sub,
          kind: 'REQUEST_REJECTED',
          ref_id: req.id,
          request_id: req.id,
          resource_name: req.resource_name || req.resource_id,
          title: `Access Request Rejected`,
          message: `Access request ${req.id.slice(0, 10)} for ${req.resource_name || req.resource_id} was REJECTED by ${revName} (${rejectingSlot?.slot_role}). Rationale: "${rejectingSlot?.rationale || 'Policy criteria not met'}"`,
          summary_breakdown: breakdown,
          created_at: new Date().toISOString(),
          read: false,
        });
        saveStoredNotifications(notifs);
      } else if (allApproved) {
        req.status = 'APPROVED';

        // Auto-activate Grant
        const grants = getStoredGrants();
        let finalDurationMin = req.duration_minutes || 1440;
        let finalActions = [...(req.actions || [])];

        req.slots.forEach((s) => {
          if (s.approved_limits) {
            if (s.approved_limits.duration_minutes) {
              finalDurationMin = Math.min(finalDurationMin, Number(s.approved_limits.duration_minutes));
            }
            if (Array.isArray(s.approved_limits.actions)) {
              finalActions = finalActions.filter((a) => s.approved_limits!.actions!.includes(a));
            }
          }
        });

        const newGrant: Grant = {
          id: `grant_${Date.now().toString(36)}`,
          request_id: req.id,
          requester_sub: req.requester_sub,
          subject_id: req.requester_sub,
          subject_name: req.requester_name || req.requester_sub,
          resource_id: req.resource_id,
          resource_name: req.resource_name,
          resource_tier: req.resource_tier,
          purpose_code: req.purpose_code,
          actions: finalActions.length > 0 ? finalActions : req.actions,
          duration_seconds: finalDurationMin * 60,
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          activated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + finalDurationMin * 60 * 1000).toISOString(),
          invocation_count: 0,
          utilization_status: 'ACTIVE_UTILIZING',
        };

        const existingIdx = grants.findIndex((g) => g.request_id === req.id);
        if (existingIdx >= 0) {
          grants[existingIdx] = newGrant;
        } else {
          grants.unshift(newGrant);
        }
        saveStoredGrants(grants);

        // Notify requester of approval with full summary breakdown
        const notifs = getStoredNotifications();
        const breakdown: NotificationSlotSummary[] = req.slots.map((s) => ({
          slot_role: s.slot_role,
          reviewer_name:
            s.decided_by_sub && currentUser && s.decided_by_sub === currentUser.sub
              ? (currentUser.display_name || currentUser.sub)
              : s.decided_by_sub || s.assigned_sub || 'Assigned Reviewer',
          reviewer_sub: s.decided_by_sub || s.assigned_sub || 'reviewer',
          decision: (s.status as any) || 'APPROVED',
          rationale: s.rationale || 'Approved under multi-party governance controls',
          decided_at: s.decided_at,
        }));


        notifs.unshift({
          id: `notif_${Date.now().toString(36)}`,
          to_sub: req.requester_sub,
          kind: 'REQUEST_APPROVED',
          ref_id: newGrant.id,
          request_id: req.id,
          grant_id: newGrant.id,
          resource_name: req.resource_name || req.resource_id,
          title: `Access Request Approved`,
          message: `Access request ${req.id.slice(0, 10)} for ${req.resource_name || req.resource_id} was APPROVED by all reviewers! An active grant is now enforced.`,
          summary_breakdown: breakdown,
          created_at: new Date().toISOString(),
          read: false,
        });
        saveStoredNotifications(notifs);
      }


      requests[reqIdx] = req;
      saveStoredRequests(requests);
      return { success: true, request: req, request_status: req.status };
    }
    return { success: true };
  }

  // 6. Withdraw request
  if (pathname.endsWith('/withdraw') && method === 'POST') {
    const parts = pathname.split('/');
    const reqId = parts[3];
    const requests = getStoredRequests();
    const req = requests.find((r) => r.id === reqId);
    if (req) {
      req.status = 'WITHDRAWN';
      saveStoredRequests(requests);
    }
    return { success: true };
  }

  // 7. Grants list
  if (pathname === '/api/grants' && method === 'GET') {
    const grants = getStoredGrants();
    const statusParam = (url.searchParams.get('status') || 'all').toLowerCase();
    const scopeParam = (url.searchParams.get('scope') || 'visible').toLowerCase();
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isPrivileged = roles.some((r: string) =>
      ['admin', 'executive', 'compliance', 'security_admin', 'data_governance', 'risk_reviewer', 'manager', 'resource_owner'].includes(r)
    );

    return grants
      .map((g) => {
        const isExpired = g.expires_at && new Date(g.expires_at).getTime() <= Date.now();
        const eff = g.status === 'REVOKED' ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE';
        return {
          ...g,
          status: eff,
          effective_status: eff,
        };
      })
      .filter((g) => {
        if (statusParam === 'active' && g.status !== 'ACTIVE') return false;
        if (statusParam === 'expired' && g.status !== 'EXPIRED') return false;
        if (statusParam === 'revoked' && g.status !== 'REVOKED') return false;

        if (scopeParam === 'mine') {
          return g.requester_sub === sub;
        }
        if (scopeParam === 'visible' && !isPrivileged) {
          return g.requester_sub === sub;
        }
        return true;
      });
  }

  // 8. Revoke Grant & Early Release
  if (pathname.includes('/api/grants/') && (pathname.endsWith('/revoke') || pathname.endsWith('/release-early')) && method === 'POST') {
    const parts = pathname.split('/');
    const grantId = parts[3];
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const grants = getStoredGrants();
    const g = grants.find((x) => x.id === grantId);
    if (g) {
      if (pathname.endsWith('/release-early') || body.reason_code === 'PURPOSE_COMPLETE') {
        g.status = 'EXPIRED';
        g.effective_status = 'EXPIRED';
      } else {
        g.status = 'REVOKED';
        g.effective_status = 'REVOKED';
        g.revoked_at = new Date().toISOString();
        g.revocation_reason = body.note || 'Revoked by authorized governance administrator.';
        g.revoke_emergency = Boolean(body.emergency);
      }
      saveStoredGrants(grants);
    }
    return { success: true, grant: g };
  }

  // 10. Hierarchy approval preview
  if (pathname === '/api/hierarchy/preview-approval') {
    const resId = url.searchParams.get('resource_id') || 'D-customers-synth';
    const resource = INITIAL_RESOURCES.find((r) => r.id === resId) || INITIAL_RESOURCES[0];
    return {
      requester_id: currentUser?.sub || 'priya',
      requester_name: currentUser?.display_name || 'Priya Sharma',
      resource_id: resId,
      resource_name: resource.name,
      is_crucial: resource.tier === 'RESTRICTED_SYNTHETIC' || resource.tier === 'TIER_1_CRITICAL',
      is_cross_dept: false,
      steps: [
        { level: 1, slot_role: 'manager', assigned_sub: 'carol', title: 'Carol Danvers (Engineering Manager)', is_crucial_escalation: false },
        { level: 2, slot_role: 'risk_reviewer', assigned_sub: 'elena', title: 'Elena Rostova (Compliance & Risk Pool)', is_crucial_escalation: false },
        { level: 3, slot_role: 'resource_owner', assigned_sub: 'david', title: 'David Miller (Resource Owner)', is_crucial_escalation: false },
      ],
      approval_path: [
        { stage: 1, role: 'manager', reviewer: 'Carol Danvers (Engineering Manager)' },
        { stage: 2, role: 'risk_reviewer', reviewer: 'Elena Rostova (Compliance & Risk Pool)' },
        { stage: 3, role: 'resource_owner', reviewer: 'David Miller (Resource Owner)' },
      ],
    };
  }

  // 11. My Access
  if (pathname === '/api/my-access' && method === 'GET') {
    const grants = getStoredGrants().filter((g) => g.requester_sub === (currentUser?.sub || 'priya'));
    return {
      user: currentUser,
      active_grants_count: grants.filter((g) => g.status === 'ACTIVE').length,
      grants,
      security_posture: {
        score: 95,
        status: 'HEALTHY',
        active_containments: 0,
      },
    };
  }

  // 12. Notifications list
  if (pathname === '/api/notifications' && method === 'GET') {
    const notifs = getStoredNotifications();
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isPrivileged = roles.some((r: string) =>
      ['admin', 'executive', 'compliance', 'security_admin'].includes(r)
    );

    return notifs.filter((n) => isPrivileged || n.to_sub === sub);
  }

  // 13. Mark notification as read
  if (pathname.includes('/api/notifications/') && pathname.endsWith('/read') && method === 'POST') {
    const parts = pathname.split('/');
    const notifId = parts[3];
    const notifs = getStoredNotifications();
    const target = notifs.find((n) => n.id === notifId);
    if (target) {
      target.read = true;
      saveStoredNotifications(notifs);
    }
    return { success: true };
  }

  // 14. Mark all notifications as read / clear
  if ((pathname === '/api/notifications/clear' || pathname === '/api/notifications/mark-all-read') && method === 'POST') {
    const notifs = getStoredNotifications();
    const sub = currentUser?.sub || 'priya';
    notifs.forEach((n) => {
      if (n.to_sub === sub) {
        n.read = true;
      }
    });
    saveStoredNotifications(notifs);
    return { success: true };
  }

  // Fallback default
  return { success: true };
}

