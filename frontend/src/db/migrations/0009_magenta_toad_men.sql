ALTER TABLE "recordings" ALTER COLUMN "status" SET DEFAULT 'created';--> statement-breakpoint
ALTER TABLE "public"."recordings" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."recordingstatus";--> statement-breakpoint
CREATE TYPE "public"."recordingstatus" AS ENUM('created', 'active', 'processing', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "public"."recordings" ALTER COLUMN "status" SET DATA TYPE "public"."recordingstatus" USING "status"::"public"."recordingstatus";