CREATE TYPE "public"."recording_status" AS ENUM('created', 'active', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "guest_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"token" text NOT NULL,
	"guest_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"uses_remaining" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "guest_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "recording_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"participant_id" text NOT NULL,
	"participant_name" text,
	"chunk_index" integer NOT NULL,
	"filename" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"media_type" text NOT NULL,
	"codec" text,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recording_started_at" timestamp with time zone NOT NULL,
	"recording_ended_at" timestamp with time zone NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processing_error" text
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" text NOT NULL,
	"host_user_id" text NOT NULL,
	"title" text,
	"description" text,
	"status" "recording_status" DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"video_url" text,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"processing_error" text,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"max_participants" integer DEFAULT 10 NOT NULL,
	CONSTRAINT "recordings_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
DROP TABLE "participants" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "guest_tokens" ADD CONSTRAINT "guest_tokens_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_chunks" ADD CONSTRAINT "recording_chunks_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;