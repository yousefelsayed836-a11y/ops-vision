import { z } from "zod";
export const email = z
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());
export const text = z.string().trim().min(2).max(120);
export const password = z.string().min(12).max(128);
export const applicationInput = z.object({
  businessName: text,
  ownerName: text,
  email,
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[+\d\s()-]+$/),
  city: text,
  branchCount: z.coerce.number().int().min(1).max(1000),
});
export const applicationDecision = z.object({
  status: z.enum([
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "MORE_INFORMATION_REQUIRED",
  ]),
  note: z.string().trim().max(1000).default(""),
});
export const activationInput = z.object({
  token: z.string().min(32).max(128),
  password,
});
export const branchInput = z
  .object({
    name: text,
    city: text,
    timezone: z.literal("Asia/Riyadh").default("Asia/Riyadh"),
    opensAt: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default("00:00"),
    closesAt: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default("23:59"),
  })
  .refine(
    (data) => data.opensAt < data.closesAt,
    "Closing time must be after opening time",
  );
export const bayInput = z.object({ branchId: z.uuid(), name: text });
export const serviceInput = z.object({
  nameAr: text,
  nameEn: text,
  price: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  category: z.string().regex(/^(ALL|[A-Z][A-Z0-9_]{1,39})$/).default("ALL"),
  taxRate: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,2})?$/)
    .default("0"),
});
export const vehicleInput = z.object({
  plate: z.string().trim().min(2).max(40).optional(),
  category: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
  size: z.enum(["SMALL", "MEDIUM", "LARGE", "XLARGE"]).default("MEDIUM"),
  color: z.string().max(50).optional(),
});
export const createWashInput = z.object({
  branchId: z.uuid(),
  bayId: z.uuid().optional(),
  serviceId: z.preprocess(value=>value===''?undefined:value,z.uuid().optional()),
  vehicleId: z.uuid(),
  notes: z.string().max(1000).default(""),
  bookedFor: z.iso.datetime().optional(),
  discount: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,2})?$/)
    .default("0"),
});
export const invitationInput = z.object({
  name: text,
  email,
  role: z.string().min(2).max(60).default("STAFF"),
  permissions: z.array(z.string()).max(50).optional(),
  branchId: z.uuid().optional(),
});
export const cameraInput = z.object({
  name: text,
  branchId: z.uuid(),
  bayId: z.uuid().optional(),
  protocol: z.enum(["SIMULATED", "RTSP", "ONVIF"]),
  ipAddress: z.union([z.ipv4(), z.ipv6()]).optional(),
  credentialRef: z
    .string()
    .regex(/^[a-zA-Z0-9_/-]{1,150}$/)
    .optional(),
});
export const eventTypes = [
  "vehicle.entered_zone",
  "vehicle.exited_zone",
  "bay.occupied",
  "bay.available",
  "wash.started",
  "wash.completed",
  "worker.count_estimated",
  "camera.disconnected",
  "ai.low_confidence",
  "video.analysis_completed",
] as const;
export const simulationInput = z.object({
  cameraId: z.uuid(),
  type: z.enum(eventTypes),
  confidence: z.number().min(0).max(1),
  key: z.string().min(8).max(100),
  trackId: z.string().max(100).optional(),
});
export const ruleInput = z.object({
  name: text,
  trigger: z.enum([...eventTypes, "wash.session_created", "wash.delayed"]),
  minConfidence: z.number().min(0).max(1).default(0),
  action: z.enum(["CREATE_ALERT", "REQUEST_REVIEW", "RECORD_EVENT"]),
  message: z.string().trim().min(3).max(300),
});
