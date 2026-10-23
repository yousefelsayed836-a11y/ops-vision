# Camera and AI integration status

Implemented: camera metadata with organization/branch/bay relationships, SIMULATED/RTSP/ONVIF protocol designation, secret-reference field, honest UNCONFIGURED/SIMULATED status, no credential exposure in browser snapshots, demo-only observations, original evidence + separate human review records.

Not implemented or verified: RTSP/ONVIF connectivity, video gateway, live playback, frame sampling, detector model, classification accuracy, plate recognition, cross-camera identity matching, worker counting or activity recognition. No camera is connected. Registering metadata is not a successful connectivity test.

Planned trust boundaries: camera/NVR LAN → outbound-only branch gateway or controlled VPN → authenticated media ingestion → independent Python inference/tracking → versioned normalized event API → authorized backend actions. Application database credentials must never be shipped to gateways/AI workers. Scope ingress credentials to one tenant/camera/capability and rotate/revoke independently.

No public inbound camera ports. Never put authenticated raw stream URLs in customer HTML. Customer viewing needs a per-session short-lived authorization and expiry/revocation on closure, with an audited media gateway.

Before real integration: inventory hardware/protocols, camera placement, TLS/VPN, bandwidth and retention needs; collect permitted representative examples across lighting/occlusion; define target accuracy and review process; benchmark one branch before expanding. Object presence is not proof of service start/completion, identity, payment or worker productivity.

Model version, inference latency, false positives/negatives, tracking stability and confidence calibration must be recorded. Facial recognition and biometric identification are off. Actual pipeline work is Phase 10 and remains external-input blocked.

## Current network preparation

Organization.siteIp and Camera.ipAddress persist validated IPv4/IPv6 addresses. Each camera is already constrained to an organization and a branch, with optional matching bay. Camera form and organization settings expose these inputs; authorized camera cards show the linked business and IP. Real-camera records remain UNCONFIGURED even after storing an address. No network request is made to submitted addresses.

The durable event processor and camera event vocabulary are ready, but real video acquisition, authenticated gateway ingress and inference still require implementation and hardware validation. An IP alone does not supply video credentials, networking, a gateway or measured recognition accuracy. No claim that real AI is merely one IP away from completion.


Uploaded-file analysis now has a real local detector/tracker, optionally associated with an existing own-branch camera. This association does not connect the IP or activate live streaming. See VIDEO_ANALYSIS.md for measured capabilities and camera prerequisites.


Uploaded recording analysis re-enabled: same-branch camera and optional bay binding validated. Region selected on rotated preview; source stays private. Live camera IP is still metadata, not a verified RTSP connection. For reliable timing use direct camera export/stream with calibrated bay, fixed viewpoint and trusted clock; screen-recording offset cannot prove camera wall time.
