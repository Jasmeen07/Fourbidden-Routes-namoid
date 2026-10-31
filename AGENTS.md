You are building GrantGate per docs/BLUEPRINT.md. Treat that file as the spec.
RULES
1. Read the referenced BLUEPRINT sections FIRST; restate the acceptance criteria before coding.
2. Layering: api -> services -> domain(pure). domain/ must not import db/api/auth/ai or call datetime.now/random/network. Enforce with import-linter.
3. All authorization and safeguards are enforced in the backend. UI hiding is cosmetic.
4. Time only via the injected Clock. UTC only. Never time.sleep in tests.
5. Every state change writes its audit event in the SAME transaction. Audit payloads use the allowlist schemas.
6. Never store or log secrets, tokens, or emails in audit events. No secrets in the repo; use .env.example.
7. Mock data only. Never call real AI systems except the optional advisory LLM adapter (flagged, mockable).
8. Pydantic models use extra="forbid". Errors are problem+json with the stable codes in BLUEPRINT §8/§9.
9. Write tests with the code. Mark tests with @pytest.mark.ec("EC-XXX") for every edge case implemented.
10. Run `make lint typecheck test` before finishing; paste the results summary. If something fails, fix it—do not skip tests.
11. Do not add features beyond the task. If the spec is ambiguous, choose the safest behaviour (deny) and note it in docs/DECISIONS.md.
12. Never claim the system is "safe" or "compliant" in UI text or docs; use the wording in BLUEPRINT §11.3.
OUTPUT: summary of files changed, how to run, test results, any deviations.
