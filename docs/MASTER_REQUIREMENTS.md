# OPSVISION — MASTER DEVELOPMENT PROMPT

## ROLE & OPERATING PRINCIPLES

You are the Principal Software Architect, Lead Full-Stack Engineer, UI/UX Designer, DevOps Engineer, Database Architect, Security Engineer, QA Engineer, and AI Automation Architect for **OpsVision**.

Operate with the engineering judgment, discipline, and craftsmanship of a software architect with 20+ years of professional experience building secure, scalable, production-grade SaaS platforms.

Your mission is to design, build, test, document, secure, and continuously improve OpsVision, a bilingual, Arabic-first, multi-tenant SaaS platform for car wash operations management, employee management, customer services, operational tracking, and future AI-powered camera automation.

**Do not build a superficial prototype. Build a real, maintainable application with functioning business logic, persistent data, secure authentication, meaningful authorization, and reliable workflows.**

### Mandatory execution rules

1. Inspect the existing repository before making changes.
2. Preserve working functionality unless a change is necessary and justified.
3. Make sound architectural decisions based on the project's actual requirements.
4. Never invent completed integrations, test results, or deployed functionality.
5. Do not use fake dashboard data as if it were real production data.
6. Write clean, reusable, readable, well-typed, testable code.
7. Avoid unnecessary dependencies and excessive engineering complexity.
8. Build production-oriented features in logical, independently testable phases.
9. Do not silently skip a requirement.
10. Do not ask unnecessary questions. Make reasonable reversible decisions and document them.
11. Never expose passwords, private keys, credentials, or secrets.
12. Test affected functionality before considering a task complete.
13. Every newly added function must be integrated into the relevant user workflow.
14. Prefer working end-to-end vertical slices over disconnected visual pages.
15. Always distinguish between implemented, tested, simulated, and planned functionality.

---

# 1. PERMANENT PROJECT MEMORY & DOCUMENTATION

**CRITICAL REQUIREMENT: EVERYTHING IMPORTANT MUST BE DOCUMENTED INSIDE THE PROJECT.**

Create and continuously maintain these files:

```text
AGENTS.md
README.md
.env.example

docs/
  PROJECT_MEMORY.md
  CHANGELOG.md
  ARCHITECTURE.md
  DATABASE_SCHEMA.md
  API_DOCUMENTATION.md
  PERMISSIONS.md
  BUSINESS_RULES.md
  UI_DESIGN_SYSTEM.md
  AUTOMATION_ARCHITECTURE.md
  CAMERA_INTEGRATION.md
  SECURITY.md
  TESTING.md
  DEPLOYMENT.md
  ROADMAP.md
  DECISIONS.md
  KNOWN_ISSUES.md
```

## AGENTS.md

This is the permanent operational instruction file for future Codex sessions.

It must explain:

- Project purpose and architecture
- Technology stack
- Coding standards
- Folder organization
- Localization requirements
- Authentication and authorization rules
- Multi-tenancy and data isolation rules
- Testing commands
- Documentation requirements
- Mandatory development workflow
- How to resume development safely

## PROJECT_MEMORY.md

Maintain an accurate record of:

- What has already been implemented
- What is currently being developed
- What still needs to be completed
- Important design decisions
- Existing limitations
- Integration status
- Future priorities
- Recommended next steps

At the beginning of every development session, read AGENTS.md and PROJECT_MEMORY.md before modifying code.

At the end of every meaningful task, update the relevant documentation.

## CHANGELOG.md

For every change, record:

- Date
- Feature or module
- Files changed
- Description of implementation
- Database migrations
- API modifications
- Permission changes
- Security implications
- Tests performed and results
- Known issues
- Next steps

Do not falsely claim that code was tested when testing did not actually happen.

## Permanent documentation workflow

Follow this cycle:

**Read → Understand → Plan → Implement → Test → Document → Review → Continue.**

Documentation must accurately reflect the implemented code, not just intentions.

---

# 2. SYSTEM IDENTITY & DESIGN

System name: **OpsVision**

Product category: Multi-tenant Car Wash Operations Management SaaS.

## Brand identity

Use this exact color palette:

| Color | HEX | Purpose |
|---|---|---|
| Soft Yellow | #FFF6B8 | Warnings, highlights |
| Soft Pink | #F8DCE5 | Secondary accents |
| Teal Green | #3F7773 | Primary brand color |
| Off White | #F7FAF8 | Main page backgrounds |
| Dark Green | #243D3B | Sidebar, headings, dark surfaces |

Use additional accessible neutral colors only when necessary.

### Logo

Create an original, professional, vector-based OpsVision logo using SVG.

Concept:

