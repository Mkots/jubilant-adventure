CREATE TYPE "public"."account_status" AS ENUM('pending_verification', 'verifying', 'verified');--> statement-breakpoint
CREATE TYPE "public"."bonus_status" AS ENUM('pending', 'active');--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" "account_status" DEFAULT 'pending_verification' NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"date_of_birth" date,
	"country" char(2),
	"currency" char(3) NOT NULL,
	"balance_amount" integer DEFAULT 0 NOT NULL,
	"bonus_balance_amount" integer DEFAULT 0 NOT NULL,
	"daily_deposit_limit" integer,
	"weekly_deposit_limit" integer,
	"monthly_deposit_limit" integer,
	"session_limit_minutes" integer,
	"verification_code" varchar(16) NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_accounts_balance_non_negative" CHECK ("user_accounts"."balance_amount" >= 0),
	CONSTRAINT "user_accounts_bonus_balance_non_negative" CHECK ("user_accounts"."bonus_balance_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"status" "bonus_status" DEFAULT 'pending' NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "user_bonuses_amount_positive" CHECK ("user_bonuses"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bonuses" ADD CONSTRAINT "user_bonuses_user_id_user_accounts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_bonuses_user_idx" ON "user_bonuses" USING btree ("user_id");