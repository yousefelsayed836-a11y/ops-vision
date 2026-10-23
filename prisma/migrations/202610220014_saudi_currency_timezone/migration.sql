ALTER TABLE "Organization" ALTER COLUMN "currency" SET DEFAULT 'SAR';
ALTER TABLE "Branch" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Riyadh';

UPDATE "Organization" SET "currency" = 'SAR' WHERE "currency" <> 'SAR';
UPDATE "Branch" SET "timezone" = 'Asia/Riyadh' WHERE "timezone" <> 'Asia/Riyadh';