- Modern and minimal
- Combines operational visibility, analytics, and automotive care
- May subtly incorporate an eye, camera lens, operational dashboard, or vehicle silhouette
- Elegant geometric styling
- Suitable for a serious B2B SaaS platform
- Works at small sizes
- Includes standalone symbol and symbol-with-wordmark variants

Create light and dark versions, a favicon, and a reusable logo component.

Do not copy existing company logos.

### UI/UX requirements

- Premium SaaS dashboard appearance
- Clean, minimal, modern design
- Arabic-first layout
- Default language: Arabic
- Optional language: English
- Correct RTL and LTR behavior
- Responsive desktop, tablet, and mobile layouts
- Readable Arabic typography
- Consistent spacing and hierarchy
- Accessible contrast and keyboard interactions
- Elegant cards, tables, filters, dialogs, charts, and forms
- Clear empty, loading, success, and error states
- Confirmation before destructive actions
- Toast notifications
- Skeleton loading states
- Mobile-friendly navigation

Suggested Arabic font: Cairo or IBM Plex Sans Arabic.

Suggested English font: Inter.

Do not clutter interfaces with excessive animations.

---

# 3. RECOMMENDED TECHNOLOGY STACK

Inspect the repository before selecting or changing technologies.

For a new project, prefer:

### Frontend

- Next.js with App Router
- React
- TypeScript with strict typing
- Tailwind CSS
- shadcn/ui
- Lucide icons
- next-intl for internationalization
- React Hook Form
- Zod
- TanStack Query where appropriate
- Recharts for analytics

### Backend

Use Next.js server capabilities for suitable application functionality.

Use a separate backend or background service when long-running automation, camera processing, or independent scaling requires it.

### Database

- PostgreSQL
- Prisma ORM
- Schema migrations

### Authentication

Use a mature and actively maintained authentication library compatible with the chosen stack.

Implement secure session management, password hashing, account recovery, and server-side authorization.

### Background processing

- Redis
- BullMQ or an equivalent reliable job queue

### AI/computer vision

Design a separate Python-based service using:

- FastAPI
- OpenCV
- A configurable object detection framework
- Independently deployed processing workers
- Model version tracking

The actual AI model and deployment architecture must be selected based on supported camera hardware, available training data, infrastructure, and accuracy requirements.

### Infrastructure

- Docker
- Docker Compose for local development
- Environment-based configuration
- Structured logging
- Health checks
- CI testing
- Production deployment documentation

Avoid integrating unnecessary third-party services before they are needed.

---

# 4. MULTI-TENANT ARCHITECTURE

OpsVision manages multiple independent car wash businesses.

Each car wash is a tenant.

Every tenant must have isolated:

- Users
- Employees
- Customers
- Wash bays
- Vehicles
- Wash services
- Service prices
- Reservations
- Wash sessions
- Cameras
- AI events
- Operational analytics
- Financial reports

A car wash must never access another car wash's private data.

Implement strict tenant isolation at the database query and application authorization levels.

Every tenant-owned record should have a tenant identifier.

Use PostgreSQL Row-Level Security where it meaningfully strengthens isolation, with appropriate database role configuration.

Never trust tenant identifiers supplied by the browser without validating the authenticated user's access.

Design for multiple branches under one car wash organization.

Support organizational hierarchy:

**Platform → Car Wash Organization → Branch → Wash Bay → Wash Session**

---

# 5. USER PORTALS

Build four user experiences within three primary operational categories.

## A. Platform Administration Portal

Reserved for authorized OpsVision administrators.

Features:

- Central dashboard
- Add, edit, suspend, reactivate, and manage car wash organizations
- Review registration applications
- Approve or reject car wash registration
- Manage subscription plans
- Manage system employees
- Assign roles and permissions
- View platform-wide operational statistics
- Manage branches
- View audit logs
- Configure global settings
- Review system alerts
- Monitor integration health
- Manage supported languages
- Configure platform-level automation policies
- View cross-tenant analytics only when explicitly authorized

## B. Employee Portal

Employees authenticate using their own accounts.

Do not assume every employee has the same privileges.

The platform administrator determines what platform employees can see and do.

Car wash owners/managers determine permissions for employees within their own organizations, within platform-defined permission boundaries.

Employees must only see features they are authorized to access.

Examples:

- View assigned wash sessions
- Update wash progress
- Register vehicles
- Check in customers
- Record start and completion times
- Record assigned workers
- Access operational schedules
- Report operational issues

Permission-sensitive buttons and routes must be protected server-side, not merely hidden in the interface.

## C. Car Wash Management Portal

For car wash owners and authorized managers.

Features:

- Business profile
- Branch management
- Wash bay management
- Employee management
- Services and prices
- Vehicle categories
- Operational scheduling
- Customer management
- QR code generation
- Wash tracking
- Revenue reporting
- Productivity analytics
- Camera management
- Automation settings

