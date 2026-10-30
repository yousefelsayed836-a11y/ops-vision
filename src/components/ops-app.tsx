"use client";
import {LoginFields,rememberLoginEmail,saveBrowserPassword} from './login-fields';
import {ContractGate,ContractsPanel} from './contracts-panel';
import {washCatalog,vehicleCategoryLabel,vehicleCategories} from "@/lib/catalog";
import {saudiDateTime} from "@/lib/saudi-time";
import {PlatformBays} from "./platform-bays";
import {PlatformWashReports} from "./platform-wash-reports";
import {ReportDownload} from "./report-download";
import {EnablePush} from "./enable-push";
import {CameraVisitsPanel} from "./camera-visits-panel";
import {CameraRegistry} from "./camera-registry";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";

import { Logo } from "./logo";
import { api, ApiError, authClient } from "@/lib/client";
import type {
  Me,
  Snapshot,
  PlatformData,
  Modal,
  FormField,
  Wash,
  Application,
  Receipt,
} from "./types";
import type {DailyStatistics} from "@/lib/statistics";
import {TenantBaysPanel} from "./tenant-bays-panel";
import {VehicleCategoryPicker} from "./vehicle-category-picker";
import {ServiceChoicePicker} from "./service-choice-picker";
import {ServicePricingEditor} from "./service-pricing-editor";
import {WashActivity} from './wash-activity';
import {AccountAdmin} from './account-admin';
import {CustomerPanel} from "./customer-panel";
import { InstallApp } from "./install-app";
import {
  tenantPermissions,
  platformPermissions,
  roles,
} from "@/lib/permissions";

