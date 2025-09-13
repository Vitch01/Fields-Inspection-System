import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// New table: departments for organizing coordinators
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// New table: clients for client management
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email").notNull(),
  password: text("password").notNull(), // Hashed password for authentication
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("USA"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Modified users table to include department relationship
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password"), // Optional - coordinators use default auth, inspectors use password auth
  role: text("role").notNull().default("inspector"), // "coordinator" or "inspector"
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  departmentId: varchar("department_id").references(() => departments.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// New table: inspection requests from clients
export const inspectionRequests = pgTable("inspection_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  assignedDepartmentId: varchar("assigned_department_id").references(() => departments.id),
  assignedCoordinatorId: varchar("assigned_coordinator_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  assetType: text("asset_type").notNull(), // "building", "equipment", "infrastructure", etc.
  assetDescription: text("asset_description"),
  location: json("location"), // GPS coordinates and address
  priority: text("priority").notNull().default("medium"), // "low", "medium", "high", "urgent"
  status: text("status").notNull().default("pending"), // "pending", "assigned", "in_progress", "completed", "cancelled"
  requestedDate: timestamp("requested_date"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }),
  inspectionType: text("inspection_type").notNull(), // "condition_assessment", "wear_tear_analysis", "appraisal", "combined"
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Modified calls table to link with clients and inspection requests
export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coordinatorId: varchar("coordinator_id").notNull().references(() => users.id),
  inspectorId: varchar("inspector_id").notNull().references(() => users.id),
  clientId: varchar("client_id").references(() => clients.id),
  inspectionRequestId: varchar("inspection_request_id").references(() => inspectionRequests.id),
  status: text("status").notNull().default("pending"), // "pending", "active", "ended"
  startedAt: timestamp("started_at").default(sql`now()`),
  endedAt: timestamp("ended_at"),
  inspectionReference: text("inspection_reference"),
  inspectorLocation: json("inspector_location"), // GPS coordinates when inspector joins
  callNotes: text("call_notes"),
  metadata: json("metadata"),
});

export const capturedImages = pgTable("captured_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id),
  filename: text("filename").notNull(),
  originalUrl: text("original_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  capturedAt: timestamp("captured_at").default(sql`now()`),
  metadata: json("metadata"),
});

export const videoRecordings = pgTable("video_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id),
  filename: text("filename").notNull(),
  originalUrl: text("original_url").notNull(),
  duration: text("duration"),
  size: text("size"),
  recordedAt: timestamp("recorded_at").default(sql`now()`),
  metadata: json("metadata"),
});

// New table: asset assessments for detailed condition evaluations
export const assetAssessments = pgTable("asset_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id),
  inspectionRequestId: varchar("inspection_request_id").references(() => inspectionRequests.id),
  assetType: text("asset_type").notNull(),
  assetDescription: text("asset_description"),
  overallCondition: text("overall_condition").notNull(), // "excellent", "good", "fair", "poor", "critical"
  conditionScore: integer("condition_score"), // 1-100 scale
  structuralIntegrity: text("structural_integrity"),
  functionalStatus: text("functional_status"),
  safetyCompliance: text("safety_compliance"),
  maintenanceRequirements: text("maintenance_requirements"),
  recommendedActions: text("recommended_actions"),
  urgencyLevel: text("urgency_level").default("medium"), // "low", "medium", "high", "immediate"
  estimatedRepairCost: decimal("estimated_repair_cost", { precision: 12, scale: 2 }),
  estimatedLifespan: text("estimated_lifespan"),
  findings: json("findings"), // Detailed findings array
  assessedAt: timestamp("assessed_at").default(sql`now()`),
  metadata: json("metadata"),
});