## D. Customer Portal

A dedicated customer experience accessed using a secure QR code and authenticated credentials.

Car wash managers can generate customer accounts from their dashboard.

The customer portal should allow:

- Secure sign-in
- Initial password setup
- View available services
- View service prices
- Register and manage vehicles
- Request or book wash services
- View reservation details
- Follow active wash progress
- View previous wash sessions
- Access digital receipts
- Update permitted profile information
- Submit ratings or feedback

The QR code must not contain a plaintext password.

It should contain a controlled URL or short-lived onboarding token.

Account activation must require secure credential setup.

Support token expiration, revocation, and regeneration.

---

# 6. HOMEPAGE & CAR WASH REGISTRATION

Build a professional public homepage.

Sections:

- Hero section
- Product overview
- Main features
- Dashboard previews
- How it works
- Benefits for car wash owners
- AI automation capabilities
- Registration request
- Contact section
- Login entry points

Primary CTA:

**سجّل مغسلتك الآن**

Secondary CTA:

**تسجيل الدخول**

## Registration process

1. Car wash owner opens the registration form.
2. Enters required business details.
3. System validates the request.
4. Request is stored as pending.
5. Platform administration receives a notification.
6. Administrator reviews the application.
7. Administrator approves or rejects it.
8. If approved, the system provisions the tenant and owner account.
9. Owner receives a secure invitation or activation link.
10. Owner creates a password and accesses the dashboard.

Prevent duplicate processing and inconsistent partial tenant creation.

Use database transactions and idempotent provisioning.

Include application statuses:

- Pending
- Under Review
- Approved
- Rejected
- More Information Required

Maintain application history and administrative audit records.

---

# 7. ROLES & PERMISSIONS

Implement a granular RBAC authorization system.

Suggested roles:

### Platform roles

- Super Admin
- Platform Admin
- Platform Employee
- Support Agent

### Tenant roles

- Car Wash Owner
- Branch Manager
- Supervisor
- Cashier
- Wash Worker
- Customer

These are default roles, not hardcoded limits.

Permissions must be configurable according to the permitted role hierarchy.

Examples:

```text
platform.manage_users
platform.manage_tenants
platform.review_applications
platform.manage_subscriptions
platform.view_reports

tenant.manage_profile
tenant.manage_branches
tenant.manage_employees
tenant.manage_roles
tenant.manage_services
tenant.manage_prices
tenant.manage_bays
tenant.manage_customers
tenant.manage_cameras
tenant.manage_automation

wash.create_session
wash.assign_workers
wash.start_session
wash.pause_session
wash.complete_session
wash.cancel_session
wash.view_sessions

reports.view
reports.export

customers.create
customers.update
customers.view

finance.view_revenue
finance.manage_payments
```

Implement:

- Permission definitions
- Role-permission mappings
- User-role assignments
- Tenant and branch scoping
- Permission management UI
- Authorization middleware and server-side guards
- Audit trails for permission changes
- Protection against unauthorized privilege escalation

An owner must not be able to grant themselves platform permissions.

A manager must not be able to grant permissions exceeding their own delegated authority.

---

# 8. CAR WASH BRANCHES & BAYS

Car wash owners must be able to create multiple branches.

Each branch can have multiple wash bays.

For each wash bay, store:

- Unique identifier
- Display name or number
- Branch
- Supported vehicle sizes
- Supported service types
- Operational status
- Availability
- Assigned camera identifiers
- Maintenance information
- Operating hours

Suggested statuses:

- Available
- Reserved
- Occupied
- Cleaning
- Maintenance
- Disabled

Show bay status in real time.

Prevent overlapping bay allocations through transactional concurrency controls.

Provide a visual operations board displaying all bays and their current workloads.

---

# 9. VEHICLE TYPES & CLASSIFICATION

Create a configurable vehicle classification system.

Default categories:

- Motorcycle
- Sedan
- Hatchback
- SUV
- Crossover
- Pickup
- Van
- Minibus
- Large Vehicle

Support customizable sizes:

- Small
- Medium
- Large
- Extra Large

Managers can configure which categories are supported.

Allow custom vehicle definitions and category-specific pricing.

Vehicle records should support:

- Plate number
- Country or plate format where relevant
- Manufacturer
- Model
- Color
- Vehicle category
- Size
- Customer ownership
- Optional images

Vehicle classification should initially be entered manually or by customers.

Later, AI can propose vehicle classification from camera observations.

AI classifications must carry confidence scores and support human correction.

---

# 10. WASH SERVICES & PRICING

Car wash managers can create unlimited services.

Examples:

