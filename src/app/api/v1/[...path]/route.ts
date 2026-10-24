import {listCameraVisits,reviewCameraVisit} from '@/lib/camera-visits';
import {listWashCustomers,quickCustomer} from "@/lib/wash-customers";
import {quickWash} from "@/lib/quick-wash";
import {operationsOnly,videoAnalysisEnabled} from "@/lib/features";
import {dailyStatistics} from "@/lib/statistics";
import {createBay,updateBay,saveCameraIp,registerCameraIp,saveCameraBayMappings,saveCameraCalibration,removeCameraIp,platformBayScope} from "@/lib/bay-management";
import {platformBays,platformStart,platformWashTransition,platformAdjustWashMinutes,platformWashExtraService} from "@/lib/platform-operations";
import {adjustWashMinutes,addWashExtraService,removeWashExtraService,sendWashComment,setWashDiscount,sendOwnerMessage} from '@/lib/wash-extras';
import {listAccounts,updateAccountCredentials} from '@/lib/account-admin';
import {savePublicNotice} from "@/lib/public-notice";
import {tenantWashReport} from "@/lib/platform-reports";
import {platformWashReportPrisma} from "@/lib/platform-report-prisma";
import {reportPdf} from "@/lib/report-pdf";
import {publicPushKey,savePushSubscription,removePushSubscription} from '@/lib/push-notifications';
import {issueTracking,trackingLogin,trackingStatus} from "@/lib/customer-tracking";
import {publicWashBays,publicBayStatus} from "@/lib/public-bay-tracking";
import {
  invitePlatformStaff,
  activatePlatformStaff,
  updatePlatformStaff,
  platformStaff,
  grantedPlatformPermissions,
} from "@/lib/platform-staff";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentActor, platform, tenant, branchScope } from "@/lib/access";
import { assert } from "@/lib/errors";
import {
  guardMutation,
  response,
  errorResponse,
  rateLimit,
  readJson,
} from "@/lib/http";
import {
  registerApplication,
  createOrganizationWithOwner,
  reviewApplication,
  activate,
  acceptInvitation,
  inviteMember,
  requestReset,
  resetPassword,
} from "@/lib/onboarding";
import {
  branchInput,
  serviceInput,
  cameraInput,
  ruleInput,
  email,
  text,
} from "@/lib/validation";
import {
  createVehicle,
  createWash,
  transitionWash,
  assignWorker,
  recordCashPayment,
  times,
} from "@/lib/operations";
import { simulate, reviewObservation, processEvent } from "@/lib/automation";
import { audit, transaction } from "@/lib/transactions";
import { canDelegate, roles } from "@/lib/permissions";
import { feedback, receipt } from "@/lib/customer";
import {queueVideo, listVideos, getVideo, reviewVideo, videoFile, readVideoUpload} from "@/lib/video-analysis";
import {addVehicleCategory,catalogManager,categoryExists,saveServicePrices,removeService,removeVehicleCategory} from "@/lib/catalog-management";

