# Business rules

1. Application states: PENDING → UNDER_REVIEW/MORE_INFORMATION_REQUIRED/APPROVED/REJECTED. Approved/rejected requests are final. Approval is idempotent and creates exactly one organization, initial branch and owner invitation in one serializable transaction.
2. Activation: 24-hour random token, SHA-256 index, single-use, revoked/expired tokens denied. Password minimum 12/max 128 characters, hashed by Better Auth. Existing users must sign in and accept, never have credentials overwritten by a tenant invitation.
3. No self-signup through Better Auth. First admin is provisioned through stdin-only CLI, with no published default credentials. Membership alone does not grant platform authority.
4. Services are tenant-owned. Session creation validates matching organization/category/branch, snapshots price/currency/names/estimate, and writes history + domain event atomically.
5. A bay is allocated only by an atomic AVAILABLE/empty claim. No overlap. Versioned transitions reject stale updates. Cancel/complete releases the bay only when its activeWashId matches. Worker participation ends on cancellation/completion.
6. Lifecycle: BOOKED→CHECKED_IN→WAITING→ASSIGNED→WASHING↔PAUSED→INSPECTION→COMPLETED→DELIVERED. Some intermediate steps are optional as coded in domain.ts. Invalid transitions fail. Inspection may return to washing. Completed/delivered/cancelled business history is retained.
7. Waiting, active washing, pause, inspection and occupancy are separate durations derived from server-side history. Delivery waiting is not silently treated as active washing.
8. Cash payment requires an authenticated permitted cashier to explicitly confirm receipt. Full accepted amount only, one payment per session, idempotent receipt reference. No online payment integration is represented as complete. Simulation tenants cannot record cash.
9. Rules use normalized events, confidence conditions and allowlisted alert/review/record actions. No rule automatically invents plates, customers, services, worker identities or payment. Simulated camera events cannot enter normal tenants.
10. External email is an encrypted pending outbox with provider-unconfigured state. Approval does not falsely claim a sent invitation.
11. Booking uses BOOKED wash records with bookedFor/reservedUntil. Customer vehicle ownership, branch hours/timezone, future time and bay overlap are checked. Booking time is excluded from operational waiting. Customer cancellation requires a permitted future booking and current version.
12. Category/size price matrix, discount and tax are accepted into immutable wash snapshots. Later service changes do not rewrite accepted totals. One service per wash remains the current limit.
13. Printed receipt requires actual recorded cash; customer can only access their own wash. Feedback requires own completed wash. Password recovery keeps tokens hashed, queues encrypted delivery and revokes prior sessions after success.


Reference catalog service names are templates, never implied prices. Tenant sets price/duration explicitly. Platform removal is reversible ARCHIVED and denies tenant/tracking access while preserving records. Platform bay view and wash operation are separate permissions. Customer tracking is per-wash, seven-day link/24h session, password shown once and hashed; reissue revokes previous access. Video presence is never billed or treated as a completed wash automatically.


Fast operation: direct start can claim an available own-branch bay from CHECKED_IN/WAITING; start/finish require independent grants and expected version. WASHING/PAUSED may finish directly; optional INSPECTION is not fabricated. Completion frees bay, ends assignments and emits normal audit/history/event. Occupied bays cannot be put into maintenance/disabled manually. Reports count sessions by creation, started by startedAt, completed by completedAt, payments by payment.createdAt in selected authorized timezone. Available-bay card is always current. Quick customers use normalized phone per org; existing active bay must match plate/type/size; another customer cannot overwrite linked wash. Tracking access stays seven days and reissue revokes previous session.


Camera observations use two stable samples for entry/exit and distinguish clip/track/occlusion boundaries. Disappearance alone cannot free a bay or complete a wash. Zone visit duration exists only when both boundaries are actually observed; video presence is separate from service duration. Fine vehicle category and commercial service remain review fields, preserving raw predictions. No analysis-derived payment or operational session is created. Vehicle size is no longer user-selected; existing records retained internally for historical price integrity.