- Exterior Wash
- Interior Wash
- Full Wash
- Premium Wash
- Steam Wash
- Engine Cleaning
- Ceramic Treatment
- Waxing
- Interior Detailing

For every service, store:

- Name in Arabic
- Name in English
- Description
- Base price
- Pricing rules by vehicle category and size
- Estimated duration
- Supported bays
- Availability
- Applicable taxes
- Optional add-ons
- Active/inactive status

Pricing must support different values for different vehicle sizes.

Use a configurable pricing matrix.

For example:

| Service | Small | Medium | Large |
|---|---|---|---|
| Exterior Wash | Configurable | Configurable | Configurable |
| Full Wash | Configurable | Configurable | Configurable |
| Premium Wash | Configurable | Configurable | Configurable |

Do not hardcode monetary values.

Store money with appropriate decimal precision and configurable currency.

Snapshot the accepted service price at the time of a transaction so later price changes do not corrupt historical reporting.

---

# 11. WASH OPERATIONS MANAGEMENT

This is a core business module.

Create a complete wash session lifecycle.

Statuses:

1. Booked
2. Checked In
3. Waiting
4. Assigned to Bay
5. Washing
6. Paused
7. Quality Inspection
8. Completed
9. Delivered
10. Cancelled

Support configurable operational transitions.

Each wash session should track:

- Session ID
- Tenant
- Branch
- Customer
- Vehicle
- Vehicle category
- Vehicle size
- Selected services
- Total price
- Assigned bay
- Assigned employees
- Estimated duration
- Actual duration
- Check-in timestamp
- Bay entry timestamp
- Wash start timestamp
- Wash completion timestamp
- Delivery timestamp
- Pause periods
- Operational notes
- Payment status
- AI observation references

Use server-authoritative timestamps.

Keep status transition history rather than overwriting all prior states.

Measure:

- Customer wait time
- Bay occupancy time
- Active washing time
- Paused time
- Inspection time
- End-to-end service time
- Delay against estimate

Clearly distinguish these metrics in reporting.

## Employee participation

A session can have multiple assigned workers.

Track:

- Employee ID
- Assigned role
- Participation start
- Participation end
- Total participation duration

Support employee reassignment during an active session.

Maintain historical participation records.

---

# 12. LIVE OPERATIONS DASHBOARD

Build an operational command center.

Display:

- Active wash sessions
- Waiting vehicles
- Available bays
- Occupied bays
- Completed washes
- Delayed sessions
- Assigned employees
- Average wash duration
- Bay utilization
- Service distribution
- Current revenue

Add filters by:

- Branch
- Date
- Service type
- Vehicle category
- Employee
- Wash bay
- Session status

Use real-time updates through an appropriate mechanism.

Ensure dashboard statistics come from actual application records.

Use clearly labeled demo data only in a development/demo environment.

---

# 13. AI AUTOMATION — CORE REQUIREMENT

**Design OpsVision from day one to support AI-powered camera automation, but do not pretend that cameras are connected until a real integration exists.**

AI capabilities must be independently deployable.

Separate:

1. Camera connectivity
2. Video ingestion
3. Frame sampling
4. AI inference
5. Object tracking
6. Event interpretation
7. Business workflow automation
8. Human verification
9. Operational reporting

The AI engine must never directly bypass business authorization.

## AI architecture

Design the processing flow:

```text
IP Cameras
    |
    v
Camera Connector
    |
    v
Secure Stream Ingestion
    |
    v
Frame Processing Pipeline
    |
    v
AI Detection & Tracking
    |
    v
Normalized Event Generator
    |
    v
Automation Rules Engine
    |
    v
OpsVision Backend
    |
    v
Database + Event History
    |
    v
Live Dashboard + Alerts
```

Build an internal event-based integration layer so future camera providers and AI models can be replaced without redesigning the full platform.

---

# 14. CAMERA MANAGEMENT

Create a camera management module.

Authorized managers can:

- Register cameras
- Assign cameras to branches
- Associate cameras with wash bays
- Configure camera zones
- View connection status
- Test connectivity
- Enable or disable processing
- Configure automation rules
- Review processing errors

Camera configuration fields:

- Camera ID
- Tenant ID
- Branch ID
- Camera name
- Camera location
- Associated bay
- Camera provider
- Connection protocol
- Secure credential reference
- Connection status
- Supported capabilities
- Processing configuration

Support an extensible connector interface for compatible IP camera technologies such as RTSP and ONVIF.

Do not assume every camera supports every protocol.

Never expose camera passwords or raw authenticated stream URLs to unauthorized browser clients.

Do not require a public camera port exposed to the internet.

Plan for secure local gateways, VPNs, or outbound-only connections where appropriate.

Document network and hardware requirements.

---

# 15. AI VEHICLE DETECTION & TRACKING

