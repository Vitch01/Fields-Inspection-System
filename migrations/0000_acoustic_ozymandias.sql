CREATE TABLE "appraisal_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar NOT NULL,
	"inspection_request_id" varchar,
	"asset_type" text NOT NULL,
	"asset_description" text,
	"appraisal_method" text NOT NULL,
	"current_market_value" numeric(12, 2),
	"replacement_cost" numeric(12, 2),
	"depreciation" numeric(12, 2),
	"salvage_value" numeric(12, 2),
	"appreciation_rate" numeric(5, 2),
	"market_comparables" json,
	"valuation_factors" json,
	"certification_required" boolean DEFAULT false,
	"certification_details" text,
	"valid_until" timestamp,
	"appraiser_notes" text,
	"appraised_at" timestamp DEFAULT now(),
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "asset_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar NOT NULL,
	"inspection_request_id" varchar,
	"asset_type" text NOT NULL,
	"asset_description" text,
	"overall_condition" text NOT NULL,
	"condition_score" integer,
	"structural_integrity" text,
	"functional_status" text,
	"safety_compliance" text,
	"maintenance_requirements" text,
	"recommended_actions" text,
	"urgency_level" text DEFAULT 'medium',
	"estimated_repair_cost" numeric(12, 2),
	"estimated_lifespan" text,
	"findings" json,
	"assessed_at" timestamp DEFAULT now(),
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coordinator_id" varchar NOT NULL,
	"inspector_id" varchar NOT NULL,
	"client_id" varchar,
	"inspection_request_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"inspection_reference" text,
	"inspector_location" json,
	"call_notes" text,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "captured_images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_url" text NOT NULL,
	"thumbnail_url" text,
	"captured_at" timestamp DEFAULT now(),
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text DEFAULT 'USA',
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar,
	"inspection_request_id" varchar,
	"report_id" varchar,
	"recipient_type" text NOT NULL,
	"recipient_id" varchar,
	"recipient_email" text NOT NULL,
	"sender_email" text NOT NULL,
	"email_type" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text,
	"body_html" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"email_provider" text,
	"external_id" text,
	"attachment_urls" json,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar NOT NULL,
	"inspection_request_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"coordinator_id" varchar NOT NULL,
	"inspector_id" varchar NOT NULL,
	"report_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"executive_summary" text,
	"findings" json,
	"recommendations" text,
	"total_estimated_cost" numeric(12, 2),
	"priority_actions" json,
	"attachment_urls" json,
	"report_url" text,
	"delivered_at" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"generated_at" timestamp DEFAULT now(),
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "inspection_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"assigned_department_id" varchar,
	"assigned_coordinator_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"asset_type" text NOT NULL,
	"asset_description" text,
	"location" json,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_date" timestamp,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"estimated_value" numeric(12, 2),
	"inspection_type" text NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'inspector' NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"department_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "video_recordings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_url" text NOT NULL,
	"duration" text,
	"size" text,
	"recorded_at" timestamp DEFAULT now(),
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "wear_tear_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar NOT NULL,
	"inspection_request_id" varchar,
	"component_type" text NOT NULL,
	"component_description" text,
	"wear_level" text NOT NULL,
	"wear_percentage" integer,
	"expected_life_remaining" text,
	"maintenance_history" text,
	"environmental_factors" text,
	"usage_patterns" text,
	"replacement_priority" text DEFAULT 'medium',
	"replacement_cost" numeric(12, 2),
	"maintenance_cost" numeric(12, 2),
	"documentation" json,
	"assessed_at" timestamp DEFAULT now(),
	"metadata" json
);
--> statement-breakpoint
ALTER TABLE "appraisal_reports" ADD CONSTRAINT "appraisal_reports_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisal_reports" ADD CONSTRAINT "appraisal_reports_inspection_request_id_inspection_requests_id_fk" FOREIGN KEY ("inspection_request_id") REFERENCES "public"."inspection_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assessments" ADD CONSTRAINT "asset_assessments_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assessments" ADD CONSTRAINT "asset_assessments_inspection_request_id_inspection_requests_id_fk" FOREIGN KEY ("inspection_request_id") REFERENCES "public"."inspection_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_coordinator_id_users_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_inspection_request_id_inspection_requests_id_fk" FOREIGN KEY ("inspection_request_id") REFERENCES "public"."inspection_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_images" ADD CONSTRAINT "captured_images_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_inspection_request_id_inspection_requests_id_fk" FOREIGN KEY ("inspection_request_id") REFERENCES "public"."inspection_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_report_id_inspection_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."inspection_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_inspection_request_id_inspection_requests_id_fk" FOREIGN KEY ("inspection_request_id") REFERENCES "public"."inspection_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_coordinator_id_users_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_requests" ADD CONSTRAINT "inspection_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_requests" ADD CONSTRAINT "inspection_requests_assigned_department_id_departments_id_fk" FOREIGN KEY ("assigned_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_requests" ADD CONSTRAINT "inspection_requests_assigned_coordinator_id_users_id_fk" FOREIGN KEY ("assigned_coordinator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_recordings" ADD CONSTRAINT "video_recordings_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wear_tear_assessments" ADD CONSTRAINT "wear_tear_assessments_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wear_tear_assessments" ADD CONSTRAINT "wear_tear_assessments_inspection_request_id_inspection_requests_id_fk" FOREIGN KEY ("inspection_request_id") REFERENCES "public"."inspection_requests"("id") ON DELETE no action ON UPDATE no action;