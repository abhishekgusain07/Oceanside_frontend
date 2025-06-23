import { pgTable, text, integer, timestamp, boolean, uuid, pgEnum } from "drizzle-orm/pg-core";
			
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	subscription: text("subscription"),
	updatedAt: timestamp('updated_at').notNull(),
	onboardingCompleted: boolean('onboarding_completed').notNull().default(false)
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' })
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});




export const subscriptions = pgTable("subscriptions", {
	id: text("id").primaryKey(),
	createdTime: timestamp("created_time").defaultNow(),
	subscriptionId: text("subscription_id"),
	stripeUserId: text("stripe_user_id"),
	status: text("status"),
	startDate: text("start_date"),
	endDate: text("end_date"),
	planId: text("plan_id"),
	defaultPaymentMethodId: text("default_payment_method_id"),
	email: text("email"),
	userId: text("user_id"),
  });
  
  export const subscriptionPlans = pgTable("subscriptions_plans", {
	id: text("id").primaryKey(),
	createdTime: timestamp("created_time").defaultNow(),
	planId: text("plan_id"),
	name: text("name"),
	description: text("description"),
	amount: text("amount"),
	currency: text("currency"),
	interval: text("interval"),
  });
  
  export const invoices = pgTable("invoices", {
	id: text("id").primaryKey(),
	createdTime: timestamp("created_time").defaultNow(),
	invoiceId: text("invoice_id"),
	subscriptionId: text("subscription_id"),
	amountPaid: text("amount_paid"),
	amountDue: text("amount_due"),
	currency: text("currency"),
	status: text("status"),
	email: text("email"),
	userId: text("user_id"),
  });


export const feedback = pgTable("feedback", {
	id: text("id").primaryKey(),
	createdTime: timestamp("created_time").defaultNow(),
	userId: text("user_id"),
	feedbackContent: text("feedback_content"),
	stars: integer().notNull()
});

// from here onwards are the tables of new Socket.IO + Celery architecture, upwards are of authentication related dont mess with them, 

// Recording Status Enum - matches backend RecordingStatus exactly (lowercase values)
export const recordingStatusEnum = pgEnum('recordingstatus', ['created', 'active', 'processing', 'completed', 'failed']);

// Recording Table - matches backend Recording model exactly
export const recordings = pgTable("recordings", {
	id: uuid("id").primaryKey().defaultRandom(),
	room_id: text("room_id").notNull().unique(),
	
	// User who created the recording
	host_user_id: text("host_user_id").notNull(),
	
	// Recording metadata
	title: text("title"),
	description: text("description"),
	
	// Status tracking
	status: recordingStatusEnum("status").notNull().default('created'),
	
	// Timestamps
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	started_at: timestamp("started_at", { withTimezone: true }),
	ended_at: timestamp("ended_at", { withTimezone: true }),
	processed_at: timestamp("processed_at", { withTimezone: true }),
	
	// Video processing results
	video_url: text("video_url"), // Final processed video URL
	thumbnail_url: text("thumbnail_url"),
	duration_seconds: integer("duration_seconds"),
	
	// Processing metadata
	processing_error: text("processing_error"),
	processing_attempts: integer("processing_attempts").notNull().default(0),
	
	// Settings
	max_participants: integer("max_participants").notNull().default(10)
});

// Guest Token Table - matches backend GuestToken model exactly
export const guest_tokens = pgTable("guest_tokens", {
	id: uuid("id").primaryKey().defaultRandom(),
	recording_id: uuid("recording_id").notNull().references(() => recordings.id, { onDelete: 'cascade' }),
	
	// Token details
	token: text("token").notNull().unique(),
	guest_name: text("guest_name"),
	
	// Validity
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
	used_at: timestamp("used_at", { withTimezone: true }),
	is_active: boolean("is_active").notNull().default(true),
	
	// Usage tracking
	uses_remaining: integer("uses_remaining").notNull().default(1) // Single-use by default
});

// Recording Chunk Table - matches backend RecordingChunk model exactly
export const recording_chunks = pgTable("recording_chunks", {
	id: uuid("id").primaryKey().defaultRandom(),
	recording_id: uuid("recording_id").notNull().references(() => recordings.id, { onDelete: 'cascade' }),
	
	// Participant info
	participant_id: text("participant_id").notNull(),
	participant_name: text("participant_name"),
	
	// Chunk metadata
	chunk_index: integer("chunk_index").notNull(), // Order of the chunk
	filename: text("filename").notNull(),
	file_url: text("file_url").notNull(), // Cloud storage URL
	file_size: integer("file_size"),
	
	// Media information
	media_type: text("media_type").notNull(), // 'video', 'audio'
	codec: text("codec"),
	duration_seconds: integer("duration_seconds"),
	
	// Timestamps
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	recording_started_at: timestamp("recording_started_at", { withTimezone: true }).notNull(), // When this chunk recording started
	recording_ended_at: timestamp("recording_ended_at", { withTimezone: true }).notNull(),   // When this chunk recording ended
	
	// Processing status
	is_processed: boolean("is_processed").notNull().default(false),
	processing_error: text("processing_error")
});