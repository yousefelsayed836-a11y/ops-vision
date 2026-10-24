import { betterAuth } from "better-auth";
import {emailOTP} from "better-auth/plugins";
import {sendEmail} from "./email-delivery";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { seal } from "./crypto";
export const auth = betterAuth({
  appName: "OpsVision",
  plugins:[emailOTP({disableSignUp:true,otpLength:6,expiresIn:600,allowedAttempts:5,storeOTP:'hashed',overrideDefaultEmailVerification:true,sendVerificationOTP:async({email,otp})=>{await sendEmail(email,'OpsVision — كود تأكيد البريد الإلكتروني','كود تأكيد بريدك هو: '+otp+'\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.');}})],
  emailVerification:{sendOnSignIn:true},
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
  secret: process.env.BETTER_AUTH_SECRET,
  verification: { storeIdentifier: "hashed" },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, token }) => {
      const member = await db.membership.findFirst({
        where: { userId: user.id, active: true },
      });
      await db.outbox.create({
        data: {
          orgId: member?.orgId,
          kind: "PASSWORD_RESET",
          recipient: user.email,
          encryptedPayload: seal({
            token,
            activationPath: "/ar/activate#reset=",
          }),
        },
      });
    },
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
          await db.notification.create({data:{recipientId:user.id,type:'LOGIN',permission:'',message:'تم تسجيل دخول جديد إلى حسابك في OpsVision في '+new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date())+'.'}});
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
