# Automation

Implemented core pipeline: domain mutation or demo camera observation → same AutomationEvent table → due-event worker → tenant-specific trigger rules → confidence threshold → allowlisted action → notification/review result → AutomationExecution history. The worker cannot create payments or overwrite authoritative session states from inferred observations.

Event schema: UUID, orgId, unique organization/key idempotency tuple, type, version=1, source BUSINESS/SIMULATED, JSON payload, createdAt, status, attempts, nextAttemptAt, lockedAt, processedAt, safe lastError code. Business events and mutation commit together. The processing claim and every action/result commit together. Event/rule results have a unique index. A retry cannot duplicate completed effects.

Actions implemented: CREATE_ALERT, REQUEST_REVIEW, RECORD_EVENT. REVIEW creates an authorized operational notification and retains the observation review item. Conditions implemented: event trigger, active organization, simulation isolation and minimum confidence. Rich compound condition expressions are not yet implemented.

Retry: 5 seconds × 2^(attempt-1), cap 1 hour, max 5 attempts then DEAD. Failures are visible with attempts and safe error code. UI can process pending events; production runs npm run worker continuously. Retry metrics and dead-letter replay UI are next items.

Data integrity: events live in PostgreSQL, not memory. Exact-once business intent is achieved through idempotency and transactional effects, not a claim of universally exactly-once external delivery. No external provider side effects are currently performed. To add messaging, use outbox + provider idempotency and durable acknowledgement.

Test evidence: duplicate simulation keys, one alert after repeated processing, confidence skip, immutable original evidence with reviews, backoff and terminal dead-letter verified locally. CI must repeat against PostgreSQL proper before production approval.


Separate video worker emits video.analysis_completed with source VIDEO_FILE and dedup key video-complete:<jobId> transactionally with result persistence. This event reports detections, not a wash.completed event. Rules worker remains independent; do not create completed washes or receipts from raw tracks.