type Context = { params: Promise<{ path: string[] }> };
async function handle(req: Request, context: Context) {
  try {
    const path = (await context.params).path;
    if(operationsOnly&&path[0]==='tenants'&&['rules','simulation','automation-process','observations'].includes(path[2]))return response({error:'FEATURE_REMOVED'},410);
    if(!videoAnalysisEnabled&&path[0]==='tenants'&&path[2]==='videos')return response({error:'FEATURE_REMOVED'},410);
    if(path[0]==="tenants" && z.uuid().safeParse(path[1]).success && path[2]==="videos" && path.length===3 && req.method==="POST"){
      const actor=await currentActor();const scope=await tenant(actor,path[1],"video.analyze");
      await rateLimit("video-upload",actor.id,10,3600);
      const upload=await readVideoUpload(req);return response(await queueVideo(scope,upload.config,upload.name,upload.bytes),202);
    }
    guardMutation(req);
    const method = req.method;
    const body = () => readJson(req);
    if(path[0]==='public-wash'&&method==='GET'&&path.length===2)return response(await publicWashBays(path[1]));
    if(path[0]==='public-wash'&&method==='GET'&&path.length===4&&path[2]==='bays'&&z.uuid().safeParse(path[3]).success)return response(await publicBayStatus(path[1],path[3]));
    if (path.join("/") === "applications" && method === "POST") {
      const data = await body();
      await rateLimit("applications", "global", 100, 3600);
      await rateLimit(
        "application",
        typeof data.email === "string" ? data.email.toLowerCase() : "invalid",
        3,
        3600,
      );
      return response(await registerApplication(data), 201);
    }
    if (path.join("/") === "activate" && method === "POST") {
      await rateLimit("activation", "global", 100, 60);
      const data = await body();
      return response(
        await (typeof data.token === "string" && data.token.startsWith("p_")
          ? activatePlatformStaff(data)
          : activate(data)),
      );
    }
    if (path.join("/") === "reset-password" && method === "POST") {
      await rateLimit("password-reset", "global", 50, 60);
      return response(await resetPassword(await body()));
    }
    if (path.join("/") === "forgot-password" && method === "POST") {
      const data = await body();
      const recipient = email.parse(data.email);
      await rateLimit("reset", "global", 100, 3600);
      await rateLimit("reset-email", recipient, 3, 3600);
      return response(await requestReset({ email: recipient }));
    }
    if(path[0]==="tracking"&&z.uuid().safeParse(path[1]).success){
      const id=path[1],cookieName=`opsvision.track.${id}`;
      if(method==="POST"&&path[2]==="login"){
        await rateLimit("tracking-login",id,8,300);const secret=await trackingLogin(id,await body());
        const result=response({authenticated:true});result.cookies.set(cookieName,secret,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:`/api/v1/tracking/${id}`,maxAge:86400});return result;
      }
      if(method==="GET"&&path.length===2){const value=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';return response(await trackingStatus(id,value));}
      return response({error:'NOT_FOUND'},404);
    }
    const actor = await currentActor();
    if(path[0]==='push-key'&&method==='GET'&&path.length===1)return response(publicPushKey());
    if(path[0]==='push-subscription'&&path.length===1&&method==='POST'){await rateLimit('push-subscription',actor.id,10,3600);return response(await savePushSubscription(actor,await body()),201);}
    if(path[0]==='push-subscription'&&path.length===1&&method==='DELETE')return response(await removePushSubscription(actor,await body()));
    if(path[0]==='push-test'&&path.length===1&&method==='POST'){const {sendTestPush}=await import('@/lib/push-notifications');return response(await sendTestPush(actor));}
    if(path[0]==='report-pdf'&&method==='GET'&&path.length===1){const url=new URL(req.url);const file=await reportPdf(actor,{from:url.searchParams.get('from'),to:url.searchParams.get('to'),orgId:url.searchParams.get('orgId')||undefined});return new Response(new Uint8Array(file),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="opsvision-wash-report.pdf"','Cache-Control':'no-store'}});}
    if (path.join("/") === "me" && method === "GET") {
      const user = await db.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: {
          id: true,
          name: true,
          email: true,
          platformRole: true,
          platformPermissions: true,
        },
      });
      const memberships = await db.membership.findMany({
        where: { userId: actor.id, active: true, org: { status: "ACTIVE" } },
        include: { org: { select: { id: true, name: true, isDemo: true } } },
      });
      return response({ user, memberships });
    }
    if (path.join("/") === "accept-invitation" && method === "POST") {
      const data = z
        .object({ token: z.string().min(32).max(128) })
        .parse(await body());
      return response(await acceptInvitation(actor, data.token));
    }
    if (path[0] === "platform") {
      assert(
        ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(actor.platformRole),
        "FORBIDDEN",
        403,
      );
      const granted = grantedPlatformPermissions(actor);
      if(path[1]==='washes'&&path[3]==='transition'&&method==='POST')return response(await platformWashTransition(actor,z.uuid().parse(path[2]),await body()));
      if(path[1]==='washes'&&path[3]==='time'&&method==='POST')return response(await platformAdjustWashMinutes(actor,z.uuid().parse(path[2]),await body()));
      if(path[1]==='washes'&&path[3]==='extra-services'&&method==='POST')return response(await platformWashExtraService(actor,z.uuid().parse(path[2]),await body()),201);
      if(path[1]==='washes'&&path[3]==='extra-services'&&path[4]&&method==='DELETE')return response(await platformWashExtraService(actor,z.uuid().parse(path[2]),await body(),z.uuid().parse(path[4])));
      if(path[1]==='accounts'&&path.length===2&&method==='GET')return response(await listAccounts(actor));
      if(path[1]==='accounts'&&path[3]==='credentials'&&method==='PATCH')return response(await updateAccountCredentials(actor,z.uuid().parse(path[2]),await body()));
      if(path[1]==='bays'&&method==='POST'){const raw=await body();return response(await createBay(await platformBayScope(actor,z.uuid().parse(raw.orgId),'platform.manage_bays'),raw),201);}
      if(path[1]==='bays'&&method==='PATCH'){const raw=await body();return response(await updateBay(await platformBayScope(actor,z.uuid().parse(raw.orgId),'platform.manage_bays'),z.uuid().parse(path[2]),raw));}
      if(path[1]==='camera-ip'&&method==='POST'){const raw=await body();return response(await saveCameraIp(await platformBayScope(actor,z.uuid().parse(raw.orgId),'platform.manage_cameras'),raw));}
      if(path[1]==='bays'&&method==='GET')return response(await platformBays(actor));
      if(path[1]==='wash-report'&&method==='GET')return response(await platformWashReportPrisma(actor,new URL(req.url).searchParams.get('date')||'all'));
      if(path[1]==='organizations'&&path.length===2&&method==='POST')return response(await createOrganizationWithOwner(actor,await body()),201);
      if(path[1]==='organizations'&&path[3]==='notice'&&method==='PATCH')return response(await savePublicNotice(actor,z.uuid().parse(path[2]),await body(),true));
      if(path[1]==='start-wash'&&method==='POST')return response(await platformStart(actor,await body()),201);
      if (path[1] === "staff" && method === "POST")
        return response(await invitePlatformStaff(actor, await body()), 201);
      if (path[1] === "staff" && method === "PATCH")
        return response(
          await updatePlatformStaff(
            actor,
            z.uuid().parse(path[2]),
            await body(),
          ),
        );
      if (path.length === 1 && method === "GET") {
        const [applications, organizations, auditLogs, notifications] =
          await Promise.all([
            granted.includes("platform.review_applications")
              ? db.application.findMany({
                  orderBy: { createdAt: "desc" },
                  take: 100,
                  include: { history: { orderBy: { createdAt: "asc" } } },
                })
              : [],
            granted.includes("platform.manage_tenants")
              ? db.organization.findMany({
                  orderBy: { createdAt: "desc" },
                  take: 100,
                  include: {
                    _count: { select: { branches: true, memberships: true, bays: true } },
                  },
                })
              : [],
            granted.includes("platform.view_audit")
              ? db.auditLog.findMany({
                  where: { orgId: null },
                  orderBy: { createdAt: "desc" },
                  take: 30,
                })
              : [],
            granted.includes("platform.review_applications") || granted.includes("platform.manage_tenants")
              ? db.notification.findMany({
                  where: {
                    orgId: null,
                    permission: {in:granted.includes('platform.manage_tenants')?['platform.review_applications','platform.manage_tenants']:['platform.review_applications']},
                  },
                  orderBy: { createdAt: "desc" },
                  take: 50,
                })
              : [],
          ]);
        return response({
          permissions: granted,
          staff: granted.includes("platform.manage_users")
            ? await platformStaff(actor)
            : [],
          applications,
          organizations,
          auditLogs,
          notifications,
        });
      }
      if (path[1] === "notifications" && method === "PATCH") {
        assert(['platform.review_applications','platform.manage_tenants'].some(permission=>granted.includes(permission)),'FORBIDDEN',403);
        const record = await db.notification.findFirst({
          where: {
            id: path[2],
            orgId: null,
            permission: {in:granted.includes('platform.manage_tenants')?['platform.review_applications','platform.manage_tenants']:['platform.review_applications']},
          },
        });
        assert(record, "NOT_FOUND", 404);
        return response(
          await db.notification.update({
            where: { id: record.id },
            data: {
              readBy: { set: [...new Set([...record.readBy, actor.id])] },
            },
          }),
        );
      }
      if (
        path[1] === "applications" &&
        path[3] === "decision" &&
        method === "POST"
      )
        return response(
          await reviewApplication(actor, z.uuid().parse(path[2]), await body()),
        );
      if (path[1] === "organizations" && method === "PATCH") {
        platform(actor, "platform.manage_tenants");
        const data = z
          .object({ status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]) })
          .parse(await body());
        return response(
          await transaction(async (tx) => {
            const org = await tx.organization.update({
              where: { id: z.uuid().parse(path[2]) },
              data,
            });
            await audit(
              tx,
              actor.id,
              "organization.status_changed",
              "organization",
              org.id,
              undefined,
              { status: data.status },
            );
            return org;
          }),
        );
      }
      if (path[1] === "demo" && method === "POST") {
        platform(actor, "platform.manage_tenants");
        assert(
          process.env.ALLOW_SIMULATION === "true",
          "SIMULATION_DISABLED",
          403,
        );
        return response(
          await transaction(async (tx) => {
            const org = await tx.organization.create({
              data: {
                name: "OpsVision Â· Simulation",
                slug: `demo-${crypto.randomUUID().slice(0, 8)}`,
                isDemo: true,
                currency: "SAR",
                memberships: { create: { userId: actor.id, role: "OWNER" } },
              },
            });
            const branch = await tx.branch.create({
              data: { orgId: org.id, name: "Simulation branch", city: "Demo", timezone: "Asia/Riyadh" },
            });
            const bay = await tx.washBay.create({
              data: { orgId: org.id, branchId: branch.id, name: "Demo bay" },
            });
            await tx.camera.create({
              data: {
                orgId: org.id,
                branchId: branch.id,
                bayId: bay.id,
                name: "Simulated camera",
                protocol: "SIMULATED",
                status: "SIMULATED",
              },
            });
            await audit(tx, actor.id, "demo.created", "organization", org.id);
            return org;
          }),
          201,
        );
      }
      return response({ error: "NOT_FOUND" }, 404);
    }
    assert(
      path[0] === "tenants" && z.uuid().safeParse(path[1]).success,
      "NOT_FOUND",
      404,
    );
    const orgId = path[1];
    const resource = path[2];
    if(resource==='owner-message'&&method==='POST'&&path.length===3){await rateLimit('owner-message',actor.id,10,3600);return response(await sendOwnerMessage(await tenant(actor,orgId),await body()),201);}
    if(resource==='wash-report'&&method==='GET')return response(await tenantWashReport(await tenant(actor,orgId,'reports.view'),new URL(req.url).searchParams.get('date')||'all'));
    if(resource==='notice'&&method==='PATCH')return response(await savePublicNotice(actor,orgId,await body()));
    if(resource==='customers'&&method==='GET')return response(await listWashCustomers(await tenant(actor,orgId,'tenant.manage_customers')));
    if(resource==='customers'&&method==='POST')return response(await quickCustomer(await tenant(actor,orgId,'tenant.manage_customers'),await body()),201);
    if(resource==='statistics'&&method==='GET')return response(await dailyStatistics(await tenant(actor,orgId),new URL(req.url).searchParams.get('date')??''));
    if(resource==='camera-ip'&&method==='POST')return response(await saveCameraIp(await tenant(actor,orgId,'tenant.manage_cameras'),await body()));
    if(resource==='camera-register'&&method==='POST')return response(await registerCameraIp(await tenant(actor,orgId,'tenant.manage_cameras'),await body()),201);
    if(resource==='bays'&&method==='PATCH')return response(await updateBay(await tenant(actor,orgId,'tenant.manage_bays'),z.uuid().parse(path[3]),await body()));
    if(resource==='washes'&&path[4]==='tracking'&&method==='POST')return response(await issueTracking(await tenant(actor,orgId,'tenant.manage_customers'),z.uuid().parse(path[3])),201);
    const id = path[3];
    if(resource==="videos"){
      const scope=await tenant(actor,orgId,"video.analyze");
      if(method==="GET" && !id)return response(await listVideos(scope));
      if(method==="GET" && path[4]==="files")return await videoFile(scope,id,path[5],req.headers.get('range'));
      if(method==="GET" && id && path.length===4)return response(await getVideo(scope,id));
      if(method==="POST" && path[4]==="reviews")return response(await reviewVideo(scope,id,await body()),201);
      return response({error:"NOT_FOUND"},404);
    }
    const member = await db.membership.findUnique({
      where: { userId_orgId: { userId: actor.id, orgId } },
    });
    assert(member, "FORBIDDEN", 403);
    const customer = member.role === "CUSTOMER";
    if(resource==='camera-visits'&&method==='GET')return response(await listCameraVisits(await tenant(actor,orgId,'wash.view_sessions')));
    if(resource==='camera-visits'&&id&&method==='POST')return response(await reviewCameraVisit(await tenant(actor,orgId,'wash.complete_session'),id,await body()));
    if (resource === "snapshot" && method === "GET") {
      const scope = await tenant(actor, orgId, undefined);
      const permissions = scope.permissions;
      const branchWhere = {
        orgId,
        ...(scope.branchId ? { id: scope.branchId } : {}),
      };
      const washWhere = {
        orgId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        ...(customer ? { customerUserId: actor.id } : {}),
      };
      const [
        org,
        branches,
        bays,
        services,
        vehicleCategories,
        vehicles,
        washes,
        members,
        cameras,
        rules,
        events,
        observations,
        notifications,
        auditLogs,
        customRoles,
      ] = await Promise.all([
        db.organization.findUnique({
          where: { id: orgId },
          select: {
            id: true,
            name: true,
            slug: true,
            currency: true,
            isDemo: true,
            publicNotice: true,
            cancellationLeadHours: true,
            siteIp: true,
          },
        }),
        db.branch.findMany({ where: branchWhere }),
        db.washBay.findMany({
          where: {
            orgId,
            ...(scope.branchId ? { branchId: scope.branchId } : {}),
          },
        }),
        db.washService.findMany({
          where: { orgId, ...(customer ? { active: true } : {}) },
          include: { pricingRules: true },
        }),
        db.vehicleCategory.findMany({where:{orgId,active:true},select:{code:true,nameAr:true,nameEn:true},orderBy:{createdAt:'asc'}}),
        db.vehicle.findMany({
          where: { orgId, ...(customer ? { customerUserId: actor.id } : {}) },
          take: 200,
        }),
        db.wash.findMany({
          where: washWhere,
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            vehicle: true,
            history: { orderBy: { createdAt: "asc" } },
            workers: true,
            feedback: true,
            extraServices: {orderBy:{createdAt:'asc'}},
          },
        }),
        permissions.includes("tenant.manage_employees")
          ? db.membership.findMany({
              where: {
                orgId,
                ...(scope.branchId ? { branchId: scope.branchId } : {}),
              },
              include: {
                user: {
                  select: { id: true, name: true, email: true, disabled: true },
                },
              },
            })
          : [],
        permissions.includes("tenant.manage_cameras")
          ? db.camera.findMany({
              where: {
                orgId,
                ...(scope.branchId ? { branchId: scope.branchId } : {}),
              },
              select: {
                id: true,
                name: true,
                branchId: true,
                bayId: true,
                protocol: true,
                status: true,
                processingEnabled: true,
                zones: true,
                ipAddress: true,
              },
            })
          : [],
        permissions.includes("tenant.manage_automation")
          ? db.automationRule.findMany({ where: { orgId } })
          : [],
        permissions.includes("tenant.manage_automation")
          ? db.automationEvent.findMany({
              where: { orgId },
              orderBy: { createdAt: "desc" },
              take: 100,
              include: { executions: true },
            })
          : [],
        permissions.includes("tenant.manage_cameras")
          ? db.observation.findMany({
              where: {
                orgId,
                ...(scope.branchId
                  ? { camera: { branchId: scope.branchId } }
                  : {}),
              },
              orderBy: { createdAt: "desc" },
              take: 100,
              include: { reviews: true },
            })
          : [],
        db.notification.findMany({
          where: {
            orgId,
            permission: { in: [...permissions] },
            OR: [{ recipientId: null }, { recipientId: actor.id }],
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        permissions.includes("tenant.manage_roles")
          ? db.auditLog.findMany({
              where: { orgId },
              orderBy: { createdAt: "desc" },
              take: 50,
            })
          : [],
        permissions.includes("tenant.manage_employees")
          ? db.role.findMany({ where: { orgId } })
          : [],
      ]);
      const canReadWashes =
        customer ||
        permissions.some((p) =>
          [
            "wash.view_sessions",
            "reports.view",
            "finance.view_revenue",
          ].includes(p),
        );
      const canReadOperations =
        canReadWashes ||
        permissions.some(
          (p) =>
            p.startsWith("wash.") ||
            [
              "tenant.manage_branches",
              "tenant.manage_bays",
              "video.analyze",
              "tenant.manage_cameras",
              "tenant.manage_employees",
              "tenant.manage_customers",
            ].includes(p),
        );
      const canReadServices =
        customer ||
        permissions.includes("tenant.manage_services") ||
        permissions.includes("wash.manage_services") ||
        permissions.includes("tenant.manage_customers") ||
        permissions.includes("wash.create_session") ||
        permissions.includes("finance.view_revenue");
      const financial =
        permissions.includes("finance.view_revenue") || customer;
      const safeWashes = (canReadWashes ? washes : []).map((w) => ({
        ...w,
        vehicle: { id: w.vehicle.id, category: w.vehicle.category, size: w.vehicle.size },
        price: financial ? w.price : undefined,
        subtotal: financial ? w.subtotal : undefined,
        discount: financial ? w.discount : undefined,
        taxAmount: financial ? w.taxAmount : undefined,
        durations: times(
          w.history,
          ["COMPLETED", "DELIVERED", "CANCELLED"].includes(w.status)
            ? (w.completedAt ?? w.updatedAt)
            : new Date(),
        ),
      }));
      return response({
        org: org
          ? {
              ...org,
              siteIp: permissions.some((p) =>
                ["tenant.manage_profile", "tenant.manage_cameras"].includes(p),
              )
                ? org.siteIp
                : undefined,
            }
          : org,
        permissions,
        role: scope.role,
        branches: canReadOperations ? branches : [],
        bays: canReadOperations ? bays : [],
        services: canReadServices ? services : [],
        vehicleCategories:canReadOperations||canReadServices?vehicleCategories:[],
        vehicles:
          canReadWashes || permissions.includes("wash.create_session")
            ? vehicles.map((vehicle) => ({ id: vehicle.id, category: vehicle.category, size: vehicle.size }))
            : [],
        washes: safeWashes,
        members,
        cameras,
        rules,
        events,
        observations,
        notifications,
        auditLogs,
        customRoles,
      });
    }
    if (resource === "branches" && method === "POST") {
      const scope = await tenant(actor, orgId, "tenant.manage_branches");
      assert(!scope.branchId, "FORBIDDEN", 403);
      const data = branchInput.parse(await body());
      try {
        new Intl.DateTimeFormat("en", { timeZone: data.timezone });
      } catch {
        return response({ error: "INVALID_TIMEZONE" }, 422);
      }
      return response(
        await transaction(async (tx) => {
          const record = await tx.branch.create({ data: { ...data, orgId } });
          await audit(
            tx,
            actor.id,
            "branch.created",
            "branch",
            record.id,
            orgId,
          );
          return record;
        }),
        201,
      );
    }
    if(resource==='cameras'&&path[4]==='calibration'&&method==='POST')return response(await saveCameraCalibration(await tenant(actor,orgId,'tenant.manage_cameras'),path[3],await body()));
    if(resource==='cameras'&&path[4]==='bays'&&method==='PATCH')return response(await saveCameraBayMappings(await tenant(actor,orgId,'tenant.manage_cameras'),path[3],await body()));
    if(resource==='cameras'&&id&&method==='DELETE')return response(await removeCameraIp(await tenant(actor,orgId,'tenant.manage_cameras'),id));
    if (resource === "bays" && method === "POST") {
      return response(await createBay(await tenant(actor, orgId, "tenant.manage_bays"), await body()), 201);
    }
    if(resource==='vehicle-categories'&&method==='POST')return response(await addVehicleCategory(actor,orgId,await body()),201);
    if(resource==='vehicle-categories'&&id&&method==='DELETE')return response(await removeVehicleCategory(actor,orgId,id));
    if(resource==='services'&&id&&path[4]==='prices'&&method==='POST')return response(await saveServicePrices(actor,orgId,id,await body()));
    if (resource === "services" && method === "POST") {
      await catalogManager(actor,orgId);
      const data = serviceInput.parse(await body());
      return response(
        await transaction(async (tx) => {
          assert(await categoryExists(tx,orgId,data.category),'INVALID_CATEGORY',422);
          const record = await tx.washService.create({
            data: { ...data, orgId },
          });
          await audit(
            tx,
            actor.id,
            "service.created",
            "service",
            record.id,
            orgId,
          );
          return record;
        }),
        201,
      );
    }
    if (resource === "services" && id && method === "DELETE") return response(await removeService(actor,orgId,id));
    if (resource === "services" && method === "PATCH") {
      await catalogManager(actor,orgId);
      const data = serviceInput.partial().parse(await body());
      assert(
        await db.washService.findFirst({ where: { id, orgId } }),
        "NOT_FOUND",
        404,
      );
      return response(
        await transaction(async (tx) => {
          if(data.category)assert(await categoryExists(tx,orgId,data.category),'INVALID_CATEGORY',422);
          const record = await tx.washService.update({ where: { id }, data });
          await audit(tx, actor.id, "service.updated", "service", id, orgId);
          return record;
        }),
      );
    }
    if (resource === "pricing-rules" && method === "POST") {
      await catalogManager(actor,orgId);
      const data = z
        .object({
          serviceId: z.uuid(),
          category: z.string().min(2).max(30),
          size: z.enum(["ALL", "SMALL", "MEDIUM", "LARGE", "XLARGE"]),
          price: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
        })
        .parse(await body());
      assert(
        await db.washService.findFirst({
          where: { id: data.serviceId, orgId },
        }),
        "NOT_FOUND",
        404,
      );
      return response(
        await transaction(async (tx) => {
          assert(await categoryExists(tx,orgId,data.category),'INVALID_CATEGORY',422);
          const rule = await tx.servicePricingRule.upsert({
            where: {
              serviceId_category_size: {
                serviceId: data.serviceId,
                category: data.category,
                size: data.size,
              },
            },
            create: { ...data, orgId },
            update: { price: data.price },
          });
          await audit(
            tx,
            actor.id,
            "service.pricing_rule_saved",
            "pricing_rule",
            rule.id,
            orgId,
          );
          return rule;
        }),
        201,
      );
    }
    if(resource==='wash-entry'&&method==='POST')return response(await quickWash(await tenant(actor,orgId,customer?'customers.self':'wash.create_session'),await body()),201);
    if (resource === "vehicles" && method === "POST") {
      const scope = await tenant(
        actor,
        orgId,
        customer ? "customers.self" : "wash.create_session",
      );
      const vehicle = await createVehicle(scope, await body());
      return response({ id: vehicle.id, category: vehicle.category, size: vehicle.size }, 201);
    }
    if (resource === "washes" && method === "POST" && !id) {
      const scope = await tenant(actor, orgId, "wash.create_session");
      return response(await createWash(scope, await body()), 201);
    }
    if(resource==='washes'&&id&&path[4]==='time'&&method==='POST')return response(await adjustWashMinutes(await tenant(actor,orgId,'wash.start_session'),z.uuid().parse(id),await body()));
    if(resource==='washes'&&id&&path[4]==='extra-services'&&method==='POST')return response(await addWashExtraService(await tenant(actor,orgId),z.uuid().parse(id),await body()),201);
    if(resource==='washes'&&id&&path[4]==='extra-services'&&path[5]&&method==='DELETE')return response(await removeWashExtraService(await tenant(actor,orgId),z.uuid().parse(id),z.uuid().parse(path[5])));
    if(resource==='washes'&&id&&path[4]==='discount'&&method==='POST')return response(await setWashDiscount(await tenant(actor,orgId,'finance.manage_payments'),z.uuid().parse(id),await body()));
    if(resource==='washes'&&id&&path[4]==='comments'&&method==='POST')return response(await sendWashComment(await tenant(actor,orgId,'wash.view_sessions'),z.uuid().parse(id),await body()),201);
    if (resource === "bookings" && method === "POST") {
      const scope = await tenant(
        actor,
        orgId,
        customer ? "customers.self" : "wash.create_session",
      );
      const data = await body();
      assert(data.bookedFor, "BOOKING_TIME_REQUIRED");
      return response(await createWash(scope, data), 201);
    }
    if (
      resource === "washes" &&
      id &&
      path[4] === "cancel-booking" &&
      method === "POST"
    ) {
      const scope = await tenant(actor, orgId, "customers.self");
      const data = z
        .object({ version: z.number().int().min(0) })
        .parse(await body());
      assert(scope.role === "CUSTOMER", "FORBIDDEN", 403);
      return response(
        await transitionWash(scope, id, "CANCELLED", data.version),
      );
    }
    if (
      resource === "washes" &&
      id &&
      path[4] === "feedback" &&
      method === "POST"
    ) {
      const scope = await tenant(actor, orgId, "customers.self");
      return response(await feedback(scope, id, await body()), 201);
    }
    if (
      resource === "washes" &&
      id &&
      path[4] === "receipt" &&
      method === "GET"
    ) {
      const scope = await tenant(
        actor,
        orgId,
        customer ? "customers.self" : "finance.view_revenue",
      );
      return response(await receipt(scope, id));
    }
    if (
      resource === "washes" &&
      id &&
      path[4] === "transition" &&
      method === "POST"
    ) {
      const scope = await tenant(actor, orgId, "wash.view_sessions");
      const data = z
        .object({
          to: z.string().max(30),
          version: z.number().int().min(0),
          bayId: z.uuid().optional(),
        })
        .parse(await body());
      return response(
        await transitionWash(scope, id, data.to, data.version, data.bayId),
      );
    }
    if (
      resource === "washes" &&
      id &&
      path[4] === "workers" &&
      method === "POST"
    ) {
      const scope = await tenant(actor, orgId, "wash.assign_workers");
      const data = z
        .object({ userId: z.string().max(100) })
        .parse(await body());
      return response(await assignWorker(scope, id, data.userId), 201);
    }
    if (
      resource === "washes" &&
      id &&
      path[4] === "cash-payment" &&
      method === "POST"
    ) {
      const scope = await tenant(actor, orgId, "finance.manage_payments");
      const data = z
        .object({ reference: z.string().trim().min(4).max(100) })
        .parse(await body());
      return response(await recordCashPayment(scope, id, data.reference), 201);
    }
    if (resource === "invitations" && method === "POST") {
      const scope = await tenant(actor, orgId, "tenant.manage_employees");
      return response(await inviteMember(scope, await body()), 201);
    }
    if (resource === "invitations" && method === "DELETE") {
      const scope = await tenant(actor, orgId, "tenant.manage_employees");
      return response(
        await transaction(async (tx) => {
          const changed = await tx.invitation.updateMany({
            where: {
              id,
              orgId,
              usedAt: null,
              ...(scope.branchId ? { branchId: scope.branchId } : {}),
            },
            data: { revokedAt: new Date() },
          });
          assert(changed.count === 1, "NOT_FOUND", 404);
          await audit(
            tx,
            actor.id,
            "invitation.revoked",
            "invitation",
            id,
            orgId,
          );
          return { revoked: true };
        }),
      );
    }
    if (resource === "roles" && method === "POST") {
      const scope = await tenant(actor, orgId, "tenant.manage_roles");
      assert(scope.role === "OWNER", "FORBIDDEN", 403);
      const data = z
        .object({ name: text, permissions: z.array(z.string()).max(50) })
        .parse(await body());
      assert(
        !roles[data.name] && canDelegate(scope.permissions, data.permissions),
        "PRIVILEGE_ESCALATION",
        403,
      );
      return response(
        await transaction(async (tx) => {
          const role = await tx.role.create({ data: { ...data, orgId } });
          await audit(tx, actor.id, "role.created", "role", role.id, orgId, {
            permissions: data.permissions,
          });
          return role;
        }),
        201,
      );
    }
    if (resource === "members" && method === "PATCH") {
      const scope = await tenant(actor, orgId, "tenant.manage_employees");
      const data = z
        .object({
          role: z.string().min(2).max(60).optional(),
          permissions: z.array(z.string()).max(50).optional(),
          active: z.boolean(),
        })
        .parse(await body());
      assert(["OWNER", "MANAGER"].includes(scope.role), "FORBIDDEN", 403);
      return response(
        await transaction(async (tx) => {
          const member = await tx.membership.findFirst({
            where: { id, orgId },
          });
          assert(member, "NOT_FOUND", 404);
          assert(
            member.role !== "OWNER" &&
              member.userId !== actor.id &&
              data.role !== "OWNER",
            "PRIVILEGE_ESCALATION",
            403,
          );
          const custom = await tx.role.findUnique({
            where: { orgId_name: { orgId, name: data.role ?? "" } },
          });
          const requested =
            data.permissions ?? custom?.permissions ?? roles[data.role ?? ""];
          assert(
            requested && canDelegate(scope.permissions, requested),
            "PRIVILEGE_ESCALATION",
            403,
          );
          if (scope.branchId)
            assert(member.branchId === scope.branchId, "FORBIDDEN", 403);
          const role =
            data.permissions !== undefined
              ? `STAFF-${crypto.randomUUID()}`
              : data.role!;
          if (data.permissions !== undefined)
            await tx.role.create({
              data: { orgId, name: role, permissions: data.permissions },
            });
          await tx.membership.update({
            where: { id },
            data: { role, active: data.active },
          });
          await tx.session.deleteMany({ where: { userId: member.userId } });
          await audit(
            tx,
            actor.id,
            "membership.updated",
            "membership",
            id,
            orgId,
            { role: data.role, active: data.active },
          );
          return { updated: true };
        }),
      );
    }
    if (resource === "organization-settings" && method === "PATCH") {
      await tenant(actor, orgId, "tenant.manage_profile");
      const data = z
        .object({
          name: text,
          currency: z.enum(["SAR", "EGP", "AED", "KWD"]),
          cancellationLeadHours: z.number().int().min(0).max(72),
          siteIp: z
            .union([z.ipv4(), z.ipv6(), z.literal("")])
            .optional()
            .transform((value) => value || null),
        })
        .parse(await body());
      return response(
        await transaction(async (tx) => {
          const org = await tx.organization.update({
            where: { id: orgId },
            data,
          });
          await audit(
            tx,
            actor.id,
            "organization.settings_updated",
            "organization",
            orgId,
            orgId,
          );
          return { id: org.id };
        }),
      );
    }
    if (resource === "cameras" && method === "POST") {
      const scope = await tenant(actor, orgId, "tenant.manage_cameras");
      const data = cameraInput.parse(await body());
      branchScope(scope, data.branchId);
      assert(
        data.protocol !== "SIMULATED" || scope.isDemo,
        "SIMULATION_REQUIRES_DEMO",
        403,
      );
      assert(
        await db.branch.findFirst({ where: { id: data.branchId, orgId } }),
        "NOT_FOUND",
        404,
      );
      if (data.bayId)
        assert(
          await db.washBay.findFirst({
            where: { id: data.bayId, orgId, branchId: data.branchId },
          }),
          "NOT_FOUND",
          404,
        );
      return response(
        await transaction(async (tx) => {
          const camera = await tx.camera.create({
            data: {
              ...data,
              orgId,
              status:
                data.protocol === "SIMULATED" ? "SIMULATED" : "UNCONFIGURED",
            },
          });
          await audit(
            tx,
            actor.id,
            "camera.registered",
            "camera",
            camera.id,
            orgId,
          );
          return { id: camera.id, status: camera.status };
        }),
        201,
      );
    }
    if (resource === "rules" && method === "POST") {
      await tenant(actor, orgId, "tenant.manage_automation");
      const data = ruleInput.parse(await body());
      return response(
        await transaction(async (tx) => {
          const rule = await tx.automationRule.create({
            data: { ...data, orgId },
          });
          await audit(
            tx,
            actor.id,
            "automation.rule_created",
            "rule",
            rule.id,
            orgId,
          );
          return rule;
        }),
        201,
      );
    }
    if (resource === "rules" && method === "PATCH") {
      await tenant(actor, orgId, "tenant.manage_automation");
      const data = z.object({ enabled: z.boolean() }).parse(await body());
      return response(
        await transaction(async (tx) => {
          const result = await tx.automationRule.updateMany({
            where: { id, orgId },
            data,
          });
          assert(result.count === 1, "NOT_FOUND", 404);
          await audit(
            tx,
            actor.id,
            "automation.rule_toggled",
            "rule",
            id,
            orgId,
          );
          return { updated: true };
        }),
      );
    }
    if (resource === "simulation" && method === "POST") {
      const scope = await tenant(actor, orgId, "tenant.manage_automation");
      return response(await simulate(scope, await body()), 201);
    }
    if (resource === "automation-process" && method === "POST") {
      await tenant(actor, orgId, "tenant.manage_automation");
      const pending = await db.automationEvent.findMany({
        where: {
          orgId,
          status: { in: ["PENDING", "RETRY"] },
          nextAttemptAt: { lte: new Date() },
        },
        take: 20,
      });
      for (const event of pending) await processEvent(event.id);
      return response({ checked: pending.length });
    }
    if (resource === "observations" && method === "POST") {
      const scope = await tenant(actor, orgId, "tenant.manage_cameras");
      const data = z
        .object({
          decision: z.enum(["CONFIRMED", "REJECTED"]),
          note: z.string().min(3).max(1000),
        })
        .parse(await body());
      return response(
        await reviewObservation(scope, id, data.decision, data.note),
      );
    }
    if (resource === "notifications" && method === "PATCH") {
      const scope = await tenant(
        actor,
        orgId,
        customer ? "customers.self" : "wash.view_sessions",
      );
      const notification = await db.notification.findFirst({
        where: {
          id,
          orgId,
          permission: { in: [...scope.permissions] },
          OR: [{ recipientId: null }, { recipientId: actor.id }],
        },
      });
      assert(notification, "NOT_FOUND", 404);
      return response(
        await db.notification.update({
          where: { id },
          data: {
            readBy: { set: [...new Set([...notification.readBy, actor.id])] },
          },
        }),
      );
    }
    return response({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;