Prepare modules for the following automation capabilities.

## A. Vehicle entry detection

When a vehicle enters a configured camera zone:

- Detect a vehicle object
- Assign a temporary tracking identifier
- Estimate vehicle category
- Estimate vehicle size where technically feasible
- Record observation timestamp
- Identify associated bay or entry area
- Produce a candidate vehicle-entry event

Never assume that an object detection alone conclusively proves a wash session has started.

## B. Vehicle tracking

Track vehicles across frames.

Support:

- Temporary track IDs
- Detection confidence
- Enter/exit zone events
- Track disappearance
- Re-entry handling
- Duplicate event suppression

Tracking a vehicle between different cameras requires additional calibration and reliable identity matching.

Do not claim cross-camera identity tracking without a validated implementation.

## C. Vehicle classification

Prepare support for:

- Sedan
- SUV
- Pickup
- Van
- Other vehicle classes

Distinguish observable vehicle classes from operational size categories.

Physical size estimation may require camera calibration or additional sensors.

Use confidence scores and manual correction.

## D. Wash start detection

Support configurable methods:

- Manual start
- Camera zone occupancy
- Validated AI activity recognition
- Approved sensor integration
- Hybrid confirmation workflow

The system must record which source determined the start time.

## E. Wash completion detection

Support:

- Manual completion
- Vehicle exit observation
- Worker confirmation
- Approved AI workflow event
- Hybrid confirmation

Do not equate vehicle exit with successful wash completion unless the configured business rules establish this behavior.

## F. Employee counting

Prepare future computer-vision support for estimating workers visible in a wash zone.

However:

- Visible people may not all be employees.
- Workers may be occluded.
- Cameras may miss individuals.
- A person count does not establish identity.
- Visual presence does not prove active work.

Use manually assigned employees as the authoritative operational record until validated integrations exist.

AI-estimated worker count must be labeled as an estimate.

---

# 16. AI AUTOMATION RULES ENGINE

**Implement a genuine configurable automation engine, not only an automation settings page.**

Create a modular rule engine supporting:

- Event triggers
- Conditions
- Actions
- Execution history
- Retries
- Failure handling
- Rule enable/disable controls
- Tenant-specific automation settings
- Audit logs
- Human approval where required

## Trigger examples

```text
vehicle.detected
vehicle.entered_zone
vehicle.exited_zone

bay.occupied
bay.available

wash.session_created
wash.started
wash.paused
wash.completed
wash.delayed

worker.assigned
worker.count_estimated

camera.connected
camera.disconnected

ai.low_confidence
ai.event_rejected
```

## Action examples

```text
Create operational alert
Suggest wash session creation
Suggest vehicle category
Update bay observation state
Request manual confirmation
Notify branch supervisor
Record operational event
Flag session delay
Update live analytics
```

High-impact operations should require authenticated human confirmation unless explicitly configured and proven safe.

## Sample automation rule

Trigger:

`vehicle.entered_zone`

Conditions:

- Camera belongs to an active tenant
- Event maps to a configured branch
- Tracking confidence exceeds configured threshold
- Event is not a duplicate
- Entry zone is valid

Actions:

- Create a vehicle entry observation
- Associate it with an existing matching session when reliable
- Otherwise create an operational review item
- Notify authorized operators
- Update the operations dashboard

Do not automatically invent a customer identity, license plate, employee assignment, service selection, or payment.

## Automation reliability

Implement:

- Persistent event IDs
- Idempotency keys
- Durable job queues
- Retry policies
- Exponential backoff
- Dead-letter handling
- Failed execution visibility
- Structured logs
- Event versioning
- Tenant-aware processing
- Reconciliation mechanisms
- Event deduplication
- Human review workflows

Every automation execution must have an auditable result.

---

# 17. AI SIMULATION MODE

Because physical cameras may not initially be available, build a controlled simulation environment.

This is mandatory.

The simulation system must allow developers and authorized testers to generate:

- Vehicle entered
- Vehicle exited
- Bay occupied
- Bay empty
- Wash started
- Wash completed
- Worker count estimated
- Camera disconnected
- Low-confidence detection

Simulated events must travel through the same normalized event pipeline and automation rules engine used for real integrations.

Mark simulated events clearly.

Prevent simulated events from corrupting production financial and operational reporting.

Use isolated demo tenants, environments, or similarly strong safeguards.

Provide an AI simulation dashboard for testing future workflows.

---

# 18. AI OBSERVATIONS & REVIEW CENTER

Create an AI Events page.

Display:

- Event type
- Camera
- Branch
- Bay
- Event time
- Confidence
- Processing status
- Linked wash session
- Associated tracking ID
- Source mode: real or simulated
- Human review status

Authorized users can:

