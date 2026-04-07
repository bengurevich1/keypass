CREATE TABLE IF NOT EXISTS "access_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"door_id" uuid,
	"user_id" uuid,
	"credential_id" uuid,
	"action" varchar(20) NOT NULL,
	"method" varchar(10),
	"initiated_by" uuid,
	"timestamp" timestamp with time zone DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_activity_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"admin_id" uuid,
	"admin_type" varchar(20),
	"action" varchar(50) NOT NULL,
	"target_type" varchar(50),
	"target_id" uuid,
	"details" jsonb,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"role" varchar(20) DEFAULT 'admin',
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"public_key" text NOT NULL,
	"device_id" varchar(255),
	"device_name" varchar(255),
	"platform" varchar(10),
	"app_version" varchar(20),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "door_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"door_id" uuid,
	"time_restriction" jsonb,
	"valid_from" timestamp with time zone DEFAULT now(),
	"valid_until" timestamp with time zone,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"esp_device_id" varchar(64),
	"mqtt_topic" varchar(255),
	"is_online" boolean DEFAULT false,
	"last_seen_at" timestamp with time zone,
	"firmware_version" varchar(32),
	"unlock_duration_ms" integer DEFAULT 3000,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "doors_esp_device_id_unique" UNIQUE("esp_device_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(500),
	"contact_name" varchar(255),
	"contact_phone" varchar(20),
	"plan" varchar(20) DEFAULT 'standard',
	"monthly_fee" integer DEFAULT 1000,
	"max_doors" integer DEFAULT 5,
	"max_users" integer DEFAULT 200,
	"is_active" boolean DEFAULT true,
	"trial_ends_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "registration_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"token" varchar(64) NOT NULL,
	"otp_code" varchar(6),
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0,
	"used" boolean DEFAULT false,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "registration_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "super_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"phone" varchar(20) NOT NULL,
	"name" varchar(255),
	"apartment" varchar(50),
	"email" varchar(255),
	"status" varchar(20) DEFAULT 'pending',
	"notes" text,
	"registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(10) NOT NULL,
	"external_id" varchar(255),
	"issued_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"template" varchar(50),
	"status" varchar(20),
	"wamid" varchar(255),
	"error" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_door_id_doors_id_fk" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admins" ADD CONSTRAINT "admins_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "door_permissions" ADD CONSTRAINT "door_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "door_permissions" ADD CONSTRAINT "door_permissions_door_id_doors_id_fk" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doors" ADD CONSTRAINT "doors_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_passes" ADD CONSTRAINT "wallet_passes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_org_ts" ON "access_logs" USING btree ("org_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_door_ts" ON "access_logs" USING btree ("door_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_user_ts" ON "access_logs" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_admin_activity_org_ts" ON "admin_activity_logs" USING btree ("org_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admins_org_email_idx" ON "admins" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credentials_user_active" ON "credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_door_permissions_user_door" ON "door_permissions" USING btree ("user_id","door_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_door_permissions_user" ON "door_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_door_permissions_door" ON "door_permissions" USING btree ("door_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doors_org" ON "doors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reg_tokens_token" ON "registration_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_org_status" ON "users" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_org_phone" ON "users" USING btree ("org_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wallet_passes_user_platform" ON "wallet_passes" USING btree ("user_id","platform");