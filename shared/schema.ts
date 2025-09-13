import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("inspector"), // "coordinator" or "inspector"
  name: text("name").notNull(),
});

export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coordinatorId: varchar("coordinator_id").notNull().references(() => users.id),
  inspectorId: varchar("inspector_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // "pending", "active", "ended"
  startedAt: timestamp("started_at").default(sql`now()`),
  endedAt: timestamp("ended_at"),
  inspectionReference: text("inspection_reference"),
  inspectorLocation: json("inspector_location"), // GPS coordinates when inspector joins
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

export type InsertCapturedImage = z.infer<typeof insertCapturedImageSchema>;
export type CapturedImage = typeof capturedImages.$inferSelect;

export type InsertVideoRecording = z.infer<typeof insertVideoRecordingSchema>;
export type VideoRecording = typeof videoRecordings.$inferSelect;

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
    "user-joined",
    "user-left",
    "image-captured"
  ]),
  callId: z.string(),
  userId: z.string(),
  data: z.any().optional(),
  // HTTP polling transport metadata
  transport: z.enum(["websocket", "http-polling"]).optional(),
  messageId: z.string().optional(), // Unique ID for deduplication
  timestamp: z.number().optional(), // Message timestamp for ordering
  metadata: z.object({
    networkType: z.enum(["wifi", "cellular", "unknown"]).optional(),
    carrierRisk: z.enum(["high", "medium", "low"]).optional(),
    fallbackReason: z.string().optional(), // Why fallback was triggered
    rtt: z.number().optional(), // Round trip time
    connectionQuality: z.enum(["excellent", "good", "poor", "unknown"]).optional()
  }).optional()
});

export type SignalingMessage = z.infer<typeof signalingMessageSchema>;

// HTTP Polling specific schemas
export const httpPollingStatusSchema = z.object({
  callId: z.string(),
  httpPollingClients: z.array(z.object({
    userId: z.string(),
    lastPollTime: z.number(),
    isConnected: z.boolean(),
    timeSinceLastPoll: z.number()
  })),
  webSocketClients: z.array(z.object({
    userId: z.string(),
    readyState: z.number(),
    connected: z.boolean()
  })),
  queuedMessageCount: z.number(),
  transport: z.literal("status"),
  timestamp: z.string()
});

export const httpPollingResponseSchema = z.object({
  messages: z.array(z.any()),
  transport: z.literal("http-polling"),
  timeout: z.boolean().optional(),
  timestamp: z.string()
});

export const httpPollingSendResponseSchema = z.object({
  success: z.boolean(),
  transport: z.literal("http-polling"),
  timestamp: z.string(),
  error: z.string().optional()
});

export type HttpPollingStatus = z.infer<typeof httpPollingStatusSchema>;
export type HttpPollingResponse = z.infer<typeof httpPollingResponseSchema>;
export type HttpPollingSendResponse = z.infer<typeof httpPollingSendResponseSchema>;

// Video recording validation schema
export const videoRecordingSchema = z.object({
  callId: z.string().min(1, "Call ID is required"),
  timestamp: z.string().optional(),
});

export const allowedVideoMimeTypes = ["video/webm", "video/mp4"] as const;
export const allowedVideoExtensions = [".webm", ".mp4"] as const;