// New table: wear and tear assessments
export const wearTearAssessments = pgTable("wear_tear_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id),
  inspectionRequestId: varchar("inspection_request_id").references(() => inspectionRequests.id),
  componentType: text("component_type").notNull(),
  componentDescription: text("component_description"),
  wearLevel: text("wear_level").notNull(), // "minimal", "light", "moderate", "heavy", "severe"
  wearPercentage: integer("wear_percentage"), // 0-100%
  expectedLifeRemaining: text("expected_life_remaining"),
  maintenanceHistory: text("maintenance_history"),
  environmentalFactors: text("environmental_factors"),
  usagePatterns: text("usage_patterns"),
  replacementPriority: text("replacement_priority").default("medium"), // "low", "medium", "high", "critical"
  replacementCost: decimal("replacement_cost", { precision: 12, scale: 2 }),
  maintenanceCost: decimal("maintenance_cost", { precision: 12, scale: 2 }),
  documentation: json("documentation"), // Photos, measurements, etc.
  assessedAt: timestamp("assessed_at").default(sql`now()`),
  metadata: json("metadata"),
});

// New table: appraisal reports
export const appraisalReports = pgTable("appraisal_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id),
  inspectionRequestId: varchar("inspection_request_id").references(() => inspectionRequests.id),
  assetType: text("asset_type").notNull(),
  assetDescription: text("asset_description"),
  appraisalMethod: text("appraisal_method").notNull(), // "cost_approach", "market_approach", "income_approach"
  currentMarketValue: decimal("current_market_value", { precision: 12, scale: 2 }),
  replacementCost: decimal("replacement_cost", { precision: 12, scale: 2 }),
  depreciation: decimal("depreciation", { precision: 12, scale: 2 }),
  salvageValue: decimal("salvage_value", { precision: 12, scale: 2 }),
  appreciationRate: decimal("appreciation_rate", { precision: 5, scale: 2 }), // Annual percentage
  marketComparables: json("market_comparables"), // Comparable sales data
  valuationFactors: json("valuation_factors"), // Factors affecting valuation
  certificationRequired: boolean("certification_required").default(false),
  certificationDetails: text("certification_details"),
  validUntil: timestamp("valid_until"),
  appraiserNotes: text("appraiser_notes"),
  appraisedAt: timestamp("appraised_at").default(sql`now()`),
  metadata: json("metadata"),
});

// New table: inspection reports linking all assessments
export const inspectionReports = pgTable("inspection_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id), // Optional - for single-call reports, null for multi-call comprehensive reports
  inspectionRequestId: varchar("inspection_request_id").notNull().references(() => inspectionRequests.id),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  coordinatorId: varchar("coordinator_id").notNull().references(() => users.id),
  inspectorId: varchar("inspector_id").notNull().references(() => users.id),
  reportType: text("report_type").notNull(), // "condition_only", "wear_tear_only", "appraisal_only", "comprehensive"
  status: text("status").notNull().default("draft"), // "draft", "review", "approved", "delivered", "archived"
  title: text("title").notNull(),
  executiveSummary: text("executive_summary"),
  findings: json("findings"), // Consolidated findings from all assessments
  recommendations: text("recommendations"),
  totalEstimatedCost: decimal("total_estimated_cost", { precision: 12, scale: 2 }),
  priorityActions: json("priority_actions"), // Array of priority actions
  attachmentUrls: json("attachment_urls"), // URLs to photos, videos, documents
  reportUrl: text("report_url"), // URL to generated PDF report
  deliveredAt: timestamp("delivered_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  generatedAt: timestamp("generated_at").default(sql`now()`),
  metadata: json("metadata"),
});

