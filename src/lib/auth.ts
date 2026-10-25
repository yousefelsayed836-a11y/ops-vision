import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
export const auth = betterAuth({
  appName: "OpsVision",
  disabledPaths:['/change-password','/set-password','/request-password-reset','/reset-password','/forget-password'],
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
  secret: process.env.BETTER_AUTH_SECRET,
  verification: { storeIdentifier: "hashed" },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,

  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 30,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "AuthRateLimit",
    window: 60,
    max: 30,
  },
  advanced: { useSecureCookies: process.env.APP_ENV === "production" },
  user: {
    additionalFields: {
      platformRole: { type: "string", defaultValue: "NONE", input: false },
      disabled: { type: "boolean", defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async(session)=>{
          const user=await db.user.findUnique({where:{id:session.userId}});if(!user)return;
          try{await db.notification.create({data:{recipientId:user.id,type:'LOGIN',permission:'',message:'تم تسجيل دخول جديد إلى حسابك في OpsVision في '+new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date())+'.'}});}catch(error){console.error('Login notification failed',error instanceof Error?error.message:'unknown');}
        },
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
          });
          if (user?.disabled) return false;
          return { data: session };
        },
      },
    },
  },
});