- Confirm observations
- Reject incorrect observations
- Correct vehicle categories
- Resolve conflicting events
- Link observations to sessions
- Flag incorrect detections

Maintain the original model output and a separate correction history.

Do not silently overwrite the evidence associated with an automated decision.

Design feedback records that can later support model evaluation and improvement.

---

# 19. CAMERA PRIVACY, SECURITY & AI GOVERNANCE

Treat camera recordings, vehicle identifiers, and personal information as sensitive operational data.

Implement:

- Tenant-level access controls
- Restricted camera permissions
- Encrypted communications
- Secure secret storage
- Configurable retention periods
- Access logging
- Data deletion workflows
- Clear privacy notices
- Video access auditing
- Per-tenant camera integration isolation

Prefer processing the minimum amount of data needed.

Do not enable face recognition or biometric identification by default.

Do not use employee video observations as the sole basis for disciplinary or payroll decisions.

Provide manual review of consequential AI decisions.

Document applicable privacy and legal compliance considerations for deployment jurisdictions.

If video retention is enabled, document storage, encryption, access control, and deletion behavior.

---

# 20. CUSTOMER QR CODE SYSTEM

Build a secure QR code system.

Each car wash can create customer invitation QR codes.

Workflow:

1. Authorized manager creates a customer invitation.
2. System creates a short-lived activation token.
3. QR code contains a secure activation URL.
4. Customer scans QR code.
5. Customer completes account setup.
6. Customer creates a password.
7. Customer gains access only to the appropriate customer portal.
8. Activation token is invalidated after use.

Requirements:

- One-time token usage
- Token expiration
- Token revocation
- Secure password hashing
- Rate limiting
- Audit logging
- Password reset workflow
- Safe handling of expired links

Also support separate permanent customer QR identifiers for check-in where useful.

Permanent check-in QR codes must not grant authenticated access by themselves.

---

# 21. CUSTOMER RESERVATION & SERVICE FLOW

Implement:

- Service catalog
- Vehicle selection
- Branch selection
- Date/time selection where scheduling is enabled
- Availability validation
- Price preview
- Reservation confirmation
- Reservation status updates
- Cancellation rules
- Service history
- Receipt access

Prevent overlapping reservations beyond operational bay capacity.

Design reservation logic around configurable service duration and bay availability.

Allow walk-in customers and pre-booked customers.

---

# 22. FINANCIAL OPERATIONS

Create a financial reporting module.

Support:

- Service subtotals
- Discounts
- Taxes
- Final total
- Payment status
- Payment method
- Refunds
- Daily revenue
- Revenue by branch
- Revenue by service
- Revenue by employee where attribution is defined

Use appropriate decimal money representation.

Do not store card payment information.

Design a payment-provider adapter for future integration.

Do not describe payments as completed until a real payment method or verified provider confirmation exists.

Maintain historical transactions and audit records.

---

# 23. ANALYTICS & PERFORMANCE

Create meaningful reports:

### Operations

- Total wash sessions
- Average service duration
- Average waiting time
- Average turnaround time
- Bay utilization
- Peak operational periods
- Delayed sessions
- Service popularity

### Employees

- Assigned sessions
- Participation time
- Completed assignments
- Estimated staffing workload

Do not confuse employee presence with productivity.

### Business

- Revenue
- Average order value
- Popular services
- Returning customers
- Branch performance
- Vehicle category distribution

### AI

- Processed events
- Detection confidence distribution
- Confirmed events
- Rejected events
- Automation success rate
- Automation failures
- Processing latency
- Camera availability

Support date range filters and authorized exports.

---

# 24. NOTIFICATIONS

Implement a notification system supporting:

- In-app notifications
- Database-persisted alerts
- Read/unread state
- Permission-aware recipients

Prepare optional integration adapters for:

- Email
- SMS
- WhatsApp
- Push notifications

Do not claim these channels work until real provider credentials and integrations are configured.

Notification examples:

- New car wash registration
- Registration approval
- New reservation
- Wash completion
- Wash delay
- Camera disconnection
- Automation failure
- Low-confidence AI observation

---

# 25. REQUIRED DATABASE DESIGN

Design normalized, indexed database entities for at least:

```text
users
sessions
accounts
organizations
branches
organization_memberships
roles
permissions
role_permissions
user_role_assignments

car_wash_applications
subscription_plans
subscriptions

employees
customers
vehicles
vehicle_categories
vehicle_sizes

wash_bays
wash_services
service_pricing_rules
service_addons

reservations
wash_sessions
wash_session_services
wash_session_workers
wash_session_status_history
wash_session_pauses

invoices
payments
refunds

cameras
camera_zones
camera_connectors
camera_health_events

ai_observations
ai_tracking_events
ai_model_versions
ai_review_actions

automation_rules
automation_conditions
automation_actions
automation_executions
automation_events
automation_failures

notifications
audit_logs
system_settings
tenant_settings
```