// New table: email logs for tracking communications
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id),
  inspectionRequestId: varchar("inspection_request_id").references(() => inspectionRequests.id),
  reportId: varchar("report_id").references(() => inspectionReports.id),
  recipientType: text("recipient_type").notNull(), // "inspector", "client", "coordinator", "department"
  recipientId: varchar("recipient_id"), // User ID or Client ID
  recipientEmail: text("recipient_email").notNull(),
  senderEmail: text("sender_email").notNull(),
  emailType: text("email_type").notNull(), // "assignment", "reminder", "report_delivery", "status_update", "notification"
  subject: text("subject").notNull(),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  status: text("status").notNull().default("pending"), // "pending", "sent", "delivered", "failed", "bounced"
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  emailProvider: text("email_provider"), // "smtp", "sendgrid", "mailgun", etc.
  externalId: text("external_id"), // Provider's message ID
  attachmentUrls: json("attachment_urls"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Insert schemas for all tables
export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInspectionRequestSchema = createInsertSchema(inspectionRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCallSchema = createInsertSchema(calls).omit({
  id: true,
  startedAt: true,
  endedAt: true,
});

export const insertCapturedImageSchema = createInsertSchema(capturedImages).omit({
  id: true,
  capturedAt: true,
});

export const insertVideoRecordingSchema = createInsertSchema(videoRecordings).omit({
  id: true,
  recordedAt: true,
});

export const insertAssetAssessmentSchema = createInsertSchema(assetAssessments).omit({
  id: true,
  assessedAt: true,
});

export const insertWearTearAssessmentSchema = createInsertSchema(wearTearAssessments).omit({
  id: true,
  assessedAt: true,
});

export const insertAppraisalReportSchema = createInsertSchema(appraisalReports).omit({
  id: true,
  appraisedAt: true,
});

export const insertInspectionReportSchema = createInsertSchema(inspectionReports).omit({
  id: true,
  generatedAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for all tables
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertInspectionRequest = z.infer<typeof insertInspectionRequestSchema>;
export type InspectionRequest = typeof inspectionRequests.$inferSelect;

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

export type InsertCapturedImage = z.infer<typeof insertCapturedImageSchema>;
export type CapturedImage = typeof capturedImages.$inferSelect;

export type InsertVideoRecording = z.infer<typeof insertVideoRecordingSchema>;
export type VideoRecording = typeof videoRecordings.$inferSelect;

export type InsertAssetAssessment = z.infer<typeof insertAssetAssessmentSchema>;
export type AssetAssessment = typeof assetAssessments.$inferSelect;

export type InsertWearTearAssessment = z.infer<typeof insertWearTearAssessmentSchema>;
export type WearTearAssessment = typeof wearTearAssessments.$inferSelect;

export type InsertAppraisalReport = z.infer<typeof insertAppraisalReportSchema>;
export type AppraisalReport = typeof appraisalReports.$inferSelect;

export type InsertInspectionReport = z.infer<typeof insertInspectionReportSchema>;
export type InspectionReport = typeof inspectionReports.$inferSelect;

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

// WebRTC signaling message types
export const signalingMessageSchema = z.object({
  type: z.enum([
    "offer", 
    "answer", 
    "ice-candidate", 
    "join-call", 
    "leave-call", 
    "capture-image", 
    "chat-message",
    "capture-request",
    "capture-complete",
    "capture-error",
    "ice-restart-request",
    "ping",
    "pong"
  ]),
  callId: z.string().optional(),
  userId: z.string().optional(),
  data: z.any().optional(),
  timestamp: z.number().optional(),
});

export type SignalingMessage = z.infer<typeof signalingMessageSchema>;

// Video recording validation schema
export const videoRecordingSchema = z.object({
  callId: z.string().min(1, "Call ID is required"),
  timestamp: z.string().optional(),
});

export const allowedVideoMimeTypes = ["video/webm", "video/mp4"] as const;
export const allowedVideoExtensions = [".webm", ".mp4"] as const;

// Client authentication schemas
export const clientLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const clientRegistrationSchema = insertClientSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Enhanced inspection request schema for form submission
export const inspectionRequestFormSchema = insertInspectionRequestSchema.extend({
  location: z.object({
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(1, "ZIP code is required"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  requestedDate: z.date({
    required_error: "Please select a preferred inspection date",
  }),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    required_error: "Please select inspection priority",
  }),
  assetType: z.enum(["building", "equipment", "infrastructure", "vehicle", "other"], {
    required_error: "Please select asset type",
  }),
  inspectionType: z.enum(["condition_assessment", "wear_tear_analysis", "appraisal", "combined"], {
    required_error: "Please select inspection type",
  }),
  description: z.string().optional(),
  assetDescription: z.string().optional(),
  estimatedValue: z.number().optional(),
});

// Types for client authentication
export type ClientLogin = z.infer<typeof clientLoginSchema>;
export type ClientRegistration = z.infer<typeof clientRegistrationSchema>;
export type InspectionRequestForm = z.infer<typeof inspectionRequestFormSchema>;
