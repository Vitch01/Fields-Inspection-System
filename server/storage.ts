import { type User, type InsertUser, type Call, type InsertCall, type CapturedImage, type InsertCapturedImage, type VideoRecording, type InsertVideoRecording } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, calls, capturedImages, videoRecordings } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCall(id: string): Promise<Call | undefined>;
  createCall(call: InsertCall): Promise<Call>;
  updateCallStatus(id: string, status: string, endedAt?: Date): Promise<Call | undefined>;
  updateCallLocation(id: string, locationData: any): Promise<boolean>;
  getActiveCallForUser(userId: string): Promise<Call | undefined>;
  
  getCapturedImages(callId: string): Promise<CapturedImage[]>;
  createCapturedImage(image: InsertCapturedImage): Promise<CapturedImage>;
  deleteCapturedImage(id: string): Promise<boolean>;
  
  getVideoRecordings(callId: string): Promise<VideoRecording[]>;
  createVideoRecording(recording: InsertVideoRecording): Promise<VideoRecording>;
  deleteVideoRecording(id: string): Promise<boolean>;
}


// Database-backed storage implementation
export class DbStorage implements IStorage {
  constructor() {
    this.seedTestDataIfNeeded();
  }

  private async seedTestDataIfNeeded() {
    try {
      // Check if we already have users
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length === 0) {
        // Add some test users if none exist
        await this.createUser({
          username: "coordinator1",
          password: "password",
          role: "coordinator",
          name: "Sarah Johnson"
        });

        await this.createUser({
          username: "inspector1",
          password: "password", 
          role: "inspector",
          name: "John Martinez"
        });

        console.log("✓ Database seeded with test users");
      }
    } catch (error: any) {
      console.log("Database seeding skipped - tables may not exist yet:", error.message);
    }
  }
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getCall(id: string): Promise<Call | undefined> {
    const result = await db.select().from(calls).where(eq(calls.id, id)).limit(1);
    return result[0];
  }

  async createCall(call: InsertCall): Promise<Call> {
    const result = await db.insert(calls).values(call).returning();
    return result[0];
  }

  async updateCallStatus(id: string, status: string, endedAt?: Date): Promise<Call | undefined> {
    const updateData: Partial<Call> = { status };
    if (endedAt) {
      updateData.endedAt = endedAt;
    }
    
    const result = await db.update(calls)
      .set(updateData)
      .where(eq(calls.id, id))
      .returning();
    
    return result[0];
  }

  async updateCallLocation(id: string, locationData: any): Promise<boolean> {
    const result = await db.update(calls)
      .set({ inspectorLocation: locationData })
      .where(eq(calls.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getActiveCallForUser(userId: string): Promise<Call | undefined> {
    const result = await db.select()
      .from(calls)
      .where(eq(calls.status, "active"));
    
    return result.find(call => call.coordinatorId === userId || call.inspectorId === userId);
  }

  async getCapturedImages(callId: string): Promise<CapturedImage[]> {
    const result = await db.select()
      .from(capturedImages)
      .where(eq(capturedImages.callId, callId))
      .orderBy(capturedImages.capturedAt);
    
    return result;
  }

  async createCapturedImage(image: InsertCapturedImage): Promise<CapturedImage> {
    const result = await db.insert(capturedImages).values(image).returning();
    return result[0];
  }

  async deleteCapturedImage(id: string): Promise<boolean> {
    const result = await db.delete(capturedImages)
      .where(eq(capturedImages.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getVideoRecordings(callId: string): Promise<VideoRecording[]> {
    try {
      const recordings = await db
        .select()
        .from(videoRecordings)
        .where(eq(videoRecordings.callId, callId))
        .orderBy(videoRecordings.recordedAt);
      return recordings;
    } catch (error) {
      console.error('Error fetching video recordings:', error);
      return [];
    }
  }

  async createVideoRecording(recording: InsertVideoRecording): Promise<VideoRecording> {
    try {
      const [newRecording] = await db
        .insert(videoRecordings)
        .values({
          id: randomUUID(),
          ...recording,
        })
        .returning();
      return newRecording;
    } catch (error) {
      console.error('Error creating video recording:', error);
      throw error;
    }
  }

  async deleteVideoRecording(id: string): Promise<boolean> {
    try {
      const deleted = await db.delete(videoRecordings).where(eq(videoRecordings.id, id));
      return deleted.rowCount > 0;
    } catch (error) {
      console.error('Error deleting video recording:', error);
      return false;
    }
  }
}

// Use database storage instead of memory storage
export const storage = new DbStorage();
