import { AccessRequest, Grant, Resource } from '../types';
import type { UserInfo } from './AuthContext';

const STORAGE_KEY_REQUESTS = 'gg_mock_requests';
const STORAGE_KEY_GRANTS = 'gg_mock_grants';

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
  if (pathname.includes('/slots/') && pathname.endsWith('/decision') && method === 'POST') {
    const parts = pathname.split('/');
    const reqId = parts[3];
    const slotId = parts[5];
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const requests = getStoredRequests();

    const reqIdx = requests.findIndex((r) => r.id === reqId);
    if (reqIdx >= 0) {
      const req = { ...requests[reqIdx] };
      const slot = req.slots.find((s) => s.id === slotId);
      if (slot) {
        slot.status = body.decision === 'REJECT' ? 'REJECTED' : (body.approved_limits ? 'NARROWED' : 'APPROVED');
        slot.decision = body.decision || 'APPROVE';
        slot.rationale = body.rationale || 'Reviewed and approved under policy controls.';
        slot.decided_by_sub = currentUser?.sub || 'reviewer';
        slot.decided_at = new Date().toISOString();
        if (body.approved_limits) {
          slot.approved_limits = body.approved_limits;
        }
      }

      // If all slots decided
      const allApproved = req.slots.every((s) => s.status === 'APPROVED' || s.status === 'NARROWED');
      const anyRejected = req.slots.some((s) => s.status === 'REJECTED');

      if (anyRejected) {
        req.status = 'REJECTED';
      } else if (allApproved) {
        req.status = 'APPROVED';

        // Auto-activate Grant
        const grants = getStoredGrants();
        const durationMin = req.duration_minutes || 1440;
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
          actions: req.actions,
          duration_seconds: durationMin * 60,
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          activated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + durationMin * 60 * 1000).toISOString(),
          invocation_count: 1,
          utilization_status: 'ACTIVE_UTILIZING',
        };
        saveStoredGrants([newGrant, ...grants]);
      }

      requests[reqIdx] = req;
      saveStoredRequests(requests);
      return { success: true, request: req };
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
    const statusParam = url.searchParams.get('status') || 'all';
    const sub = currentUser?.sub || 'priya';
    const roles = (currentUser?.roles || []).map((r: string) => r.toLowerCase());
    const isPrivileged = roles.some((r: string) => ['admin', 'executive', 'compliance', 'security_admin', 'data_governance', 'risk_reviewer'].includes(r));

    return grants.filter((g) => {
      if (statusParam === 'active' && g.status !== 'ACTIVE') return false;
      if (!isPrivileged && g.requester_sub !== sub) return false;
      return true;
    });
  }

  // 8. Revoke Grant
  if (pathname.includes('/api/grants/') && pathname.endsWith('/revoke') && method === 'POST') {
    const parts = pathname.split('/');
    const grantId = parts[3];
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const grants = getStoredGrants();
    const g = grants.find((x) => x.id === grantId);
    if (g) {
      g.status = 'REVOKED';
      g.effective_status = 'REVOKED';
      g.revoked_at = new Date().toISOString();
      g.revocation_reason = body.note || 'Revoked by authorized governance administrator.';
      g.revoke_emergency = !!body.emergency;
      saveStoredGrants(grants);
    }
    return { success: true, grant: g };
  }

  // 9. Early Release Grant
  if (pathname.includes('/api/grants/') && pathname.endsWith('/early-release') && method === 'POST') {
    const parts = pathname.split('/');
    const grantId = parts[3];
    const grants = getStoredGrants();
    const g = grants.find((x) => x.id === grantId);
    if (g) {
      g.status = 'EXPIRED';
      g.effective_status = 'EXPIRED';
      saveStoredGrants(grants);
    }
    return { success: true, grant: g };
  }

  // 10. Hierarchy approval preview
  if (pathname === '/api/hierarchy/preview-approval') {
    return {
      requester: { sub: currentUser?.sub || 'priya', department: 'Engineering' },
      approval_path: [
        { stage: 1, role: 'manager', reviewer: 'Carol Danvers (Engineering Manager)' },
        { stage: 2, role: 'risk_reviewer', reviewer: 'Elena Rostova (Compliance & Risk Pool)' },
        { stage: 3, role: 'resource_owner', reviewer: 'David Miller (Resource Owner)' },
      ],
      is_crucial: false,
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

  // Fallback default
  return { success: true };
}
