ALTER TABLE "participants" ALTER COLUMN "display_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "status" SET DEFAULT 'invited';--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "joined_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "joined_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;