Adapt the table structure when justified by actual implementation needs.

Requirements:

- Appropriate foreign keys
- Useful indexes
- Timestamps
- Unique constraints
- Referential integrity
- Tenant-aware access
- Safe migrations
- Appropriate deletion policies
- Transaction safety

Document all schema decisions in DATABASE_SCHEMA.md.

---

# 26. API & BACKEND STANDARDS

Implement clear, consistent API contracts.

Requirements:

- Input validation
- Typed request/response structures
- Consistent error responses
- Authentication
- Server-side authorization
- Tenant isolation
- Pagination
- Filtering
- Sorting
- Rate limiting
- Audit records
- Transaction handling
- Idempotency for critical operations

Use API versioning where it adds value.

Document endpoint behavior and required permissions.

External camera/automation services must authenticate securely and receive narrowly scoped access.

Never give AI workers unrestricted access to the whole application database.

---

# 27. SECURITY REQUIREMENTS

Implement security from the beginning.

At minimum:

- Secure password hashing
- Secure cookie/session settings
- CSRF protections where applicable
- XSS defenses
- SQL injection prevention
- Login rate limiting
- Account recovery
- Permission enforcement
- Session invalidation
- Input validation
- Secure file upload validation where applicable
- Secrets managed through environment variables or a secrets manager
- Security headers
- Audit logging
- Dependency vulnerability checks
- Least-privilege service accounts

Do not log plaintext passwords or tokens.

Never store real production secrets in Git.

Provide a safe initial administrator provisioning mechanism.

Do not create publicly documented default administrator credentials.

---

# 28. PROJECT STRUCTURE

Prefer a clearly organized monorepo when appropriate.

Suggested structure:

```text
opsvision/
├── AGENTS.md
├── README.md
├── .env.example
├── docs/
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── hooks/
│       ├── lib/
│       ├── messages/
│       └── styles/
├── services/
│   └── vision/
│       ├── api/
│       ├── connectors/
│       ├── ingestion/
│       ├── inference/
│       ├── tracking/
│       ├── events/
│       ├── simulation/
│       └── tests/
├── packages/
│   ├── database/
│   ├── shared/
│   ├── permissions/
│   └── automation/
├── infrastructure/
├── scripts/
└── tests/
```

Adjust the structure to the actual chosen implementation.

Avoid creating empty layers or unnecessary abstractions merely to match a diagram.

---

# 29. TESTING & QUALITY

Create automated tests for critical business rules.

Required test coverage should include:

- Authentication
- Authorization
- Permission boundaries
- Tenant isolation
- Registration approval
- Tenant provisioning
- Employee management
- Customer invitation activation
- QR token expiration
- Wash bay concurrency
- Wash session state transitions
- Pricing calculations
- Worker assignments
- Reservation conflicts
- Automation idempotency
- Automation retry behavior
- Simulated AI events
- Camera permission boundaries

Use unit, integration, and end-to-end tests where appropriate.

Run linting, type checking, relevant tests, and production builds.

Record actual results and limitations.

---

# 30. DEVOPS & DEPLOYMENT

Prepare:

- Docker configuration
- Local database
- Local Redis instance where needed
- Development environment setup
- Environment variable examples
- Migration scripts
- Health checks
- Structured application logging
- Background worker startup
- CI workflow
- Production build instructions
- Deployment guide
- Backup and recovery strategy
- Monitoring requirements
- Service restart guidance

Separate development and production configurations.

Avoid requiring GPU hardware for the core application.

The main OpsVision application must work without the AI service being connected.

AI integration failures must not prevent normal car wash operations.

---

# 31. DEVELOPMENT PHASES

Implement the project in the following sequence.

## Phase 1 — Foundation

- Inspect repository
- Create project documentation
- Choose architecture
- Configure dependencies
- Set up database
- Configure localization
- Create design system
- Create OpsVision SVG logo
- Implement application layout
- Establish testing baseline

## Phase 2 — Authentication & Permissions

- User authentication
- Session management
- Role-based access control
- Tenant-aware authorization
- Platform administrator provisioning
- Protected routes
- User management

## Phase 3 — Public Website & Registration

- Homepage
- Car wash registration form
- Pending applications
- Administrative review
- Approval/rejection
- Tenant provisioning
- Owner onboarding

## Phase 4 — Car Wash Operations

- Branches
- Wash bays
- Vehicle categories
- Vehicle sizes
- Wash services
- Pricing
- Employee assignment
- Wash sessions
- Operational dashboard

## Phase 5 — Customer Experience

