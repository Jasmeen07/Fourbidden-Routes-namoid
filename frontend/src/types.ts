export type ResourceTier = 'TIER_1_CRITICAL' | 'TIER_2_SENSITIVE' | 'TIER_3_STANDARD';
export type ResourceType = 'MODEL' | 'DATASET' | 'TOOL';

export interface ResourceLimits {
  max_records?: number;
  allowed_formats?: string[];
  ip_allowlist?: string[];
  max_rps?: number;
  max_cost_usd?: number;
  custom?: Record<string, any>;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  tier: ResourceTier;
  description: string;
  allowed_actions: string[];
  max_duration_hours: number;
  required_controls: string[];
  risk_score: number;
  is_active: boolean;
}

export type RequestStatus = 'IN_REVIEW' | 'BLOCKED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type SlotStatus = 'PENDING' | 'APPROVED' | 'NARROWED' | 'REJECTED';

export interface ReviewSlot {
  id: string;
  slot_index: number;
  required_role: string;
  assigned_to_user_id?: string;
  assigned_to_user_name?: string;
  status: SlotStatus;
  decision_rationale?: string;
  narrowed_limits?: ResourceLimits;
  decided_at?: string;
}

export interface AccessRequest {
  id: string;
  requester_id: string;
  requester_name?: string;
  requester_role?: string;
  resource_id: string;
  resource_name?: string;
  resource_tier?: ResourceTier;
  duration_hours: number;
  purpose: string;
  justification: string;
  requested_limits: ResourceLimits;
  required_controls: string[];
  status: RequestStatus;
  created_at: string;
  closed_at?: string;
  slots: ReviewSlot[];
}

export type GrantStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface Grant {
  id: string;
  request_id: string;
  subject_id: string;
  subject_name?: string;
  requester_sub?: string;
  resource_id: string;
  resource_name?: string;
  resource_tier?: ResourceTier;
  granted_limits: ResourceLimits;
  duration_seconds: number;
  status: GrantStatus;
  effective_status: GrantStatus;
  created_at: string;
  expires_at: string;
  revoked_at?: string;
  revocation_reason?: string;
  is_emergency?: boolean;
  last_used_at?: string;
  invocation_count?: number;
  utilization_status?: 'ACTIVE_UTILIZING' | 'REVIEW_SUGGESTED' | 'NEVER_USED';
}

export interface RoleGuidance {
  title: string;
  focus_areas: string[];
  key_questions: string[];
}

export interface DecisionLineageItem {
  slot_role: string;
  decided_by_sub: string;
  status: string;
  decision: string;
  approved_limits?: ResourceLimits;
  rationale?: string;
  decided_at?: string;
}

export interface RequestPriority {
  score: number;
  band: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  waiting_hours: number;
  sla_hours_remaining: number;
  is_starved: boolean;
  reasons: string[];
}

export interface ApprovalAssistanceData {
  request_id: string;
  resource_name: string;
  resource_tier: string;
  risk_score: number;
  risk_band: string;
  priority?: RequestPriority;
  guidance: Record<string, RoleGuidance>;
  lineage: DecisionLineageItem[];
  suggestions: Array<{ action?: string; description?: string; target_field?: string; suggested_value?: any }>;
}

export interface AuditEvent {
  seq: number;
  event_id: string;
  prev_hash: string;
  event_type: string;
  actor_id: string;
  resource_id?: string;
  payload: Record<string, any>;
  recorded_at: string;
  hash: string;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface CounterfactualRecommendation {
  dimension: string;
  current_value: any;
  suggested_value: any;
  potential_risk_reduction: number;
  reason: string;
}

export interface RiskLensEvaluation {
  risk_score: number;
  risk_tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
  factors: RiskFactor[];
  counterfactuals: CounterfactualRecommendation[];
}

export interface TraceStep {
  check: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  detail: string;
  timestamp: string;
}

export interface PdpDecisionTrace {
  decision: 'ALLOW' | 'DENY';
  grant_id?: string;
  subject_id: string;
  resource_id: string;
  action: string;
  purpose: string;
  steps: TraceStep[];
  timestamp: string;
  denial_reason?: string;
  mock_response?: {
    watermark: string;
    resource_id: string;
    action: string;
    payload_preview: any;
  };
}

export interface PolicyFinding {
  level: 'INFO' | 'WARN' | 'ERROR';
  code: string;
  message: string;
  path?: string;
}

export interface PolicyLintReport {
  is_valid: boolean;
  version: string;
  checked_at: string;
  total_findings: number;
  findings: PolicyFinding[];
}

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: string;
  badge: string;
}
