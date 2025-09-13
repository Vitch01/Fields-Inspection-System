import { type User, type InsertUser, type Call, type InsertCall, type CapturedImage, type InsertCapturedImage, type VideoRecording, type InsertVideoRecording, type Client, type InsertClient, type InspectionRequest, type InsertInspectionRequest } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, calls, capturedImages, videoRecordings, clients, inspectionRequests } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Client authentication methods
  getClient(id: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client | undefined>;
  validateClientPassword(email: string, password: string): Promise<Client | undefined>;
  
  // Inspection request management
  getInspectionRequest(id: string): Promise<InspectionRequest | undefined>;
  getInspectionRequestsByClient(clientId: string): Promise<InspectionRequest[]>;
  createInspectionRequest(request: InsertInspectionRequest): Promise<InspectionRequest>;
  updateInspectionRequestStatus(id: string, status: string): Promise<InspectionRequest | undefined>;
  
  // Coordinator-specific request management
  getAllInspectionRequests(filters?: {
    status?: string;
    priority?: string;
    departmentId?: string;
    assignedCoordinatorId?: string;
    assetType?: string;
    limit?: number;
    offset?: number;
  }): Promise<InspectionRequest[]>;
  assignRequestToDepartment(requestId: string, departmentId: string): Promise<InspectionRequest | undefined>;
  assignRequestToCoordinator(requestId: string, coordinatorId: string): Promise<InspectionRequest | undefined>;
  getInspectionRequestsForCoordinator(coordinatorId: string): Promise<InspectionRequest[]>;
  getInspectionRequestsForDepartment(departmentId: string): Promise<InspectionRequest[]>;
  updateInspectionRequest(id: string, updates: Partial<InspectionRequest>): Promise<InspectionRequest | undefined>;
  
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
          // No password - coordinators use default authentication
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

  // Client authentication methods
  async getClient(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
    return result[0];
  }

  async createClient(client: InsertClient): Promise<Client> {
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(client.password, 12);
    const clientWithHashedPassword = { ...client, password: hashedPassword };
    
    const result = await db.insert(clients).values(clientWithHashedPassword).returning();
    return result[0];
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | undefined> {
    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }
    
    const result = await db.update(clients)
      .set(updates)
      .where(eq(clients.id, id))
      .returning();
    
    return result[0];
  }

  async validateClientPassword(email: string, password: string): Promise<Client | undefined> {
    const client = await this.getClientByEmail(email);
    if (!client) {
      return undefined;
    }
    
    const isValid = await bcrypt.compare(password, client.password);
    if (!isValid) {
      return undefined;
    }
    
    return client;
  }

  // Inspection request management
  async getInspectionRequest(id: string): Promise<InspectionRequest | undefined> {
    const result = await db.select().from(inspectionRequests).where(eq(inspectionRequests.id, id)).limit(1);
    return result[0];
  }

  async getInspectionRequestsByClient(clientId: string): Promise<InspectionRequest[]> {
    const result = await db.select()
      .from(inspectionRequests)
      .where(eq(inspectionRequests.clientId, clientId))
      .orderBy(inspectionRequests.createdAt);
    
    return result;
  }

  async createInspectionRequest(request: InsertInspectionRequest): Promise<InspectionRequest> {
    const result = await db.insert(inspectionRequests).values(request).returning();
    return result[0];
  }

  async updateInspectionRequestStatus(id: string, status: string): Promise<InspectionRequest | undefined> {
    const result = await db.update(inspectionRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(inspectionRequests.id, id))
      .returning();
    
    return result[0];
  }

  // Coordinator-specific request management
  async getAllInspectionRequests(filters?: {
    status?: string;
    priority?: string;
    departmentId?: string;
    assignedCoordinatorId?: string;
    assetType?: string;
    limit?: number;
    offset?: number;
  }): Promise<InspectionRequest[]> {
    // Collect all filter conditions
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(inspectionRequests.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(inspectionRequests.priority, filters.priority));
    }
    if (filters?.departmentId) {
      conditions.push(eq(inspectionRequests.assignedDepartmentId, filters.departmentId));
    }
    if (filters?.assignedCoordinatorId) {
      conditions.push(eq(inspectionRequests.assignedCoordinatorId, filters.assignedCoordinatorId));
    }
    if (filters?.assetType) {
      conditions.push(eq(inspectionRequests.assetType, filters.assetType));
    }
    
    // Build query with proper filter combination
    let query = db.select().from(inspectionRequests);
    
    // Apply combined filters using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Order by created date (newest first)
    query = query.orderBy(sql`${inspectionRequests.createdAt} DESC`);
    
    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async assignRequestToDepartment(requestId: string, departmentId: string): Promise<InspectionRequest | undefined> {
    // First check the current status to prevent assignment conflicts
    const currentRequest = await this.getInspectionRequest(requestId);
    if (!currentRequest) {
      return undefined;
    }
    
    // Prevent reassignment if request is in progress or completed
    if (currentRequest.status === 'in_progress') {
      throw new Error('Cannot reassign request that is currently in progress');
    }
    if (currentRequest.status === 'completed') {
      throw new Error('Cannot reassign completed request');
    }
    if (currentRequest.status === 'cancelled') {
      throw new Error('Cannot assign cancelled request');
    }
    
    const result = await db.update(inspectionRequests)
      .set({ 
        assignedDepartmentId: departmentId,
        status: 'assigned',
        updatedAt: new Date()
      })
      .where(eq(inspectionRequests.id, requestId))
      .returning();
    
    return result[0];
  }

  async assignRequestToCoordinator(requestId: string, coordinatorId: string): Promise<InspectionRequest | undefined> {
    // First check the current status to prevent assignment conflicts
    const currentRequest = await this.getInspectionRequest(requestId);
    if (!currentRequest) {
      return undefined;
    }
    
    // Prevent reassignment if request is in progress or completed
    if (currentRequest.status === 'in_progress') {
      throw new Error('Cannot reassign request that is currently in progress');
    }
    if (currentRequest.status === 'completed') {
      throw new Error('Cannot reassign completed request');
    }
    if (currentRequest.status === 'cancelled') {
      throw new Error('Cannot assign cancelled request');
    }
    
    const result = await db.update(inspectionRequests)
      .set({ 
        assignedCoordinatorId: coordinatorId,
        status: 'assigned',
        updatedAt: new Date()
      })
      .where(eq(inspectionRequests.id, requestId))
      .returning();
    
    return result[0];
  }

  async getInspectionRequestsForCoordinator(coordinatorId: string): Promise<InspectionRequest[]> {
    const result = await db.select()
      .from(inspectionRequests)
      .where(eq(inspectionRequests.assignedCoordinatorId, coordinatorId))
      .orderBy(inspectionRequests.createdAt);
    
    return result;
  }

  async getInspectionRequestsForDepartment(departmentId: string): Promise<InspectionRequest[]> {
    const result = await db.select()
      .from(inspectionRequests)
      .where(eq(inspectionRequests.assignedDepartmentId, departmentId))
      .orderBy(inspectionRequests.createdAt);
    
    return result;
  }

  async updateInspectionRequest(id: string, updates: Partial<InspectionRequest>): Promise<InspectionRequest | undefined> {
    const result = await db.update(inspectionRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inspectionRequests.id, id))
      .returning();
    
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
      return (deleted.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting video recording:', error);
      return false;
    }
  }
}

// Use database storage instead of memory storage
export const storage = new DbStorage();