- Customer invitation system
- Secure QR codes
- Customer activation
- Customer login
- Vehicle management
- Service booking
- Wash progress tracking
- Service history

## Phase 6 — Business Intelligence

- Financial reporting
- Operational analytics
- Employee participation reports
- Notifications
- Audit logs
- Export functionality

## Phase 7 — Automation Foundation

- Event schema
- Durable queue
- Automation rule engine
- Triggers
- Conditions
- Actions
- Execution logs
- Idempotency
- Retry handling
- Review center

## Phase 8 — AI Simulation

- Simulated camera sources
- Simulated vehicle detection
- Simulated bay events
- Simulated worker counts
- Event processing
- Dashboard integration
- Automation testing

## Phase 9 — Real Camera Integration Preparation

- Camera registration
- Camera connectors
- Secure connectivity design
- Zone configuration
- Stream lifecycle
- AI worker interfaces
- Deployment requirements
- Operational monitoring

## Phase 10 — Real AI Integration

Only when compatible camera hardware, network access, representative data, infrastructure, and necessary permissions are available:

- Connect compatible cameras
- Configure secure video ingestion
- Select and validate detection models
- Implement calibrated zone mapping
- Validate vehicle detection
- Validate tracking
- Measure classification accuracy
- Evaluate wash activity recognition
- Introduce controlled automation
- Monitor false positives
- Add safe human review

Do not falsely mark Phase 10 complete without real integration and validation.

---

# 32. AUTOMATION-FIRST ENGINEERING

Whenever implementing a feature, consider whether it should emit a domain event.

Examples:

- New organization approved
- New employee added
- Customer created
- Reservation confirmed
- Vehicle checked in
- Wash started
- Wash completed
- Wash delayed
- Camera disconnected

Design reliable event interfaces without automatically triggering unnecessary downstream tasks.

Keep business events separate from inferred camera observations.

Every event must have sufficient metadata for tracing, tenant attribution, and auditability.

---

# 33. CODEX CONTINUITY WORKFLOW

Before every coding session:

1. Read AGENTS.md.
2. Read PROJECT_MEMORY.md.
3. Review ROADMAP.md.
4. Review KNOWN_ISSUES.md.
5. Inspect repository state.
6. Identify existing functionality.
7. Select the next logical task.

During development:

1. Make small, coherent changes.
2. Preserve existing behavior.
3. Implement real backend behavior.
4. Apply permission checks.
5. Keep UI translations complete.
6. Add tests.
7. Document important decisions.

After development:

1. Run relevant checks.
2. Record actual results.
3. Update CHANGELOG.md.
4. Update PROJECT_MEMORY.md.
5. Update ROADMAP.md.
6. Update KNOWN_ISSUES.md.
7. Summarize work.

If the context becomes too large, leave accurate handoff information in PROJECT_MEMORY.md so a new Codex session can resume safely.

Never rely solely on conversation memory.

---

# 34. DEFINITION OF DONE

A feature is complete only when:

- User interface exists
- Required backend functionality exists
- Data persists correctly
- Inputs are validated
- Permissions are enforced
- Tenant isolation is preserved
- Relevant error cases are handled
- Arabic and English interfaces are supported
- Relevant tests pass
- Documentation is updated
- No known critical regression is introduced

An attractive UI without functional backend integration is not considered complete.

A planned AI capability must be marked as planned or simulated until proven operational.

---

# 35. FINAL EXECUTION INSTRUCTIONS

Start by inspecting the existing repository.

If no application exists, initialize a clean OpsVision project.

Then:

1. Establish architecture and project documentation.
2. Implement the design system and SVG logo.
3. Configure Arabic as the default language.
4. Build secure authentication and foundational RBAC.
5. Implement the first functional vertical slice: car wash registration, administrator approval, tenant provisioning, and owner onboarding.
6. Run available tests and verify behavior.
7. Document implementation details.
8. Continue through the roadmap in dependency order.

Do not spend the entire implementation budget producing planning documents.

Start writing functional code once the initial architecture is established.

Keep the application executable and testable throughout development.

For each completed phase, provide:

**Completed Work**
- Real features implemented

**Technical Changes**
- Modules, APIs, schema changes

**Verification**
- Commands executed and test results

**Limitations**
- Missing integrations, untested assumptions, blocked work

**Documentation**
- Updated files

**Next Phase**
- Next logical implementation steps

## PRIMARY OBJECTIVE

Build **OpsVision** as a real, secure, scalable, Arabic-first, bilingual car wash management SaaS platform that can operate independently today and evolve into a camera-connected, AI-assisted operations intelligence system.

The system must prioritize operational accuracy, simplicity, excellent user experience, maintainability, security, automation readiness, and long-term extensibility.

**Begin implementation now.**
