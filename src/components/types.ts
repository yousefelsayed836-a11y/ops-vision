export type Item = { id: string; name: string };
export type Membership = {
  id: string;
  orgId: string;
  role: string;
  org: { id: string; name: string; isDemo: boolean };
};
export type Me = {
  user: {
    id: string;
    name: string;
    email: string;
    platformRole: string;
    platformPermissions: string[];
  };
  memberships: Membership[];
};
export type Application = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  branchCount: number;
  status: string;
  createdAt: string;
  note: string | null;
  history: { toStatus: string; createdAt: string; note: string | null }[];
};
export type PlatformData = {
  permissions: string[];
  staff: {
    id: string;
    name: string;
    email: string;
    disabled: boolean;
    platformPermissions: string[];
  }[];
  applications: Application[];
  organizations: {
    id: string;
    name: string;
    status: string;
    isDemo: boolean;
    _count: { branches: number; memberships: number; bays: number };
      publicNotice: string;
  }[];
  auditLogs: Audit[];
  notifications: Notification[];
};
export type Audit = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};
export type Branch = Item & {
  city: string;
  timezone: string;
  opensAt: string;
  closesAt: string;
};
export type Bay = Item & {
  branchId: string;
  status: string;
  activeWashId: string | null;
};
export type Service = {
  id: string;
  nameAr: string;
  nameEn: string;
  price: string;
  durationMinutes: number;
  category: string;
  active: boolean;
  taxRate: string;
  pricingRules: { id: string; category: string; size: string; price: string; durationMinutes?:number|null }[];
};
export type Vehicle = {
  id: string;
  category: string;
  size: string;
};
export type Wash = {
  id: string;
  branchId: string;
  bayId: string | null;
  vehicle: Vehicle;
  price?: string;
  discount?: string;
  currency: string;
  serviceNameAr: string;
  serviceNameEn: string;
  estimatedMinutes: number;
  timeAdjustmentSeconds: number;
  extraServices: {id:string;serviceId:string;nameAr:string;nameEn:string;price:string;quantity:number;unit:string;durationMinutes:number}[];
  status: string;
  version: number;
  paymentStatus: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  bookedFor: string | null;
  feedback: { rating: number; comment: string } | null;
  durations: {
    waitMs: number;
    washMs: number;
    pauseMs: number;
    inspectionMs: number;
    bayMs: number;
    totalMs: number;
  };
  history: { toStatus: string; createdAt: string }[];
  workers: { id: string; employeeUserId: string; endedAt: string | null }[];
};
export type Rule = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  message: string;
  enabled: boolean;
  minConfidence: number;
};
export type Camera = Item & {
  zones?: unknown;
  ipAddress: string | null;
  branchId: string;
  bayId: string | null;
  protocol: string;
  status: string;
};
export type Observation = {
  id: string;
  type: string;
  confidence: number;
  source: string;
  reviewStatus: string;
  createdAt: string;
  reviews: { decision: string; note: string }[];
};
export type Event = {
  id: string;
  type: string;
  status: string;
  source: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  executions: { id: string; status: string; result: string }[];
};
export type Notification = {
  id: string;
  message: string;
  type: string;
  readBy: string[];
  createdAt: string;
};
export type Snapshot = {
  vehicleCategories:{code:string;nameAr:string;nameEn:string}[];
  org: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    isDemo: boolean;
    cancellationLeadHours: number;
    siteIp?: string | null;
      publicNotice: string;
  };
  role: string;
  permissions: string[];
  branches: Branch[];
  bays: Bay[];
  services: Service[];
  vehicles: Vehicle[];
  washes: Wash[];
  members: {
    id: string;
    role: string;
    active: boolean;
    user: { id: string; name: string; email: string };
  }[];
  cameras: Camera[];
  rules: Rule[];
  events: Event[];
  observations: Observation[];
  notifications: Notification[];
  auditLogs: Audit[];
  customRoles: { id: string; name: string; permissions: string[] }[];
};
export type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string; category?: string; durationMinutes?:number;price?:string;pricingRules?:{category:string;size:string;price:string;durationMinutes?:number|null}[] }[];
  currency?:string;
  customCategories?:{code:string;nameAr:string;nameEn:string}[];
  default?: string;
  min?: number;
  max?: number;
  step?: string;
  multiple?: boolean;
};
export type Receipt = {
  number: string;
  organization: string;
  branch: string;
  city: string;
  serviceAr: string;
  serviceEn: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  currency: string;
  payment: { method: string; reference: string; receivedAt: string };
  status: string;
};
export type Modal = {
  title: string;
  fields: FormField[];
  description?: string;
  submit: string;
  execute: (values: Record<string, string>) => Promise<unknown>;
};
