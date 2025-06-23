ALTER TYPE "public"."recording_status" RENAME TO "recordingstatus";--> statement-breakpoint
ALTER TABLE "recordings" ALTER COLUMN "status" SET DEFAULT 'CREATED';--> statement-breakpoint
ALTER TABLE "public"."recordings" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."recordingstatus";--> statement-breakpoint
CREATE TYPE "public"."recordingstatus" AS ENUM('CREATED', 'ACTIVE', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
ALTER TABLE "public"."recordings" ALTER COLUMN "status" SET DATA TYPE "public"."recordingstatus" USING "status"::"public"."recordingstatus";