const statuses: Record<string, string[]> = {
  BOOKED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["WAITING", "ASSIGNED", "CANCELLED"],
  WAITING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["WASHING", "CANCELLED"],
  WASHING: ["PAUSED", "INSPECTION", "CANCELLED"],
  PAUSED: ["WASHING", "CANCELLED"],
  INSPECTION: ["WASHING", "COMPLETED"],
  COMPLETED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
const vehicleImages:Record<string,string>={SEDAN:'/assets/sedan.webp',SUV:'/assets/suv.webp',FULL_SIZE_SUV:'/assets/4x4.webp',MOTORCYCLE:'/assets/motorcycle.png',BICYCLE:'/assets/bicycle.png'};
function Badge({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={`badge ${["ACTIVE", "AVAILABLE", "APPROVED", "COMPLETED", "DELIVERED", "SUCCEEDED", "CONFIRMED", "PAID"].includes(value) ? "positive" : ["PENDING", "UNDER_REVIEW", "PAUSED", "RETRY", "DEAD", "MORE_INFORMATION_REQUIRED"].includes(value) ? "warning" : ["SIMULATED"].includes(value) ? "pink" : ""}`}
    >
      {label}
    </span>
  );
}
function StateEmpty({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
    </div>
  );
}
function Field({ field,selectedCategory,onCategoryChange,onServiceChange,signIn=false }: { field: FormField;signIn?:boolean;selectedCategory?:string;onCategoryChange?:(value:string)=>void;onServiceChange?:(value:string)=>void }) {
  const locale = useLocale();
  if (field.type === "vehicle-category") return <VehicleCategoryPicker name={field.name} label={field.label} locale={locale} value={selectedCategory} defaultValue={field.default} onChange={onCategoryChange} custom={field.customCategories}/>;
  if (field.type === "service-choice") return <ServiceChoicePicker name={field.name} label={field.label} options={field.options??[]} category={selectedCategory??'SEDAN'} currency={field.currency} onChange={onServiceChange}/>;
  if (field.type === "permissions")
    return (
      <fieldset className="field permission-choices">
        <legend>{field.label}</legend>
        {field.options?.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              name={field.name}
              value={option.value}
              defaultChecked={
                field.default?.split(",").includes(option.value) ?? false
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  return (
    <label className="field">
      <span>{field.label}</span>
      {field.options ? (
        <select
          name={field.name}
          multiple={field.multiple}
          size={field.multiple ? 8 : undefined}
          required={field.required !== false}
          defaultValue={
            field.multiple
              ? (field.default?.split(",") ?? [])
              : (field.default ?? "")
          }
        >
          {!field.multiple && (
            <option value="" disabled>
              —
            </option>
          )}
          {field.options.filter(o=>!o.category||!selectedCategory||o.category==='ALL'||o.category===selectedCategory).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          name={field.name}
          rows={3}
          required={field.required !== false}
          defaultValue={field.default}
        />
      ) : (
        <input
          name={field.name}
          type={field.type ?? "text"}
          required={field.required !== false}
          defaultValue={field.default}
          min={field.min}
          max={field.max}
          step={field.step}
          minLength={field.type === "password"&&!signIn ? 12 : undefined}
          maxLength={field.type === "password" ? 128 : 1000}
          autoComplete={field.type === "password" ? (signIn?"current-password":"new-password") : field.type==='email'?'username':"off"}
        />
      )}
    </label>
  );
}
function FormDialog({
  modal,
  onClose,
  onSuccess,
  onError,
}: {
  modal: Modal;
  onClose: () => void;
  onSuccess: () => void;
  onError: (e: unknown) => void;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedCategory,setSelectedCategory]=useState(modal.fields.find(field=>field.name==='category')?.default??'SEDAN');
  const [selectedService,setSelectedService]=useState('');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const values = Object.fromEntries(
        modal.fields.map((field) => [
          field.name,
          field.multiple
            ? form.getAll(field.name).join(",")
            : String(form.get(field.name) ?? ""),
        ]),
      );
      await modal.execute(values);
      onClose();
      onSuccess();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={ref} onCancel={onClose} className="form-dialog">
      <div className="dialog-heading">
        <h2>{modal.title}</h2>
        <button
          className="icon-button"
          aria-label={t("close")}
          onClick={onClose}
        >
          {t("close")}
        </button>
      </div>
      {modal.description && <p className="muted">{modal.description}</p>}
      <form onSubmit={submit}>
        <div className="form-fields">
          {modal.fields.filter(field=>field.name!=='quantity'||modal.fields.find(item=>item.name==='serviceId')?.options?.find(option=>option.value===selectedService)?.unit==='meter').map((field) => (
            <Field key={field.name==='serviceId'?`${field.name}-${selectedCategory}`:field.name} field={field} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} onServiceChange={setSelectedService}/>
          ))}
        </div>
        <button disabled={busy} className="button primary full" type="submit">
          {busy ? "…" : modal.submit}
        </button>
      </form>
    </dialog>
  );
}
function ReceiptDialog({
  record,
  onClose,
}: {
  record: Receipt;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const format = (value: string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: record.currency,
    }).format(Number(value));
  return (
    <dialog ref={ref} onCancel={onClose} className="form-dialog receipt-dialog">
      <div className="dialog-heading">
        <Logo variant="pink" />
        <button
          className="icon-button receipt-actions"
          onClick={onClose}
          aria-label={t("close")}
        >
          {t("close")}
        </button>
      </div>
      <h2>{t("receipt")}</h2>
      <p>
        {record.organization} · {record.branch}
      </p>
      <small>
        {record.number} ·{" "}
        {saudiDateTime(record.payment.receivedAt,locale)}
      </small>
      <div className="receipt-detail">
        <span>{t("service")}</span>
        <b>{locale === "ar" ? record.serviceAr : record.serviceEn}</b>
      </div>
      {[
        ["subtotal", record.subtotal],
        ["discount", record.discount],
        ["total", record.total],
      ].map(([label, value]) => (
        <div className="receipt-detail" key={label}>
          <span>{t(label)}</span>
          <b>{format(value)}</b>
        </div>
      ))}
      <small>
        {t("reference")}: {record.payment.reference}
      </small>
      <button
        className="button primary full receipt-actions"
        onClick={() => window.print()}
      >
        {t("print")}
      </button>
    </dialog>
  );
}
function InvitationDialog({
  link,
  onClose,
}: {
  link: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    void QRCode.toDataURL(link, {
      margin: 1,
      width: 220,
      errorCorrectionLevel: "M",
    }).then(setImage);
  }, [link]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      className="form-dialog invitation-dialog"
    >
      <div className="dialog-heading">
        <h2>{t("invitationTitle")}</h2>
        <button
          className="icon-button"
          aria-label={t("close")}
          onClick={onClose}
        >
          {t("close")}
        </button>
      </div>
      <p className="muted">{t("invitationHelp")}</p>
      {image && (
        <Image src={image} alt="QR" width={220} height={220} unoptimized />
      )}
      <input
        value={link}
        readOnly
        dir="ltr"
        aria-label={t("invitationTitle")}
      />
      <button
        className="button primary full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {t(copied ? "copied" : "copy")}
      </button>
      <small>{t("secretOnce")}</small>
    </dialog>
  );
}

export function OpsApp({ view }: { view: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const href = (path = "") => `/${locale}${path ? "/" + path : ""}`;
  const [me, setMe] = useState<Me | null>(null);
  const [orgId, setOrgId] = useState("");
  const [data, setData] = useState<Snapshot | null>(null);
  const categories=[...vehicleCategories,...(data?.vehicleCategories??[]).map(item=>item.code)];
  const [platformData, setPlatformData] = useState<PlatformData | null>(null);
  const [tab, setTab] = useState("organizations");
  const [loading, setLoading] = useState(view === "dashboard");
  const initialOrgSelection = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [modal, setModal] = useState<Modal | null>(null);
  const [invitation, setInvitation] = useState("");
  const [showArchived,setShowArchived]=useState(false);
  const [statsDate,setStatsDate]=useState('');
  const [dayStats,setDayStats]=useState<DailyStatistics|null>(null);
  const [statsFailure,setStatsFailure]=useState('');
  const [receipt, setReceipt] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const token = useSyncExternalStore(
    (callback) => {
      window.addEventListener("hashchange", callback);
      return () => window.removeEventListener("hashchange", callback);
    },
    () => window.location.hash.slice(1),
    () => "",
  );
  const [digitalReceipt, setDigitalReceipt] = useState<Receipt | null>(null);
  const isPlatform =
    !!me && ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(me.user.platformRole);
  const isCustomer = data?.role === "CUSTOMER";
  const has = (permission: string) => !(data?.role==='OWNER'&&permission.startsWith('wash.')&&permission!=='wash.view_sessions')&&!!data?.permissions.includes(permission);
  const manageServices = () => has('tenant.manage_services') || has('wash.manage_services');
  const state = (value: string) =>
    t.has(`states.${value}`) ? t(`states.${value}`) : value;
  const statsAllowed=!!data&&!isCustomer&&['wash.view_sessions','reports.view','finance.view_revenue'].some(p=>data.permissions.includes(p));
  useEffect(()=>{if(view!=='dashboard'||!orgId||!statsAllowed||!['overview','reports'].includes(tab))return;let active=true;const key=`${orgId}:${statsDate||'all'}`;async function loadStats(){try{const result=await api<DailyStatistics>(`tenants/${orgId}/statistics?date=${statsDate||'all'}`);if(active){setDayStats(result);setStatsFailure('');}}catch{if(active)setStatsFailure(key);}}const initial=setTimeout(()=>void loadStats(),0),timer=setInterval(()=>void loadStats(),15000);return()=>{active=false;clearTimeout(initial);clearInterval(timer);};},[view,orgId,statsDate,statsAllowed,tab]);
  const selectedDay=dayStats?.orgId===orgId&&dayStats.date===(statsDate||'all')?dayStats:null;
  const showError = useCallback(
    (error: unknown) => {
      const code = error instanceof ApiError ? error.code : "";
      setToast({
        text:
          code && t.has(`errors.${code}`) ? `${t(`errors.${code}`)} (${code})` : `${t("error")} (${code||"UNKNOWN"})`,
        error: true,
      });
    },
    [t,setToast],
  );
  const load = useCallback(
    async (selected: string) => {
      try {
        if (selected) {
          const snapshot=await api<Snapshot>(`tenants/${selected}/snapshot`); setData(snapshot); setPlatformData(null); if(snapshot.role!=="CUSTOMER"&&!initialOrgSelection.current.has(selected)){initialOrgSelection.current.add(selected);setTab(snapshot.permissions.includes("wash.view_sessions")?"operations":"branches");}
        } else {
          setPlatformData(await api<PlatformData>("platform"));
          setData(null);
        }
      } catch (error) {
        showError(error);
      } finally {
        setLoading(false);
      }
    },
    [showError],
  );
  const refresh = useCallback(async () => {
    await load(orgId);
  }, [load, orgId]);
  useEffect(() => {
    if (view !== "dashboard") return;
    let alive = true;
    void api<Me>("me")
      .then((result) => {
        if (!alive) return;
        setMe(result);
        if (["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(result.user.platformRole)) setTab("organizations");
        const selected = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(
          result.user.platformRole,
        )
          ? ""
          : (result.memberships.length === 1 ? (result.memberships[0]?.orgId ?? "") : "");
        setOrgId(selected);
        if (
          selected ||
          ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(result.user.platformRole)
        )
          void load(selected);
        else setLoading(false);
      })
      .catch(showError);
    return () => {
      alive = false;
    };
  }, [view, load, showError]);
  useEffect(() => {
    if (view !== "dashboard" || !me) return;
    const interval = setInterval(() => {
      if (!document.hidden && (orgId || isPlatform)) void load(orgId);
    }, 15000);
    return () => clearInterval(interval);
  }, [view, me, orgId, isPlatform, load]);
  useEffect(() => {
    if (!toast) return;
    if(toast.error)return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);
  const linkInvitation = (result: unknown) => {
    if (
      typeof result === "object" &&
      result &&
      "token" in result &&
      typeof result.token === "string"
    )
      setInvitation(
        `${window.location.origin}/${locale}/activate#${result.token}`,
      );
  };
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      setToast({ text: t("success"), error: false });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  async function publicSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form=e.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    try {
      if (view === "register") {
        const result = await api<{ id: string }>("applications", "POST", {
          ...values,
          branchCount: Number(values.branchCount),
        });
        setReceipt(result.id);
      } else if (view === "login") {
        const result = await authClient.signIn.email({
          email: String(values.email).trim().toLowerCase(),
          password: String(values.password),
        });
        if (result.error) {
          setToast({
            text:
              result.error.status===429?(locale==='ar'?'محاولات كثيرة، انتظر دقيقة ثم حاول مجددًا.':'Too many attempts. Wait a minute and retry.'):(locale==='ar'?'راجع البريد وكلمة المرور أو اطلب من المدير ضبط الحساب.':'Check your email and password or ask the administrator to reset the account.'),
            error: true,
          });
          return;
        }
        rememberLoginEmail(String(values.email).trim().toLowerCase());
        await saveBrowserPassword(form);
        window.location.assign(href("dashboard"));
      } else if (view === "activate") {
        await api(
          token.startsWith("reset=") ? "reset-password" : "activate",
          "POST",
          token.startsWith("reset=")
            ? { token: token.slice(6), newPassword: values.password }
            : { token, password: values.password },
        );
        setReceipt("activated");
      } else {
        await api("forgot-password", "POST", values);
        setReceipt("reset");
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  async function signInWithSavedPassword(email:string,password:string){
    setBusy(true);
    try{
      const result=await authClient.signIn.email({email,password});
      if(result.error){setToast({text:locale==='ar'?'كلمة المرور المحفوظة غير صحيحة أو تحتاج تحديثًا.':'The saved password is incorrect or needs updating.',error:true});return;}
      rememberLoginEmail(email);
      window.location.assign(href('dashboard'));
    }catch(error){showError(error);}
    finally{setBusy(false);}
  }
  const field = (name: string, type?: string, required = true): FormField => ({
    name,
    label: t(name),
    type,
    required,
  });
  const options = (items: { id: string; name: string }[]) =>
    items.map((i) => ({ value: i.id, label: i.name }));
  const branchField: FormField = {
    name: "branchId",
    label: t("branch"),
    options: options(data?.branches ?? []),
  };
  const bayField: FormField = {
    name: "bayId",
    label: t("bay"),
    options: options(data?.bays ?? []),
    required: false,
  };
  function openForm(
    title: string,
    fields: FormField[],
    resource: string,
    map: (values: Record<string, string>) => unknown = (v) => v,
    description?: string,
  ) {
    setModal({
      title: t(title),
      fields,
      description,
      submit: t("save"),
      execute: async (values) => {
        const result = await api(
          `tenants/${orgId}/${resource}`,
          "POST",
          map(values),
        );
        linkInvitation(result);
        return result;
      },
    });
  }
  const newOrganizationForm = () => setModal({
    title: t('newOrganization'),
    fields: [{...field('businessName')},{...field('name'),name:'ownerName'},field('email','email'),field('phone','tel'),field('city')],
    submit: t('newOrganization'),
    execute: async values => {
      const result = await api<{invitation:{token:string}}>('platform/organizations','POST',{...values,branchCount:1});
      linkInvitation(result.invitation);
      return result;
    },
  });
  const branchForm = () =>
    openForm(
      "newBranch",
      [
        field("name"),
        field("city"),
        { ...field("opensAt", "time"), default: "08:00" },
        { ...field("closesAt", "time"), default: "22:00" },
      ],
      "branches",
    );
  const serviceForm = () =>
    openForm(
      "newService",
      [
        field("nameAr"),
        field("nameEn"),
        { ...field("price", "number"), min: 0, step: "0.01" },
        {
          ...field("duration", "number"),
          name: "durationMinutes",
          min: 1,
          max: 1440,
        },
        {
          name: "category",
          label: t("category"),
          options: ["ALL", ...categories].map((value) => ({
            value,
            label: vehicleCategoryLabel(value,locale,data?.vehicleCategories),
          })),
          default: "ALL",
        },
      ],
      "services",
    );
  const washForm = (bay?:{id:string;branchId:string}) => setModal({title:t('newWash'),fields:[{...bayField,required:true,default:bay?.id,options:(data?.bays??[]).filter(b=>b.status==='AVAILABLE'&&!b.activeWashId).map(b=>({value:b.id,label:`${data?.branches.find(branch=>branch.id===b.branchId)?.name??''} · ${b.name}`}))},{name:'category',label:t('category'),type:'vehicle-category',default:'SEDAN',customCategories:data?.vehicleCategories},{name:'quantity',label:locale==='ar'?'عدد الأمتار':'Meters',type:'number',min:0.01,step:'0.01',default:'1'},{name:'serviceId',label:t('service'),type:'service-choice',currency:data?.org.currency,options:(data?.services??[]).filter(service=>service.active).map(service=>({value:service.id,label:locale==='ar'?service.nameAr:service.nameEn,category:service.category,unit:service.unit,durationMinutes:service.durationMinutes,price:service.price,pricingRules:service.pricingRules}))}],submit:t(has('wash.start_session')?'startWash':'save'),execute:async values=>{const selectedBay=data?.bays.find(b=>b.id===values.bayId);return api(`tenants/${orgId}/wash-entry`,'POST',{branchId:selectedBay?.branchId,bayId:values.bayId,serviceId:values.serviceId,quantity:Number(values.quantity||1),vehicle:{category:values.category},startNow:has('wash.start_session')});}});
  function startWash(wash:Wash){if(wash.bayId){void run(()=>api(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'WASHING',version:wash.version}));return;}setModal({title:t('startWash'),fields:[{...bayField,required:true,options:(data?.bays??[]).filter(b=>b.branchId===wash.branchId&&b.status==='AVAILABLE'&&!b.activeWashId).map(b=>({value:b.id,label:b.name}))}],submit:t('startWash'),execute:values=>api(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'WASHING',version:wash.version,bayId:values.bayId})});}
  function finishWash(wash:Wash){void run(()=>api(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'COMPLETED',version:wash.version}));}
  function pauseWash(wash:Wash){void run(()=>api(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'PAUSED',version:wash.version}));}
  const canPlatform = (permission: string) =>
    me?.user.platformRole === "SUPER_ADMIN" ||
    !!platformData?.permissions.includes(permission);
  const permissionField = (
    platform = false,
    defaults: readonly string[] = [],
  ): FormField => ({
    name: "permissions",
    label: t("permissions"),
    type: "permissions",
    multiple: true,
    required: false,
    default: defaults.join(","),
    options: (platform ? platformPermissions : tenantPermissions.filter(p=>!["tenant.manage_automation","video.analyze"].includes(p)))
      .filter((p) => (platform ? canPlatform(p) : has(p)))
      .filter((p) => p !== "customers.self")
      .map((value) => ({
        value,
        label: t(`permissionLabels.${value.replaceAll(".", "_")}`),
      })),
  });
  const inviteForm = () =>
    setModal({
      title: t("newAccount"),
      fields: [
        field("name"),
        field("email", "email"),
        ...(!orgId
          ? [permissionField(true)]
          : [{ ...branchField, required: false }, permissionField()]),
      ],
      submit: t("createAccount"),
      execute: async (v) => {
        const result = await api(
          !orgId ? "platform/staff" : `tenants/${orgId}/invitations`,
          "POST",
          {
            name: v.name,
            email: v.email,
            role: "STAFF",
            branchId: v.branchId || undefined,
            permissions: v.permissions
              ? v.permissions.split(",").filter(Boolean)
              : [],
          },
        );
        linkInvitation(result);
        return result;
      },
    });
  const bookingForm = () => openForm('book',[branchField,{...bayField,required:true},{name:'serviceId',label:t('service'),options:(data?.services??[]).filter(service=>service.active).map(service=>({value:service.id,label:locale==='ar'?service.nameAr:service.nameEn}))},{name:'category',label:t('category'),default:'SEDAN',options:categories.map(value=>({value,label:vehicleCategoryLabel(value,locale,data?.vehicleCategories)}))},{name:'bookedFor',label:t('bookingTime'),type:'datetime-local'}],'wash-entry',values=>({branchId:values.branchId,bayId:values.bayId,serviceId:values.serviceId,bookedFor:new Date(values.bookedFor).toISOString(),vehicle:{category:values.category}}));
  const roleForm = () =>
    openForm(
      "newRole",
      [
        field("name"),
        {
          name: "permissions",
          label: t("permissions"),
          multiple: true,
          options: tenantPermissions
            .filter((p) => has(p)&&!["tenant.manage_automation","video.analyze"].includes(p))
            .map((value) => ({
              value,
              label: t(`permissionLabels.${value.replaceAll(".", "_")}`),
            })),
        },
      ],
      "roles",
      (v) => ({ ...v, permissions: v.permissions.split(",") }),
    );
  function settingsForm() {
    setModal({
      title: t("organizationSettings"),
      fields: [
        { ...field("siteIp", "text", false), default: data?.org.siteIp ?? "" },
        { ...field("name"), default: data?.org.name },
        {
          name: "currency",
          label: t("currency"),
          options: ["SAR", "EGP", "AED", "KWD"].map((value) => ({
            value,
            label: value,
          })),
          default: data?.org.currency,
        },
        {
          ...field("cancellationLeadHours", "number"),
          min: 0,
          max: 72,
          default: String(data?.org.cancellationLeadHours ?? 1),
        },
      ],
      submit: t("save"),
      execute: (v) =>
        api(`tenants/${orgId}/organization-settings`, "PATCH", {
          ...v,
          cancellationLeadHours: Number(v.cancellationLeadHours),
        }),
    });
  }
  async function openReceipt(washId: string) {
    try {
      setDigitalReceipt(
        await api<Receipt>(`tenants/${orgId}/washes/${washId}/receipt`),
      );
    } catch (error) {
      showError(error);
    }
  }
  function cancelBooking(wash: Wash) {
    setModal({
      title: t("cancelBooking"),
      description: t("cancelBookingConfirm"),
      fields: [],
      submit: t("confirm"),
      execute: () =>
        api(`tenants/${orgId}/washes/${wash.id}/cancel-booking`, "POST", {
          version: wash.version,
        }),
    });
  }
  function rateWash(wash: Wash) {
    setModal({
      title: t("feedback"),
      fields: [
        {
          ...field("rating", "number"),
          min: 1,
          max: 5,
          default: String(wash.feedback?.rating ?? 5),
        },
        {
          ...field("comment", "textarea", false),
          default: wash.feedback?.comment ?? "",
        },
      ],
      submit: t("save"),
      execute: (v) =>
        api(`tenants/${orgId}/washes/${wash.id}/feedback`, "POST", {
          rating: Number(v.rating),
          comment: v.comment,
        }),
    });
  }
  function editMember(id: string, role: string, active: boolean) {
    const permissions =
      data?.customRoles.find((r) => r.name === role)?.permissions ??
      roles[role] ??
      [];
    editAccess(id, active, permissions, false);
  }
  function editAccess(
    id: string,
    active: boolean,
    permissions: readonly string[],
    platform: boolean,
  ) {
    setModal({
      title: t("editMember"),
      fields: [
        permissionField(platform, permissions),
        {
          name: "active",
          label: t("status"),
          options: [
            { value: "true", label: t("active") },
            { value: "false", label: t("disabled") },
          ],
          default: String(active),
        },
      ],
      submit: t("save"),
      execute: (v) =>
        api(
          platform ? `platform/staff/${id}` : `tenants/${orgId}/members/${id}`,
          "PATCH",
          {
            permissions: v.permissions ? v.permissions.split(",") : [],
            active: v.active === "true",
          },
        ),
    });
  }
  function changeWash(wash: Wash) {
    const allowed = (statuses[wash.status] ?? []).filter((value) =>
      has(
        value === "CANCELLED"
          ? "wash.cancel_session"
          : value === "PAUSED"
            ? "wash.pause_session"
            : ["COMPLETED", "DELIVERED", "INSPECTION"].includes(value)
              ? "wash.complete_session"
              : "wash.start_session",
      ),
    );
    setModal({
      title: t("transition"),
      fields: [
        {
          name: "to",
          label: t("status"),
          options: allowed.map((value) => ({ value, label: state(value) })),
        },
        bayField,
      ],
      submit: t("save"),
      execute: (values) =>
        api(`tenants/${orgId}/washes/${wash.id}/transition`, "POST", {
          to: values.to,
          version: wash.version,
          bayId: values.bayId || undefined,
        }),
    });
  }
  function assign(wash: Wash) {
    setModal({
      title: t("assignWorker"),
      fields: [
        {
          name: "userId",
          label: t("employee"),
          options: (data?.members ?? [])
            .filter((m) => m.role !== "CUSTOMER")
            .map((m) => ({ value: m.user.id, label: m.user.name })),
        },
      ],
      submit: t("save"),
      execute: (v) =>
        api(`tenants/${orgId}/washes/${wash.id}/workers`, "POST", v),
    });
  }
  function reviewApplication(app: Application, status: string) {
    setModal({
      title: t(
        status === "APPROVED"
          ? "approve"
          : status === "REJECTED"
            ? "reject"
            : status === "UNDER_REVIEW"
              ? "review"
              : "moreInfo",
      ),
      description: status === "APPROVED" ? t("approveConfirm") : undefined,
      fields: [field("note", "textarea", false)],
      submit: t("confirm"),
      execute: async (values) => {
        const result = await api<{ invitation?: { token: string } }>(
          `platform/applications/${app.id}/decision`,
          "POST",
          { status, note: values.note },
        );
        if (result.invitation) linkInvitation(result.invitation);
        return result;
      },
    });
  }
  const navigation =
    !orgId && isPlatform
      ? [
          ...(canPlatform("platform.manage_tenants") ? ["organizations"] : []),
          ...(canPlatform("platform.view_bays") ? ["allBaysTitle"] : []),
          ...(canPlatform("platform.review_applications")
            ? ["applications"]
            : []),
          "notifications",
          ...(canPlatform("platform.view_reports") ? ["platformReports"] : []),
          ...(canPlatform("platform.manage_users") ? ["team"] : []),
          ...(canPlatform('platform.manage_users')?['accounts']:[]),
          "installApp",
          ...((has("tenant.manage_profile")||manageServices()) ? ["organizationSettingsTab"] : []),
          ...(canPlatform("platform.manage_tenants") ? ["contracts"] : []),
        ]
      : isCustomer
        ? [
            "overview",
            "operations",
            "services",
            "installApp",
            ...((has("tenant.manage_profile")||manageServices()) ? ["organizationSettingsTab"] : []),
          ]
        : [
            ...(data?.role==='OWNER'?[]:["overview"]),
            ...(has("wash.view_sessions") ? ["operations"] : []),
            ...(has("tenant.manage_branches") || has("tenant.manage_bays")
              ? ["branches"]
              : []),
            ...(manageServices() || data?.role==='MANAGER' ? ["services"] : []),
            ...(has("tenant.manage_employees") ? ["team"] : []),
            ...(has("tenant.manage_cameras")&&data?.role!=='OWNER' ? ["cameraIp"] : []),
            ...(has("tenant.manage_customers")&&data?.role!=='OWNER' ? ["washCustomers"] : []),
            ...(has("reports.view") ? ["reports"] : []),
            
            "notifications",
            ...(data?.role==='OWNER'?[]:["installApp","contract"]),
            ...((has("tenant.manage_profile")||manageServices()) ? ["organizationSettingsTab"] : []),
          ];
  const date = (value: string) => saudiDateTime(value,locale);
  const minutes = (ms: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
      ms / 60000,
    );
  const money = (
    value: string | number,
    currency = data?.org.currency ?? "SAR",
  ) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(
      Number(value),
    );
  const running =
    data?.washes.filter(
      (w) =>
        !["COMPLETED", "DELIVERED", "CANCELLED", "BOOKED"].includes(w.status),
    ) ?? [];
  const washes =
    data?.washes.filter(
      (w) =>
        (!filter || w.status === filter) &&
        (!search ||
          w.id.includes(search)),
    ) ?? [];
  const stats = platformData
    ? [
        {
          label: t("applications"),
          value: platformData.applications.length,
        },
        {
          label: t("pending"),
          value: platformData.applications.filter((a) => a.status === "PENDING")
            .length,
        },
        {
          label: t("organizations"),
          value: platformData.organizations.filter((o) => o.status !== "ARCHIVED").length,
        },
        {
          label: t("active"),
          value: platformData.organizations.filter((o) => o.status === "ACTIVE")
            .length,
        },
      ]
    : [
        {
          label: t("sessions"),
          value: statsAllowed ? selectedDay?.sessions ?? "…" : data?.washes.length ?? 0,
        },
        { label: t(statsDate?"statsStarted":"active"), value: statsAllowed ? (statsDate?selectedDay?.started:selectedDay?.active) ?? "…" : running.length },
        {
          label: t("statsAvailableNow"),
          value: selectedDay?.available ?? data?.bays.filter((b) => b.status === "AVAILABLE").length ?? 0,
        },
        {
          label: t("completed"),
          value: statsAllowed ? selectedDay?.completed ?? "…" :
            data?.washes.filter((w) =>
              ["COMPLETED", "DELIVERED"].includes(w.status),
            ).length ?? 0,
        },
      ];
  const markingNotifications=useRef(new Set<string>()),notificationVisit=useRef('');
  useEffect(()=>{if(tab!=='notifications'){notificationVisit.current='';return;}if(!me)return;const rows=data?.notifications??platformData?.notifications??[];const key=orgId||'platform';if((notificationVisit.current===key&&!rows.some(n=>!n.readBy.includes(me.user.id)))||markingNotifications.current.has(key))return;const ids=new Set(rows.map(n=>n.id)),userId=me.user.id;markingNotifications.current.add(key);void api(orgId?'tenants/'+orgId+'/notifications/read-all':'platform/notifications/read-all','PATCH',{}).then(()=>{notificationVisit.current=key;const mark=(item:typeof rows[number])=>ids.has(item.id)?{...item,readBy:[...new Set([...item.readBy,userId])]}:item;if(orgId)setData(value=>value?.org.id===orgId?{...value,notifications:value.notifications.map(mark)}:value);else setPlatformData(value=>value?{...value,notifications:value.notifications.map(mark)}:value);}).catch(()=>{}).finally(()=>markingNotifications.current.delete(key));},[tab,me,orgId,data,platformData]);
  const unreadNotifications=(data?.notifications??platformData?.notifications??[]).filter(n=>!n.readBy.includes(me?.user.id??'')).length;
  useEffect(()=>{const badges=navigator as Navigator&{setAppBadge?:(count:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};void (unreadNotifications?badges.setAppBadge?.(unreadNotifications):badges.clearAppBadge?.())?.catch(()=>{});},[unreadNotifications]);
  const dateControl=statsAllowed&&<div className="statistics-date-control"><label className="field">{t('statsDate')}<input type="date" value={statsDate} onChange={e=>setStatsDate(e.target.value)}/></label><button className="button outline" onClick={()=>setStatsDate('')}>{t('statsAll')}</button>{selectedDay&&<small>{selectedDay.timezone}</small>}{statsDate&&<p className="muted">{t('statsDateNote')}</p>}{statsFailure===`${orgId}:${statsDate||'all'}`&&<p role="alert">{t('statsLoadError')}</p>}</div>;
  const globalToastRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(toast&&globalToastRef.current&&!globalToastRef.current.matches(':popover-open'))globalToastRef.current.showPopover?.();},[toast]);
  useEffect(()=>{const receive=(event:Event)=>{const code=String((event as CustomEvent).detail??'INTERNAL_ERROR');setToast({text:t.has('errors.'+code)?t('errors.'+code):t('error')+' ('+code+')',error:true});};window.addEventListener('opsvision-error',receive);return()=>window.removeEventListener('opsvision-error',receive);},[t]);
  const toastView = toast && (
    <div
      ref={globalToastRef} popover="manual" className={`toast ${toast.error ? "toast-error" : ""}`}
      role={toast.error ? "alert" : "status"}
    >
      <span>{toast.text}</span>
      <button
        className="icon-button"
        aria-label={t("close")}
        onClick={() => setToast(null)}
      >
        {t("close")}
      </button>
    </div>
  );

  if (view !== "dashboard")
    return (
      <div className={`public-root ${view === "login" ? "login-root" : ""}`}>
        <header className="public-header">
          <Link href={href()} aria-label="OpsVision">
            <Logo />
          </Link>
          <nav>
            <a
              href={`/${locale === "ar" ? "en" : "ar"}/${view === "home" ? "" : view}`}
              className="language-link"
            >
              {locale === "ar" ? "EN" : "العربية"}
            </a>
            <Link href={href("login")} className="button quiet">
              {t("login")}
            </Link>
            <Link href={href("register")} className="button primary hide-small">
              {t("register")}
            </Link>
          </nav>
        </header>
        {view === "home" ? (
          <main>
            <section className="hero">
              <div className="hero-copy">
                <h1>{t("publicHeadline")}</h1>
                <p>{t("publicDescription")}</p>
                <div className="hero-actions">
                  <Link className="button primary" href={href("register")}>
                    {t("register")}
                  </Link>
                  <Link className="button outline" href={href("login")}>
                    {t("dashboard")}
                  </Link>
                  <a className="button outline" href="/guides/opsvision-setup-guide-ar.pdf" download>
                    {t("setupGuide")}
                  </a>
                </div>
              </div>
            </section>
            <section className="features" aria-labelledby="features-title">
              <div className="section-heading">
                <span className="eyebrow">{t("publicEyebrow")}</span>
                <h2 id="features-title">{t("publicHeadline")}</h2>
                <p>{t("publicDescription")}</p>
              </div>
              <div className="feature-grid">
                <article><h3>{t("featureOperations")}</h3><p>{t("featureOperationsText")}</p></article>
                <article><h3>{t("featurePeople")}</h3><p>{t("featurePeopleText")}</p></article>
                <article><h3>{t("featureAutomation")}</h3><p>{t("featureAutomationText")}</p></article>
              </div>
            </section>
            <section className="about-platform"><div className="section-heading"><h2>{t("aboutTitle")}</h2><p>{t("aboutText")}</p></div><div className="about-columns"><article><h3>{t("servicesTitle")}</h3><p>{t("servicesText")}</p></article><article><h3>{t("benefitsTitle")}</h3><ul><li>{t("benefit1")}</li><li>{t("benefit2")}</li><li>{t("benefit3")}</li><li>{t("benefit4")}</li></ul></article></div></section>
            <section className="how-it-works" aria-labelledby="how-title"><div className="section-heading"><h2 id="how-title">{t("how")}</h2><p>{locale==='ar'?'من تسجيل العربية وحتى التسليم، كل خطوة واضحة ومتابعة في نفس الشاشة.':'From vehicle arrival to handover, every step stays clear and visible in one workspace.'}</p></div><ol className="steps"><li><strong>1</strong><span>{t("step1")}</span></li><li><strong>2</strong><span>{t("step2")}</span></li><li><strong>3</strong><span>{t("step3")}</span></li><li><strong>4</strong><span>{t("step4")}</span></li></ol></section>
            <section className="public-cta">
              <div>
                <h2>{t("cta")}</h2>
                <p>{t("futureAI")}</p>
              </div>
              <Link className="button primary" href={href("register")}>
                {t("register")}
              </Link>
            </section>
            <section className="contact-section">
              <h2>{t("contact")}</h2>
              <p>{t("contactText")}</p>
            </section>
          </main>
        ) : (
          <main className="auth-page">
            <section className="auth-card">
              <h2>
                {t(
                  view === "register"
                    ? "register"
                    : view === "activate"
                      ? "activationTitle"
                      : view === "forgot-password"
                        ? "resetTitle"
                        : "login",
                )}
              </h2>
              {receipt ? (
                <div className="success-panel">
                  <p>
                    {t(
                      receipt === "activated"
                        ? "activationSuccess"
                        : receipt === "reset"
                          ? "resetMessage"
                          : "registrationSuccess",
                    )}
                  </p>
                  {!["activated", "reset"].includes(receipt) && (
                    <code dir="ltr">{receipt}</code>
                  )}
                  <Link className="button primary full" href={href("login")}>
                    {t("login")}
                  </Link>
                </div>
              ) : (
                <form method="post" autoComplete="on" onSubmit={publicSubmit}>
                  {view === "register" ? (
                    <div className="form-fields">
                      <Field field={field("businessName")} />
                      <Field field={{ ...field("name"), name: "ownerName" }} />
                      <Field field={field("email", "email")} />
                      <Field field={field("phone", "tel")} />
                      <Field field={field("city")} />
                      <Field
                        field={{
                          ...field("branchCount", "number"),
                          min: 1,
                          max: 1000,
                          default: "1",
                        }}
                      />
                    </div>
                  ) : view === "activate" ? (
                    <>
                      <Field field={field("password", "password")} />
                      <p className="muted">{t("passwordHelp")}</p>
                      {!token && (
                        <p role="alert" className="error-text">
                          {t("tokenMissing")}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <LoginFields onSavedLogin={(email,password)=>void signInWithSavedPassword(email,password)} busy={busy}/>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={busy || (view === "activate" && !token)}
                    className="button primary full"
                  >
                    {t(
                      busy
                        ? "loading"
                        : view === "register"
                          ? "submit"
                          : view === "activate"
                            ? "activate"
                            : view === "forgot-password"
                              ? "save"
                              : "login",
                    )}
                  </button>
                  {view==='login'&&<p className="muted">{locale==='ar'?'لتغيير كلمة المرور تواصل مع مدير النظام.':'Contact the system administrator to change your password.'}</p>}
                  {view === "activate" && token && (
                    <button
                      type="button"
                      className="button outline full"
                      onClick={async () => {
                        try {
                          await api("accept-invitation", "POST", { token });
                          setReceipt("activated");
                        } catch (e) {
                          showError(e);
                        }
                      }}
                    >
                      {t("acceptInvitation")}
                    </button>
                  )}
                </form>
              )}
            </section>
          </main>
        )}
        <footer className="public-footer">
          <Logo />
        </footer>
        {toastView}
      </div>
    );

  return (
    <div className="app-shell" dir={locale==='ar'?'rtl':'ltr'}>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <Link href={href()}>
          <Logo dark variant="pink" />
        </Link>
        <nav aria-label={t("dashboard")}>
          {navigation.map((item) => {
            return (
              <button
                key={item}
                className={`nav-item ${tab === item ? "selected" : ""}`}
                aria-current={tab === item ? "page" : undefined}
                onClick={() => {
                  setTab(item);
                  setMenuOpen(false);
                  setFilter("");
                  setSearch("");
                }}
              >
                <span>{t(data?.role==='OWNER'&&item==='team'?'teamAndCustomers':data?.role==='OWNER'&&item==='branches'?'branchesAndCameras':item)}</span>
                {item==='notifications'&&unreadNotifications>0&&<b>{unreadNotifications}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <strong>{me?.user.name ?? "OpsVision"}</strong>
            <small>{me?.user.email}</small>
          </div>
          <button
            className="icon-button"
            disabled={busy} aria-label={t("logout")}
            onClick={async () => {
              setBusy(true);
              try { const result=await authClient.signOut(); if(result.error)throw new Error(result.error.message); window.location.replace(href("login")); } catch(error){showError(error);setBusy(false);}
            }}
          >
            {t("logout")}
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label={t("close")}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="app-body">
        <header className="app-header">
          <div className="header-breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label={t("dashboard")}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="hamburger-icon" aria-hidden="true"><i /><i /><i /></span>
            </button>
            <strong>{me?.user.name ?? "OpsVision"}</strong>
          </div>
          <div className="header-controls">{me && <EnablePush/>}
            {me && (isPlatform || me.memberships.length > 0) && (
              <select
                className="organization-select"
                aria-label={t("chooseOrg")}
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  setTab("overview");
                  setLoading(true);
                  void load(e.target.value);
                }}
              >
                {isPlatform && <option value="">OpsVision Platform</option>}
                {me.memberships.map((m) => (
                  <option key={m.orgId} value={m.orgId}>
                    {m.org.name}
                    {m.org.isDemo ? " · DEMO" : ""}
                  </option>
                ))}
              </select>
            )}
            <a
              className="language-link"
              href={`/${locale === "ar" ? "en" : "ar"}/dashboard`}
            >
              {locale === "ar" ? "EN" : "العربية"}
            </a>
            <button
              className="icon-button"
              aria-label={t("refresh")}
              onClick={() => void refresh()}
              disabled={busy}
            >
              {t("refresh")}
            </button>
          </div>
        </header>
        <main className="workspace">{isCustomer&&data?.org.publicNotice&&<p className="public-wash-notice" role="status">{data.org.publicNotice}</p>}<ContractGate key={orgId} orgId={orgId} skip={!orgId||isPlatform||isCustomer} showContract={tab==='contract'}><InstallApp active={tab === "installApp"||(data?.role==='OWNER'&&tab==='organizationSettingsTab')}/>
          <div className="page-title">
            <div>
              <h1>{tab === "overview" ? t("workspaceTitle") : t(data?.role==='OWNER'&&tab==='team'?'teamAndCustomers':data?.role==='OWNER'&&tab==='branches'?'branchesAndCameras':tab)}</h1>
            </div>
            {tab === "overview" && isCustomer && (
              <button className="button primary" onClick={bookingForm}>
                {t("book")}
              </button>
            )}
            {tab === "overview" && !orgId && canPlatform('platform.manage_tenants') && <button className="button primary" onClick={newOrganizationForm}>{t('newOrganization')}</button>}
            {tab === "overview" && has("wash.create_session") && (
              <button className="button primary" onClick={()=>washForm()}>
                {t("newWash")}
              </button>
            )}
            {tab === "overview" && manageServices() && (
              <button className="button outline" onClick={serviceForm}>
                {t("newService")}
              </button>
            )}
          </div>
          {data?.org.isDemo && (
            <div className="notice pink">
              <div>
                <b>{t("demo")}</b>
                <span>{t("demoHint")}</span>
              </div>
            </div>
          )}
          {loading ? (
            <div className="loading-grid" aria-busy="true">
              {[1, 2, 3, 4].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : !data && !platformData ? (
            <StateEmpty title={t("noMembership")} />
          ) : (
            <>
              {['overview','reports'].includes(tab)&&!!orgId&&!isCustomer&&(has('reports.view')||has('wash.view_sessions'))&&<ReportDownload orgId={orgId}/>}
              {tab === "overview" && (
                <>
                  {dateControl}
                  <div className="stat-grid">
                    {stats.map(({ label, value }, i) => (
                      <article className={`stat-card stat-${i}`} key={label}>
                        <div>
                          <span>{label}</span>
                        </div>
                        <strong>
                          {typeof value==="number"?new Intl.NumberFormat(locale).format(value):value}
                        </strong>
                      </article>
                    ))}
                  </div>
                  {platformData ? (
                    <>
                    {canPlatform('platform.view_bays')&&<><div className="section-title"><h2>{t('allBaysTitle')}</h2><button className="text-button" onClick={()=>setTab('allBaysTitle')}>{t('all')}</button></div><PlatformBays canStart={canPlatform('platform.operate_washes')} canFinish={canPlatform('platform.complete_washes')} canManageCatalog={canPlatform('platform.manage_tenants')} overview/></>}
                    {canPlatform('platform.view_reports')&&<PlatformWashReports/>}
                    <div className="panel">
                      <div className="section-title">
                        <h2>{t("applications")}</h2>
                        <button
                          className="text-button"
                          onClick={() => setTab("applications")}
                        >
                          {t("all")}
                        </button>
                      </div>
                      {platformData.applications.length ? (
                        <div className="request-list">
                          {platformData.applications.slice(0, 5).map((app) => (
                            <div className="request-row" key={app.id}>
                              <div>
                                <b>{app.businessName}</b>
                                <small>
                                  {app.ownerName} · {app.city}
                                </small>
                              </div>
                              <Badge
                                value={app.status}
                                label={state(app.status)}
                              />
                              <button
                                className="text-button"
                                onClick={() => setTab("applications")}
                              >
                                {t("details")}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <StateEmpty title={t("empty")} />
                      )}
                    </div>
                    </>
                  ) : (
                    <>
                      {data?.role==='OWNER' ? <><div className="section-title"><h2>{t('ownerBaysTitle')}</h2></div><TenantBaysPanel orgId={orgId} data={data} onRefresh={refresh}/></> : <>
                      <div className="section-title">
                        <h2>{t("branches")}</h2>
                        {has("tenant.manage_branches") && (
                          <button className="text-button" onClick={branchForm}>
                            {t("newBranch")}
                          </button>
                        )}
                      </div>
                      <div className="branch-grid">
                        {data?.branches.map((branch) => (
                          <article className="branch-card" key={branch.id}>
                            <div className="branch-title">
                              <div>
                                <h3>{branch.name}</h3>
                                <small>
                                  {branch.city} · {branch.timezone}
                                </small>
                              </div>
                              <Badge value="ACTIVE" label={state("ACTIVE")} />
                            </div>
                            <div className="bay-grid">
                              {data.bays
                                .filter((b) => b.branchId === branch.id)
                                .map((bay) => {
                                  const activeWash=data.washes.find(w=>w.id===bay.activeWashId);
                                  return (
                                  <div
                                    className={`bay-tile ${bay.status === "OCCUPIED" ? "occupied" : ""}`}
                                    key={bay.id}
                                  >
                                    <span>{bay.name}</span>
                                    <small>{state(activeWash?.status??bay.status)}</small>
                                    {activeWash&&<>
                                      {vehicleImages[activeWash.vehicle.category]&&<Image className={`dashboard-bay-car ${activeWash.vehicle.category==='SEDAN'?'sedan-facing-left':''}`} src={vehicleImages[activeWash.vehicle.category]} alt={vehicleCategoryLabel(activeWash.vehicle.category,locale,data.vehicleCategories)} width={180} height={90}/>}
                                      <b>{vehicleCategoryLabel(activeWash.vehicle.category,locale,data.vehicleCategories)}</b>
                                      <small>{locale==='ar'?activeWash.serviceNameAr:activeWash.serviceNameEn}</small>
                                      <WashActivity washId={activeWash.id} orgId={orgId} startedAt={activeWash.startedAt} completedAt={activeWash.completedAt} status={activeWash.status} estimatedMinutes={activeWash.estimatedMinutes} timeAdjustmentSeconds={activeWash.timeAdjustmentSeconds} canAdjust={has('wash.start_session')} canComment={data.role!=='OWNER'&&has('wash.view_sessions')} onChanged={refresh}/>
                                    </>}
                                    <div className="dashboard-bay-actions">
                                      {!activeWash&&bay.status==='AVAILABLE'&&has('wash.create_session')&&<button className="button primary compact" disabled={busy} onClick={()=>washForm(bay)}>{t('startWash')}</button>}
                                      {activeWash&&has('wash.start_session')&&['ASSIGNED','PAUSED'].includes(activeWash.status)&&<button className="button primary compact" disabled={busy} onClick={()=>startWash(activeWash)}>{t(activeWash.status==='PAUSED'?'resumeWash':'startWash')}</button>}
                                      {activeWash&&has('wash.pause_session')&&activeWash.status==='WASHING'&&<button className="button outline compact" disabled={busy} onClick={()=>pauseWash(activeWash)}>{t('pauseWash')}</button>}
                                      {activeWash&&has('wash.complete_session')&&['WASHING','PAUSED','INSPECTION'].includes(activeWash.status)&&<button className="button primary compact" disabled={busy} onClick={()=>finishWash(activeWash)}>{t('finishWash')}</button>}
                                    </div>
                                  </div>
                                  );
                                })}
                            </div>
                            {!data.bays.some(
                              (b) => b.branchId === branch.id,
                            ) && <p className="muted">{t("empty")}</p>}
                            <div className="branch-footer">
                              <span>
                                {
                                  data.washes.filter(
                                    (w) => w.branchId === branch.id,
                                  ).length
                                }{" "}
                                {t("sessions")}
                              </span>
                              <button
                                className="text-button"
                                onClick={() => setTab("operations")}
                              >
                                {t("operations")}
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                      {!data?.branches.length && (
                        <StateEmpty title={t("empty")} />
                      )}
                      </>}
                    </>
                  )}
                </>
              )}
              {tab === "applications" && platformData && (
                <div className="panel">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("businessName")}</th>
                          <th>{t("name")}</th>
                          <th>{t("email")}</th>
                          <th>{t("status")}</th>
                          <th>{t("actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {platformData.applications.map((app) => (
                          <tr key={app.id}>
                            <td>
                              <b>{app.businessName}</b>
                              <small>
                                {app.city} · {app.branchCount} {t("branches")}
                              </small>
                              <small>{date(app.createdAt)}</small>
                            </td>
                            <td>
                              {app.ownerName}
                              <small>{app.phone}</small>
                            </td>
                            <td dir="ltr">{app.email}</td>
                            <td>
                              <Badge
                                value={app.status}
                                label={state(app.status)}
                              />
                              {app.note && <small>{app.note}</small>}
                            </td>
                            <td>
                              {!["APPROVED", "REJECTED"].includes(
                                app.status,
                              ) && (
                                <div className="table-actions">
                                  <button
                                    className="button primary compact"
                                    onClick={() =>
                                      reviewApplication(app, "APPROVED")
                                    }
                                  >
                                    {t("approve")}
                                  </button>
                                  <button
                                    className="button outline compact"
                                    onClick={() =>
                                      reviewApplication(app, "UNDER_REVIEW")
                                    }
                                  >
                                    {t("review")}
                                  </button>
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      reviewApplication(
                                        app,
                                        "MORE_INFORMATION_REQUIRED",
                                      )
                                    }
                                  >
                                    {t("moreInfo")}
                                  </button>
                                  <button
                                    className="text-button danger"
                                    onClick={() =>
                                      reviewApplication(app, "REJECTED")
                                    }
                                  >
                                    {t("reject")}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!platformData.applications.length && (
                    <StateEmpty title={t("empty")} />
                  )}
                </div>
              )}
              {tab === "allBaysTitle" && !orgId && <PlatformBays canStart={canPlatform("platform.operate_washes")} canFinish={canPlatform("platform.complete_washes")} canManageBays={canPlatform("platform.manage_bays")} canManageCameras={canPlatform("platform.manage_cameras")} canManageCatalog={canPlatform("platform.manage_tenants")} />}
              {tab==='contracts'&&!orgId&&canPlatform('platform.manage_tenants')&&<ContractsPanel/>}
              {tab === "platformReports" && !orgId && canPlatform('platform.view_reports') && <PlatformWashReports/>}
              {tab === "organizations" && platformData && (
                <>
                  <div className="section-title">
                    <h2>{t("organizations")}</h2>
                    <button className="button outline" onClick={newOrganizationForm}>{t('newOrganization')}</button>
                  </div>
                  <label className="field"><span><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> {t('showRemoved')}</span></label>
                  <div className="branch-grid">
                    {platformData.organizations.filter(org=>showArchived||org.status!=="ARCHIVED").map((org) => (
                      <article className="branch-card" key={org.id}>
                        <div className="section-title">
                          <h3>{org.name}</h3>
                          <Badge value={org.status} label={state(org.status)} />
                        </div>
                        <p className="muted">
                          {org._count.branches} {t("branches")} ·{" "}
                          {org._count.memberships} {t("team")} ·{" "}
                          {org._count.bays} {t("bay")}
                        </p>
                        {org.isDemo && (
                          <span className="badge pink">{t("demo")}</span>
                        )}
                        {org.status==='ACTIVE'&&<form className="management-notice-form" onSubmit={event=>{event.preventDefault();const message=String(new FormData(event.currentTarget).get('message')??'');void run(()=>api(`platform/organizations/${org.id}/notice`,'PATCH',{message}));}}><label className="field">{t('customerNotice')}<input name="message" maxLength={240} defaultValue={org.publicNotice} placeholder={t('customerNoticePlaceholder')}/></label><button className="button outline" disabled={busy}>{t('save')}</button></form>}
                        <div className="branch-footer">
                          {canPlatform('platform.view_bays')&&org.status==='ACTIVE'&&<button className="button outline compact" onClick={()=>setTab('allBaysTitle')}>{t('allBaysTitle')}</button>}
                          {org.status!=="ARCHIVED"&&<button className="text-button danger" disabled={busy} onClick={()=>setModal({title:t('removeOrganization'),description:t('removeOrganizationHelp'),fields:[],submit:t('confirm'),execute:()=>api(`platform/organizations/${org.id}`,'PATCH',{status:'ARCHIVED'})})}>{t('removeOrganization')}</button>}
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => {
                              setModal({
                                title: t(
                                  org.status === "ACTIVE"
                                    ? "suspend"
                                    : "reactivate",
                                ),
                                description: t("suspendConfirm"),
                                fields: [],
                                submit: t("confirm"),
                                execute: () =>
                                  api(
                                    `platform/organizations/${org.id}`,
                                    "PATCH",
                                    {
                                      status:
                                        org.status === "ACTIVE"
                                          ? "SUSPENDED"
                                          : "ACTIVE",
                                    },
                                  ),
                              });
                            }}
                          >
                            {t(
                              org.status === "ACTIVE"
                                ? "suspend"
                                : "reactivate",
                            )}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "branches" && data && <><div className="section-title"><h2>{t('branches')}</h2>{has('tenant.manage_branches')&&<button className="button outline" onClick={branchForm}>{t('newBranch')}</button>}</div><TenantBaysPanel orgId={orgId} data={data} onRefresh={refresh} onCreate={bay=>washForm(bay)}/></>}
              {tab === "services" && data && (
                <>
                  <div className="section-title">
                    <h2>{t("services")}</h2>
                    {manageServices() && (<div className="button-row"><button className="button outline" onClick={()=>openForm('newVehicleCategory',[field('nameAr'),field('nameEn')],'vehicle-categories')}>{t('newVehicleCategory')}</button>
                      <button className="button primary" onClick={serviceForm}>
                        {t("newService")}
                      </button>
                    </div>)}
                  </div>
                  {manageServices()&&<div className="panel"><h3>{t('catalogTitle')}</h3><p className="muted">{t('catalogHelp')}</p><div className="button-row">{washCatalog.map(item=><button key={item.ar} className="button outline compact" onClick={()=>openForm('newService',[{...field('nameAr'),default:item.ar},{...field('nameEn'),default:item.en},{...field('price','number'),min:0,step:'0.01'},{...field('duration','number'),name:'durationMinutes',min:1,max:1440},{name:'unit',label:locale==='ar'?'وحدة التسعير':'Pricing unit',default:(item as {unit?:string}).unit??'unit',type:'select',options:[{value:'unit',label:locale==='ar'?'خدمة':'Service'},{value:'meter',label:locale==='ar'?'متر':'Meter'},{value:'piece',label:locale==='ar'?'قطعة':'Piece'}]}],'services',v=>({...v,category:'ALL'}))}>{locale==='ar'?item.ar:item.en}</button>)}</div></div>}
                  {manageServices()&&data.vehicleCategories.some(item=>item.code.startsWith('CUSTOM_'))&&<div className="panel"><h3>{t('vehicleCategories')}</h3><div className="button-row">{data.vehicleCategories.filter(item=>item.code.startsWith('CUSTOM_')).map(item=><span className="badge" key={item.code}>{locale==='ar'?item.nameAr:item.nameEn}<button type="button" className="text-button danger" onClick={()=>{if(window.confirm(t('confirm'))){void run(()=>api(`tenants/${orgId}/vehicle-categories/${item.code}`,'DELETE',{}));}}}>{t('remove')}</button></span>)}</div></div>}
                  <div className="service-grid">
                    {data.services.map((service) => (
                      <article className="panel service-card" key={service.id}>
                        <h3>
                          {locale === "ar" ? service.nameAr : service.nameEn}
                        </h3>
                        <p>
                          {service.category === "ALL"
                            ? t("all")
                            : vehicleCategoryLabel(service.category,locale,data.vehicleCategories)}
                        </p>
                        <strong>{money(service.price)}</strong>
                        <small>
                          {service.durationMinutes}{" "}
                          {locale === "ar" ? "دقيقة" : "minutes"}
                        </small>
                        {manageServices() && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setModal({
                                title: t("price"),
                                fields: [
                                  {
                                    ...field("price", "number"),
                                    min: 0,
                                    step: "0.01",
                                    default: service.price,
                                  },
                                ],
                                submit: t("save"),
                                execute: (v) =>
                                  api(
                                    `tenants/${orgId}/services/${service.id}`,
                                    "PATCH",
                                    v,
                                  ),
                              });
                            }}
                          >
                            {t("price")}
                          </button>
                        )}
                        {manageServices()&&<button className="button outline compact danger" onClick={()=>{if(window.confirm(t('confirm'))){void run(()=>api(`tenants/${orgId}/services/${service.id}`,'DELETE',{}));}}}>{t('removeExtraService')}</button>}
                        {manageServices()&&<ServicePricingEditor key={`${service.id}-${service.pricingRules.length}`} basePrice={service.price} baseDuration={service.durationMinutes} rules={service.pricingRules} custom={data.vehicleCategories} serviceCategory={service.category} onSave={async prices=>{await api(`tenants/${orgId}/services/${service.id}/prices`,'POST',{prices});await refresh();}}/>}
                      </article>
                    ))}
                  </div>
                  {!data.services.length && <StateEmpty title={t("empty")} />}
                </>
              )}
              {tab === "operations" && data && (
                <>
                  <div className="section-title">
                    <button className="button outline" onClick={bookingForm}>
                      {t("book")}
                    </button>
                  </div>
                  <div className="section-title">
                    <div className="search-input">
                      <input
                        aria-label={t("search")}
                        placeholder={t("search")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="button-row">
                      <select
                        aria-label={t("status")}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="">{t("all")}</option>
                        {Object.keys(statuses).map((s) => (
                          <option value={s} key={s}>
                            {state(s)}
                          </option>
                        ))}
                      </select>
                      {has("wash.create_session") && (
                        <button className="button primary" onClick={()=>washForm()}>
                          {t("newWash")}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="wash-grid">
                    {washes.map((w) => (
                      <article className="panel wash-card" key={w.id}>
                        <div className="section-title">
                          <Image className={`dashboard-bay-car wash-card-car ${w.vehicle.category==='SEDAN'?'sedan-facing-left':''}`} src={vehicleImages[w.vehicle.category]??vehicleImages.SEDAN} alt={vehicleCategoryLabel(w.vehicle.category,locale,data.vehicleCategories)} width={150} height={75}/><span className="plate">{vehicleCategoryLabel(w.vehicle.category, locale,data.vehicleCategories)}</span>
                          <Badge value={w.status} label={state(w.status)} />
                        </div>
                        <h3>
                          {locale === "ar" ? w.serviceNameAr : w.serviceNameEn}
                        </h3>
                        <p className="muted">
                          {data.branches.find((b) => b.id === w.branchId)?.name}{" "}
                          ·{" "}
                          {data.bays.find((b) => b.id === w.bayId)?.name ?? "—"}
                        </p>
                        <div className="wash-timing">
                          <div>
                            <span>{t("durationActual")}</span>
                            <b>
                              {minutes(w.durations.washMs)}{" "}
                              {locale === "ar" ? "د" : "min"}
                            </b>
                          </div>
                          <div>
                            <span>{t("waitingTime")}</span>
                            <b>{minutes(w.durations.waitMs)}</b>
                          </div>
                          <div>
                            <span>{t("pausedTime")}</span>
                            <b>{minutes(w.durations.pauseMs)}</b>
                          </div>
                        </div>
                        <WashActivity washId={w.id} orgId={orgId} history={w.history} startedAt={w.startedAt} completedAt={w.completedAt} status={w.status} estimatedMinutes={w.estimatedMinutes} timeAdjustmentSeconds={w.timeAdjustmentSeconds} canAdjust={has('wash.start_session')} canComment={!isCustomer&&data.role!=='OWNER'&&has('wash.view_sessions')} onChanged={refresh}/>
                        {w.extraServices?.map(extra=><p className="muted" key={extra.id}>{t('extraService')}: {locale==='ar'?extra.nameAr:extra.nameEn} · {extra.durationMinutes} {t('reportMinutes')} {data.role!=='OWNER'&&manageServices()&&['WASHING','PAUSED','INSPECTION'].includes(w.status)&&<button type="button" className="text-button" disabled={busy} onClick={()=>void run(()=>api(`tenants/${orgId}/washes/${w.id}/extra-services/${extra.id}`,'DELETE',{}))}>{t('removeExtraService')}</button>}</p>)}
                        {data.role!=='OWNER'&&manageServices()&&['WASHING','PAUSED','INSPECTION'].includes(w.status)&&<div><button type="button" className="text-button" onClick={serviceForm}>{t('newService')}</button><form className="form-fields" onSubmit={event=>{event.preventDefault();const form=event.currentTarget;const serviceIds=new FormData(form).getAll('serviceId').map(String);if(!serviceIds.length)return;void run(async()=>{for(const serviceId of serviceIds)await api(`tenants/${orgId}/washes/${w.id}/extra-services`,'POST',{serviceId,quantity:Number((form.querySelector(`[name=quantity-${serviceId}]`) as HTMLInputElement|null)?.value??1)});form.reset();});}}><fieldset className="field"><legend>{t('chooseServices')}</legend>{data.services.filter(service=>service.active&&!w.extraServices?.some(extra=>extra.serviceId===service.id)&&(service.category==='ALL'||service.category===w.vehicle.category)).map(service=><label key={service.id} className="checkbox-row"><input type="checkbox" name="serviceId" value={service.id}/><input name={`quantity-${service.id}`} type="number" min="0.01" step="0.01" defaultValue="1" aria-label={locale==='ar'?'الكمية':'Quantity'}/>{locale==='ar'?service.nameAr:service.nameEn} · {money(service.price,data.org.currency)}</label>)}</fieldset><button className="button outline compact" disabled={busy}>{t('addExtraService')}</button></form></div>}
                        
                        {w.bookedFor && (
                          <p className="muted">
                            {t("bookingTime")}: {date(w.bookedFor)}
                          </p>
                        )}
                        <div className="wash-price">
                          <span>
                            {w.price !== undefined
                              ? money(w.price, w.currency)
                              : "—"}
                          </span>
                          <Badge
                            value={w.paymentStatus}
                            label={state(w.paymentStatus)}
                          />
                        </div>
                        <div className="table-actions">
                          {!isCustomer&&has('wash.start_session')&&['CHECKED_IN','WAITING','ASSIGNED','PAUSED'].includes(w.status)&&<button className="button primary" disabled={busy} onClick={()=>startWash(w)}>{t(w.status==='PAUSED'?'resumeWash':'startWash')}</button>}
                          {!isCustomer&&has('wash.pause_session')&&w.status==='WASHING'&&<button className="button outline" disabled={busy} onClick={()=>pauseWash(w)}>{t('pauseWash')}</button>}
                          {!isCustomer&&has('wash.complete_session')&&['WASHING','PAUSED','INSPECTION'].includes(w.status)&&<button className="button primary" disabled={busy} onClick={()=>finishWash(w)}>{t('finishWash')}</button>}
                          {!isCustomer&&data.role!=='OWNER'&&(statuses[w.status]??[]).length>0&&<details><summary className="text-button">{t('moreActions')}</summary><button className="button outline compact" onClick={()=>changeWash(w)}>{t('transition')}</button></details>}
                          {has("wash.assign_workers") &&
                            !["COMPLETED", "DELIVERED", "CANCELLED"].includes(
                              w.status,
                            ) && (
                              <button
                                className="button outline compact"
                                onClick={() => assign(w)}
                              >
                                {t("assignWorker")}
                              </button>
                            )}
                          <button
                            className="text-button"
                            disabled={w.paymentStatus !== "PAID"}
                            onClick={() => void openReceipt(w.id)}
                          >
                            {t("receipt")}
                          </button>
                          {isCustomer && w.status === "BOOKED" && (
                            <button
                              className="text-button danger"
                              onClick={() => cancelBooking(w)}
                            >
                              {t("cancelBooking")}
                            </button>
                          )}
                          {isCustomer &&
                            ["COMPLETED", "DELIVERED"].includes(w.status) && (
                              <button
                                className="text-button"
                                onClick={() => rateWash(w)}
                              >
                                {t("feedback")}
                                {w.feedback
                                  ? " · " + w.feedback.rating + "/5"
                                  : ""}
                              </button>
                            )}
                        </div>
                        <details>
                          <summary>{t("history")}</summary>
                          {w.history.map((h, i) => (
                            <div className="history-line" key={i}>
                              <span>{state(h.toStatus)}</span>
                              <small>{date(h.createdAt)}</small>
                            </div>
                          ))}
                        </details>
                      </article>
                    ))}
                  </div>
                  {!washes.length && <StateEmpty title={t("empty")} />}
                </>
              )}

              {tab === "team" &&
                platformData &&
                canPlatform("platform.manage_users") && (
                  <div className="panel">
                    <div className="section-title">
                      <h2>{t("team")}</h2>
                      <button className="button primary" onClick={inviteForm}>
                        {t("newAccount")}
                      </button>
                    </div>
                    {platformData.staff.map((member) => (
                      <div className="receipt-detail" key={member.id}>
                        <div>
                          <strong>{member.name}</strong>
                          <small dir="ltr">{member.email}</small>
                          <small>
                            {member.platformPermissions
                              .map((p) =>
                                t(`permissionLabels.${p.replaceAll(".", "_")}`),
                              )
                              .join("، ") || t("noPermissions")}
                          </small>
                        </div>
                        <button
                          className="button outline compact"
                          onClick={() =>
                            editAccess(
                              member.id,
                              !member.disabled,
                              member.platformPermissions,
                              true,
                            )
                          }
                        >
                          {t("editMember")}
                        </button>
                      </div>
                    ))}
                    {!platformData.staff.length && (
                      <StateEmpty title={t("empty")} />
                    )}
                  </div>
                )}
              {tab === "team" && data && (
                <>
                  <div className="section-title">
                    <h2>{t("team")}</h2>
                    <button className="button primary" onClick={inviteForm}>
                      {t("newAccount")}
                    </button>
                  </div>
                  <div className="panel">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("name")}</th>
                            <th>{t("email")}</th>
                            <th>{t("role")}</th>
                            <th>{t("status")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.members.map((m) => (
                            <tr key={m.id}>
                              <td>{m.user.name}</td>
                              <td dir="ltr">{m.user.email}</td>
                              <td>
                                {(
                                  {
                                    OWNER: t("owner"),
                                    MANAGER: t("manager"),
                                    SUPERVISOR: t("supervisor"),
                                    CASHIER: t("cashier"),
                                    WORKER: t("worker"),
                                    CUSTOMER: t("customer"),
                                  } as Record<string, string>
                                )[m.role] ??
                                  (m.role.startsWith("STAFF-")
                                    ? t("employee")
                                    : m.role)}
                              </td>
                              <td>
                                <Badge
                                  value={m.active ? "ACTIVE" : "SUSPENDED"}
                                  label={state(
                                    m.active ? "ACTIVE" : "SUSPENDED",
                                  )}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
              {tab==='accounts'&&canPlatform('platform.manage_users')&&<AccountAdmin/>}
              {tab === "team" && data && (
                <div className="panel spaced">
                  <div className="section-title">
                    <h2>{t("permissions")}</h2>
                    {has("tenant.manage_roles") && (
                      <button className="button outline" onClick={roleForm}>
                        {t("newRole")}
                      </button>
                    )}
                  </div>
                  {data.customRoles.map((role) => (
                    <p className="muted" key={role.id}>
                      {role.name} · {role.permissions.length} {t("permissions")}
                    </p>
                  ))}
                  {data.members
                    .filter(
                      (member) =>
                        member.role !== "OWNER" &&
                        member.user.id !== me?.user.id,
                    )
                    .map((member) => (
                      <div className="receipt-detail" key={member.id}>
                        <span>{member.user.name}</span>
                        <button
                          className="text-button"
                          onClick={() =>
                            editMember(member.id, member.role, member.active)
                          }
                        >
                          {t("editMember")}
                        </button>
                      </div>
                    ))}
                </div>
              )}
              {(tab === "cameraIp"||(data?.role==='OWNER'&&tab==='branches'&&has('tenant.manage_cameras'))) && data && <><CameraRegistry orgId={orgId} data={data} onRefresh={refresh}/>{has('wash.view_sessions')&&<CameraVisitsPanel orgId={orgId} canReview={has('wash.complete_session')} services={data.services}/>}</>}
              {(tab === "washCustomers"||(data?.role==='OWNER'&&tab==='team'&&has('tenant.manage_customers'))) && data && <CustomerPanel orgId={orgId} data={data} onRefresh={refresh}/>}
              {tab === "reports" && data && (
                <>
                  <PlatformWashReports orgId={orgId}/>
                  {dateControl}
                  <div className="stat-grid">
                    {stats.map(({ label, value }, i) => (
                      <article className={`stat-card stat-${i}`} key={label}>
                        <div>
                          <span>{label}</span>
                        </div>
                        <strong>{value}</strong>
                      </article>
                    ))}
                  </div>
                  {has("finance.view_revenue") && (
                    <div className="revenue-banner">
                      <span>{t(statsDate?"statsRevenueDay":"revenue")}</span>
                      <strong>
                        {selectedDay?money(selectedDay.revenue??'0'):'…'}
                      </strong>
                    </div>
                  )}
                  <div className="panel">
                    <div className="section-title">
                      <h2>{t("services")}</h2>
                      <span className="muted">{t("sessions")}</span>
                    </div>
                    {data.services.map((s) => {
                      const count = selectedDay?.serviceCounts.find(row=>row.serviceId===s.id)?.count??0;
                      return (
                        <div className="report-bar" key={s.id}>
                          <span>{locale === "ar" ? s.nameAr : s.nameEn}</span>
                          <div>
                            <span
                              style={{
                                width: `${selectedDay?.sessions ? (count / selectedDay.sessions) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <b>{count}</b>
                        </div>
                      );
                    })}
                    {!data.washes.length && <StateEmpty title={t("empty")} />}
                  </div>
                </>
              )}
              {tab === "audit" && (
                <div className="panel">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("event")}</th>
                          <th>{t("details")}</th>
                          <th>{t("date")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(platformData?.auditLogs ?? data?.auditLogs ?? []).map(
                          (log) => (
                            <tr key={log.id}>
                              <td>
                                <code>{log.action}</code>
                              </td>
                              <td>
                                <small>
                                  {log.entityType} · {log.entityId.slice(0, 8)}
                                </small>
                              </td>
                              <td>{date(log.createdAt)}</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {tab === "notifications" && platformData && (
                <div className="panel">
                  {platformData.notifications.map((n) => (
                    <div className="notification-row" key={n.id}>
                      <div>
                        <p>
                          {n.type==='WASH_COMMENT'?t('washComment')+': ':n.type==='OWNER_MESSAGE'?t('ownerMessage')+': ':n.type==='APPLICATION_SUBMITTED'?t('applications')+': ':''}{n.message}
                        </p>
                        <small>{date(n.createdAt)}</small>
                      </div>
                      {!n.readBy.includes(me?.user.id ?? "") && (
                        <button
                          className="text-button"
                          onClick={() =>
                            void run(() =>
                              api(
                                "platform/notifications/" + n.id,
                                "PATCH",
                                {},
                              ),
                            )
                          }
                        >
                          {t("read")}
                        </button>
                      )}
                    </div>
                  ))}
                  {!platformData.notifications.length && (
                    <StateEmpty title={t("empty")} />
                  )}
                </div>
              )}
              {tab === "notifications" && data && (
                <div className="panel">
                  {data.notifications.map((n) => (
                    <div className="notification-row" key={n.id}>
                      <div>
                        <p>{n.message}</p>
                        <small>{date(n.createdAt)}</small>
                      </div>
                      {!n.readBy.includes(me?.user.id ?? "") && (
                        <button
                          className="text-button"
                          onClick={() =>
                            void run(() =>
                              api(
                                `tenants/${orgId}/notifications/${n.id}`,
                                "PATCH",
                                {},
                              ),
                            )
                          }
                        >
                          {t("read")}
                        </button>
                      )}
                    </div>
                  ))}
                  {!data.notifications.length && (
                    <StateEmpty title={t("empty")} />
                  )}
                </div>
              )}
              {tab==='organizationSettingsTab'&&data?.role==='OWNER'&&<details className="panel"><summary>{t('contract')}</summary><ContractGate orgId={orgId} showContract><span/></ContractGate></details>}
              {tab === "organizationSettingsTab" && (has("tenant.manage_profile")||manageServices()) && data && <div className="panel"><button className="button primary" onClick={settingsForm}>{t("organizationSettings")}</button><form className="management-notice-form" onSubmit={event=>{event.preventDefault();const message=String(new FormData(event.currentTarget).get('message')??'');void run(()=>api(`tenants/${orgId}/notice`,'PATCH',{message}));}}><label className="field">{t('customerNotice')}<input name="message" maxLength={240} defaultValue={data.org.publicNotice} placeholder={t('customerNoticePlaceholder')}/></label><button className="button outline" disabled={busy}>{t('save')}</button></form></div>}
              {(tab === "contactPlatform"||tab==='organizationSettingsTab') && data?.role==='OWNER' && <div className="panel"><h2>{t('contactPlatform')}</h2><form className="form-fields" onSubmit={event=>{event.preventDefault();const form=event.currentTarget;const message=String(new FormData(form).get('message')??'');void run(async()=>{await api(`tenants/${orgId}/owner-message`,'POST',{message});form.reset();window.alert(t('messageSent'));});}}><label className="field">{t('ownerMessageBody')}<textarea name="message" minLength={2} maxLength={1000} required rows={5}/></label><button className="button primary" disabled={busy}>{t('sendOwnerMessage')}</button></form></div>}

            </>
          )}
        </ContractGate></main>
        <footer className="workspace-footer">
          <Logo variant="pink" />
        </footer>
      </div>
      {modal && (
        <FormDialog
          modal={modal}
          onClose={() => setModal(null)}
          onSuccess={() => {
            void refresh();
            setToast({ text: t("success"), error: false });
          }}
          onError={showError}
        />
      )}{" "}
      {digitalReceipt && (
        <ReceiptDialog
          record={digitalReceipt}
          onClose={() => setDigitalReceipt(null)}
        />
      )}{" "}
      {invitation && (
        <InvitationDialog link={invitation} onClose={() => setInvitation("")} />
      )}{" "}
      {toastView}
    </div>
  );
}






