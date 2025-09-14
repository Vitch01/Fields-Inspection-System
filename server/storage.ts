import { type User, type InsertUser, type Call, type InsertCall, type CapturedImage, type InsertCapturedImage, type VideoRecording, type InsertVideoRecording, type Client, type InsertClient, type InspectionRequest, type InsertInspectionRequest, type EmailLog, type InsertEmailLog, type MediaCategory, type InsertMediaCategory, type AssetAssessment, type InsertAssetAssessment, type WearTearAssessment, type InsertWearTearAssessment, type AppraisalReport, type InsertAppraisalReport, type InspectionReport, type InsertInspectionReport, type InspectionPackage, type InsertInspectionPackage } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, calls, capturedImages, videoRecordings, clients, inspectionRequests, emailLogs, mediaCategories, assetAssessments, wearTearAssessments, appraisalReports, inspectionReports, inspectionPackages } from "@shared/schema";
import { eq, and, sql, or, ilike, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
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
  
  // Enhanced media category management
  getMediaCategories(): Promise<MediaCategory[]>;
  getMediaCategory(id: string): Promise<MediaCategory | undefined>;
  createMediaCategory(category: InsertMediaCategory): Promise<MediaCategory>;
  updateMediaCategory(id: string, updates: Partial<MediaCategory>): Promise<MediaCategory | undefined>;
  
  // Enhanced captured images methods with category support
  getCapturedImages(callId: string, categoryId?: string): Promise<CapturedImage[]>;
  getCapturedImagesByTags(callId: string, tags: string[]): Promise<CapturedImage[]>;
  createCapturedImage(image: InsertCapturedImage): Promise<CapturedImage>;
  updateCapturedImageMetadata(id: string, updates: { categoryId?: string; tags?: string[]; notes?: string; }): Promise<CapturedImage | undefined>;
  deleteCapturedImage(id: string): Promise<boolean>;
  
  // Enhanced video recordings methods with category support
  getVideoRecordings(callId: string, categoryId?: string): Promise<VideoRecording[]>;
  getVideoRecordingsByTags(callId: string, tags: string[]): Promise<VideoRecording[]>;
  createVideoRecording(recording: InsertVideoRecording): Promise<VideoRecording>;
  updateVideoRecordingMetadata(id: string, updates: { categoryId?: string; tags?: string[]; notes?: string; }): Promise<VideoRecording | undefined>;
  deleteVideoRecording(id: string): Promise<boolean>;
  
  // Bulk operations for media management
  bulkUpdateCapturedImages(ids: string[], updates: { categoryId?: string; tags?: string[]; notes?: string; }): Promise<number>;
  bulkUpdateVideoRecordings(ids: string[], updates: { categoryId?: string; tags?: string[]; notes?: string; }): Promise<number>;
  getAllMediaForCall(callId: string): Promise<{ images: CapturedImage[]; videos: VideoRecording[]; }>;
  searchMediaByNotes(callId: string, searchTerm: string): Promise<{ images: CapturedImage[]; videos: VideoRecording[]; }>;
  
  // Email logging methods
  createEmailLog(emailLog: InsertEmailLog): Promise<EmailLog>;
  updateEmailLogStatus(id: string, status: string, sentAt?: Date, deliveredAt?: Date, failureReason?: string): Promise<EmailLog | undefined>;
  getEmailLogsForCall(callId: string): Promise<EmailLog[]>;
  getEmailLogsForInspectionRequest(inspectionRequestId: string): Promise<EmailLog[]>;

  // Asset assessment methods
  getAssetAssessment(id: string): Promise<AssetAssessment | undefined>;
  getAssetAssessmentsByCall(callId: string): Promise<AssetAssessment[]>;
  getAssetAssessmentsByInspectionRequest(inspectionRequestId: string): Promise<AssetAssessment[]>;
  createAssetAssessment(assessment: InsertAssetAssessment): Promise<AssetAssessment>;
  updateAssetAssessment(id: string, updates: Partial<AssetAssessment>): Promise<AssetAssessment | undefined>;
  deleteAssetAssessment(id: string): Promise<boolean>;

  // Wear and tear assessment methods
  getWearTearAssessment(id: string): Promise<WearTearAssessment | undefined>;
  getWearTearAssessmentsByCall(callId: string): Promise<WearTearAssessment[]>;
  getWearTearAssessmentsByInspectionRequest(inspectionRequestId: string): Promise<WearTearAssessment[]>;
  createWearTearAssessment(assessment: InsertWearTearAssessment): Promise<WearTearAssessment>;
  updateWearTearAssessment(id: string, updates: Partial<WearTearAssessment>): Promise<WearTearAssessment | undefined>;
  deleteWearTearAssessment(id: string): Promise<boolean>;

  // Appraisal report methods
  getAppraisalReport(id: string): Promise<AppraisalReport | undefined>;
  getAppraisalReportsByCall(callId: string): Promise<AppraisalReport[]>;
  getAppraisalReportsByInspectionRequest(inspectionRequestId: string): Promise<AppraisalReport[]>;
  createAppraisalReport(report: InsertAppraisalReport): Promise<AppraisalReport>;
  updateAppraisalReport(id: string, updates: Partial<AppraisalReport>): Promise<AppraisalReport | undefined>;
  deleteAppraisalReport(id: string): Promise<boolean>;

  // Inspection report methods
  getInspectionReport(id: string): Promise<InspectionReport | undefined>;
  getInspectionReportsByClient(clientId: string): Promise<InspectionReport[]>;
  getInspectionReportsByCoordinator(coordinatorId: string): Promise<InspectionReport[]>;
  getInspectionReportsByInspectionRequest(inspectionRequestId: string): Promise<InspectionReport[]>;
  createInspectionReport(report: InsertInspectionReport): Promise<InspectionReport>;
  updateInspectionReport(id: string, updates: Partial<InspectionReport>): Promise<InspectionReport | undefined>;
  updateInspectionReportStatus(id: string, status: string, approvedBy?: string): Promise<InspectionReport | undefined>;
  deleteInspectionReport(id: string): Promise<boolean>;

  // Report data aggregation methods
  getReportDataForCall(callId: string): Promise<{
    call: Call | undefined;
    inspectionRequest: InspectionRequest | undefined;
    client: Client | undefined;
    media: { images: CapturedImage[]; videos: VideoRecording[] };
    assessments: AssetAssessment[];
    wearTearAssessments: WearTearAssessment[];
    appraisalReports: AppraisalReport[];
  }>;
  getReportDataForInspectionRequest(inspectionRequestId: string): Promise<{
    inspectionRequest: InspectionRequest | undefined;
    client: Client | undefined;
    calls: Call[];
    media: { images: CapturedImage[]; videos: VideoRecording[] };
    assessments: AssetAssessment[];
    wearTearAssessments: WearTearAssessment[];
    appraisalReports: AppraisalReport[];
  }>;

  // Inspection package methods
  getInspectionPackage(id: string): Promise<InspectionPackage | undefined>;
  getInspectionPackagesByClient(clientId: string): Promise<InspectionPackage[]>;
  getInspectionPackagesByCoordinator(coordinatorId: string): Promise<InspectionPackage[]>;
  getInspectionPackagesByInspectionRequest(inspectionRequestId: string): Promise<InspectionPackage[]>;
  createInspectionPackage(inspectionPackage: InsertInspectionPackage): Promise<InspectionPackage>;
  updateInspectionPackage(id: string, updates: Partial<InspectionPackage>): Promise<InspectionPackage | undefined>;
  updateInspectionPackageStatus(id: string, status: string): Promise<InspectionPackage | undefined>;
  updateInspectionPackageAccess(id: string, accessData: { firstAccessedAt?: Date; lastAccessedAt?: Date; downloadCount?: number; }): Promise<InspectionPackage | undefined>;
  deleteInspectionPackage(id: string): Promise<boolean>;
  getInspectionPackageByAccessToken(accessToken: string): Promise<InspectionPackage | undefined>;
  validateInspectionPackageAccess(id: string, clientId: string, accessToken?: string): Promise<boolean>;
}


// Database-backed storage implementation
export class DbStorage implements IStorage {
  constructor() {
    this.seedTestDataIfNeeded();
  }

  private async seedTestDataIfNeeded() {
    try {
      // Seed default media categories
      await this.seedDefaultMediaCategories();
      
      // Ensure default coordinator exists
      const coordinatorUser = await this.getUserByUsername("coordinator");
      if (!coordinatorUser) {
        await this.createUser({
          username: "coordinator",
          // No password - coordinators use default authentication
          role: "coordinator",
          name: "Sarah Johnson"
        });
        console.log("✓ Created default coordinator user");
      }

      // Check if we already have users (for other test data)
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length === 1) { // Only coordinator exists
        // Add inspector test user
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

  async getUsersByRole(role: string): Promise<User[]> {
    const result = await db.select().from(users).where(eq(users.role, role));
    return result;
  }

  async getAllUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result;
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

  // Media category management methods
  private async seedDefaultMediaCategories() {
    try {
      const existingCategories = await db.select().from(mediaCategories).limit(1);
      if (existingCategories.length === 0) {
        const defaultCategories = [
          { name: 'Arrival', description: 'Initial photos upon arrival at inspection site', icon: 'MapPin', color: 'blue', sortOrder: 1 },
          { name: 'Overview', description: 'General overview and establishing shots', icon: 'Camera', color: 'green', sortOrder: 2 },
          { name: 'Detailed Inspection', description: 'Close-up photos of specific components', icon: 'Search', color: 'orange', sortOrder: 3 },
          { name: 'Damage Documentation', description: 'Photos documenting wear, damage, or issues', icon: 'AlertTriangle', color: 'red', sortOrder: 4 },
          { name: 'Completion', description: 'Final photos before leaving inspection site', icon: 'CheckCircle', color: 'purple', sortOrder: 5 },
        ];
        
        for (const category of defaultCategories) {
          await db.insert(mediaCategories).values({
            id: randomUUID(),
            ...category,
          });
        }
        console.log('Default media categories seeded successfully');
      }
    } catch (error) {
      console.error('Error seeding default media categories:', error);
    }
  }

  async getMediaCategories(): Promise<MediaCategory[]> {
    try {
      const result = await db.select()
        .from(mediaCategories)
        .where(eq(mediaCategories.isActive, true))
        .orderBy(mediaCategories.sortOrder);
      return result;
    } catch (error) {
      console.error('Error fetching media categories:', error);
      return [];
    }
  }

  async getMediaCategory(id: string): Promise<MediaCategory | undefined> {
    try {
      const result = await db.select()
        .from(mediaCategories)
        .where(eq(mediaCategories.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching media category:', error);
      return undefined;
    }
  }

  async createMediaCategory(category: InsertMediaCategory): Promise<MediaCategory> {
    try {
      const result = await db.insert(mediaCategories)
        .values({ id: randomUUID(), ...category })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating media category:', error);
      throw error;
    }
  }

  async updateMediaCategory(id: string, updates: Partial<MediaCategory>): Promise<MediaCategory | undefined> {
    try {
      const result = await db.update(mediaCategories)
        .set(updates)
        .where(eq(mediaCategories.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating media category:', error);
      return undefined;
    }
  }

  // Enhanced captured images methods with category support
  async getCapturedImages(callId: string, categoryId?: string): Promise<CapturedImage[]> {
    try {
      let query = db.select()
        .from(capturedImages)
        .where(eq(capturedImages.callId, callId));
      
      if (categoryId) {
        query = query.where(eq(capturedImages.categoryId, categoryId));
      }
      
      const result = await query.orderBy(capturedImages.sequenceNumber, capturedImages.capturedAt);
      return result;
    } catch (error) {
      console.error('Error fetching captured images:', error);
      return [];
    }
  }

  async getCapturedImagesByTags(callId: string, tags: string[]): Promise<CapturedImage[]> {
    try {
      const result = await db.select()
        .from(capturedImages)
        .where(and(
          eq(capturedImages.callId, callId),
          sql`${capturedImages.tags} && ${tags}`
        ))
        .orderBy(capturedImages.capturedAt);
      return result;
    } catch (error) {
      console.error('Error fetching captured images by tags:', error);
      return [];
    }
  }

  async createCapturedImage(image: InsertCapturedImage): Promise<CapturedImage> {
    try {
      const result = await db.insert(capturedImages)
        .values({ id: randomUUID(), ...image })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating captured image:', error);
      throw error;
    }
  }

  async updateCapturedImageMetadata(
    id: string, 
    updates: { categoryId?: string; tags?: string[]; notes?: string; }
  ): Promise<CapturedImage | undefined> {
    try {
      const result = await db.update(capturedImages)
        .set(updates)
        .where(eq(capturedImages.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating captured image metadata:', error);
      return undefined;
    }
  }

  async deleteCapturedImage(id: string): Promise<boolean> {
    const result = await db.delete(capturedImages)
      .where(eq(capturedImages.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Enhanced video recordings methods with category support
  async getVideoRecordings(callId: string, categoryId?: string): Promise<VideoRecording[]> {
    try {
      let query = db.select()
        .from(videoRecordings)
        .where(eq(videoRecordings.callId, callId));
      
      if (categoryId) {
        query = query.where(eq(videoRecordings.categoryId, categoryId));
      }
      
      const recordings = await query.orderBy(videoRecordings.sequenceNumber, videoRecordings.recordedAt);
      return recordings;
    } catch (error) {
      console.error('Error fetching video recordings:', error);
      return [];
    }
  }

  async getVideoRecordingsByTags(callId: string, tags: string[]): Promise<VideoRecording[]> {
    try {
      const result = await db.select()
        .from(videoRecordings)
        .where(and(
          eq(videoRecordings.callId, callId),
          sql`${videoRecordings.tags} && ${tags}`
        ))
        .orderBy(videoRecordings.recordedAt);
      return result;
    } catch (error) {
      console.error('Error fetching video recordings by tags:', error);
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

  async updateVideoRecordingMetadata(
    id: string, 
    updates: { categoryId?: string; tags?: string[]; notes?: string; }
  ): Promise<VideoRecording | undefined> {
    try {
      const result = await db.update(videoRecordings)
        .set(updates)
        .where(eq(videoRecordings.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating video recording metadata:', error);
      return undefined;
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

  // Bulk operations for media management
  async bulkUpdateCapturedImages(
    ids: string[], 
    updates: { categoryId?: string; tags?: string[]; notes?: string; }
  ): Promise<number> {
    try {
      const result = await db.update(capturedImages)
        .set(updates)
        .where(inArray(capturedImages.id, ids));
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error bulk updating captured images:', error);
      return 0;
    }
  }

  async bulkUpdateVideoRecordings(
    ids: string[], 
    updates: { categoryId?: string; tags?: string[]; notes?: string; }
  ): Promise<number> {
    try {
      const result = await db.update(videoRecordings)
        .set(updates)
        .where(inArray(videoRecordings.id, ids));
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error bulk updating video recordings:', error);
      return 0;
    }
  }

  async getAllMediaForCall(callId: string): Promise<{ images: CapturedImage[]; videos: VideoRecording[]; }> {
    try {
      const [images, videos] = await Promise.all([
        this.getCapturedImages(callId),
        this.getVideoRecordings(callId)
      ]);
      return { images, videos };
    } catch (error) {
      console.error('Error fetching all media for call:', error);
      return { images: [], videos: [] };
    }
  }

  async searchMediaByNotes(
    callId: string, 
    searchTerm: string
  ): Promise<{ images: CapturedImage[]; videos: VideoRecording[]; }> {
    try {
      const searchPattern = `%${searchTerm.toLowerCase()}%`;
      
      const [images, videos] = await Promise.all([
        db.select()
          .from(capturedImages)
          .where(and(
            eq(capturedImages.callId, callId),
            ilike(capturedImages.notes, searchPattern)
          ))
          .orderBy(capturedImages.capturedAt),
        
        db.select()
          .from(videoRecordings)
          .where(and(
            eq(videoRecordings.callId, callId),
            ilike(videoRecordings.notes, searchPattern)
          ))
          .orderBy(videoRecordings.recordedAt)
      ]);
      
      return { images, videos };
    } catch (error) {
      console.error('Error searching media by notes:', error);
      return { images: [], videos: [] };
    }
  }

  // Email logging methods
  async createEmailLog(emailLog: InsertEmailLog): Promise<EmailLog> {
    try {
      const result = await db.insert(emailLogs).values(emailLog).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating email log:', error);
      throw error;
    }
  }

  async updateEmailLogStatus(
    id: string, 
    status: string, 
    sentAt?: Date, 
    deliveredAt?: Date, 
    failureReason?: string
  ): Promise<EmailLog | undefined> {
    try {
      const updates: any = { status };
      if (sentAt) updates.sentAt = sentAt;
      if (deliveredAt) updates.deliveredAt = deliveredAt;
      if (failureReason) updates.failureReason = failureReason;

      const result = await db.update(emailLogs)
        .set(updates)
        .where(eq(emailLogs.id, id))
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error updating email log status:', error);
      return undefined;
    }
  }

  async getEmailLogsForCall(callId: string): Promise<EmailLog[]> {
    try {
      const result = await db.select()
        .from(emailLogs)
        .where(eq(emailLogs.callId, callId))
        .orderBy(emailLogs.createdAt);
      
      return result;
    } catch (error) {
      console.error('Error fetching email logs for call:', error);
      return [];
    }
  }

  async getEmailLogsForInspectionRequest(inspectionRequestId: string): Promise<EmailLog[]> {
    try {
      const result = await db.select()
        .from(emailLogs)
        .where(eq(emailLogs.inspectionRequestId, inspectionRequestId))
        .orderBy(emailLogs.createdAt);
      
      return result;
    } catch (error) {
      console.error('Error fetching email logs for inspection request:', error);
      return [];
    }
  }

  // Asset assessment methods
  async getAssetAssessment(id: string): Promise<AssetAssessment | undefined> {
    try {
      const result = await db.select()
        .from(assetAssessments)
        .where(eq(assetAssessments.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching asset assessment:', error);
      return undefined;
    }
  }

  async getAssetAssessmentsByCall(callId: string): Promise<AssetAssessment[]> {
    try {
      const result = await db.select()
        .from(assetAssessments)
        .where(eq(assetAssessments.callId, callId))
        .orderBy(assetAssessments.assessedAt);
      return result;
    } catch (error) {
      console.error('Error fetching asset assessments by call:', error);
      return [];
    }
  }

  async getAssetAssessmentsByInspectionRequest(inspectionRequestId: string): Promise<AssetAssessment[]> {
    try {
      const result = await db.select()
        .from(assetAssessments)
        .where(eq(assetAssessments.inspectionRequestId, inspectionRequestId))
        .orderBy(assetAssessments.assessedAt);
      return result;
    } catch (error) {
      console.error('Error fetching asset assessments by inspection request:', error);
      return [];
    }
  }

  async createAssetAssessment(assessment: InsertAssetAssessment): Promise<AssetAssessment> {
    try {
      const result = await db.insert(assetAssessments)
        .values({ id: randomUUID(), ...assessment })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating asset assessment:', error);
      throw error;
    }
  }

  async updateAssetAssessment(id: string, updates: Partial<AssetAssessment>): Promise<AssetAssessment | undefined> {
    try {
      const result = await db.update(assetAssessments)
        .set(updates)
        .where(eq(assetAssessments.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating asset assessment:', error);
      return undefined;
    }
  }

  async deleteAssetAssessment(id: string): Promise<boolean> {
    try {
      const result = await db.delete(assetAssessments)
        .where(eq(assetAssessments.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting asset assessment:', error);
      return false;
    }
  }

  // Wear and tear assessment methods
  async getWearTearAssessment(id: string): Promise<WearTearAssessment | undefined> {
    try {
      const result = await db.select()
        .from(wearTearAssessments)
        .where(eq(wearTearAssessments.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching wear tear assessment:', error);
      return undefined;
    }
  }

  async getWearTearAssessmentsByCall(callId: string): Promise<WearTearAssessment[]> {
    try {
      const result = await db.select()
        .from(wearTearAssessments)
        .where(eq(wearTearAssessments.callId, callId))
        .orderBy(wearTearAssessments.assessedAt);
      return result;
    } catch (error) {
      console.error('Error fetching wear tear assessments by call:', error);
      return [];
    }
  }

  async getWearTearAssessmentsByInspectionRequest(inspectionRequestId: string): Promise<WearTearAssessment[]> {
    try {
      const result = await db.select()
        .from(wearTearAssessments)
        .where(eq(wearTearAssessments.inspectionRequestId, inspectionRequestId))
        .orderBy(wearTearAssessments.assessedAt);
      return result;
    } catch (error) {
      console.error('Error fetching wear tear assessments by inspection request:', error);
      return [];
    }
  }

  async createWearTearAssessment(assessment: InsertWearTearAssessment): Promise<WearTearAssessment> {
    try {
      const result = await db.insert(wearTearAssessments)
        .values({ id: randomUUID(), ...assessment })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating wear tear assessment:', error);
      throw error;
    }
  }

  async updateWearTearAssessment(id: string, updates: Partial<WearTearAssessment>): Promise<WearTearAssessment | undefined> {
    try {
      const result = await db.update(wearTearAssessments)
        .set(updates)
        .where(eq(wearTearAssessments.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating wear tear assessment:', error);
      return undefined;
    }
  }

  async deleteWearTearAssessment(id: string): Promise<boolean> {
    try {
      const result = await db.delete(wearTearAssessments)
        .where(eq(wearTearAssessments.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting wear tear assessment:', error);
      return false;
    }
  }

  // Appraisal report methods
  async getAppraisalReport(id: string): Promise<AppraisalReport | undefined> {
    try {
      const result = await db.select()
        .from(appraisalReports)
        .where(eq(appraisalReports.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching appraisal report:', error);
      return undefined;
    }
  }

  async getAppraisalReportsByCall(callId: string): Promise<AppraisalReport[]> {
    try {
      const result = await db.select()
        .from(appraisalReports)
        .where(eq(appraisalReports.callId, callId))
        .orderBy(appraisalReports.appraisedAt);
      return result;
    } catch (error) {
      console.error('Error fetching appraisal reports by call:', error);
      return [];
    }
  }

  async getAppraisalReportsByInspectionRequest(inspectionRequestId: string): Promise<AppraisalReport[]> {
    try {
      const result = await db.select()
        .from(appraisalReports)
        .where(eq(appraisalReports.inspectionRequestId, inspectionRequestId))
        .orderBy(appraisalReports.appraisedAt);
      return result;
    } catch (error) {
      console.error('Error fetching appraisal reports by inspection request:', error);
      return [];
    }
  }

  async createAppraisalReport(report: InsertAppraisalReport): Promise<AppraisalReport> {
    try {
      const result = await db.insert(appraisalReports)
        .values({ id: randomUUID(), ...report })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating appraisal report:', error);
      throw error;
    }
  }

  async updateAppraisalReport(id: string, updates: Partial<AppraisalReport>): Promise<AppraisalReport | undefined> {
    try {
      const result = await db.update(appraisalReports)
        .set(updates)
        .where(eq(appraisalReports.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating appraisal report:', error);
      return undefined;
    }
  }

  async deleteAppraisalReport(id: string): Promise<boolean> {
    try {
      const result = await db.delete(appraisalReports)
        .where(eq(appraisalReports.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting appraisal report:', error);
      return false;
    }
  }

  // Inspection report methods
  async getInspectionReport(id: string): Promise<InspectionReport | undefined> {
    try {
      const result = await db.select()
        .from(inspectionReports)
        .where(eq(inspectionReports.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching inspection report:', error);
      return undefined;
    }
  }

  async getInspectionReportsByClient(clientId: string): Promise<InspectionReport[]> {
    try {
      const result = await db.select()
        .from(inspectionReports)
        .where(eq(inspectionReports.clientId, clientId))
        .orderBy(inspectionReports.generatedAt);
      return result;
    } catch (error) {
      console.error('Error fetching inspection reports by client:', error);
      return [];
    }
  }

  async getInspectionReportsByCoordinator(coordinatorId: string): Promise<InspectionReport[]> {
    try {
      const result = await db.select()
        .from(inspectionReports)
        .where(eq(inspectionReports.coordinatorId, coordinatorId))
        .orderBy(inspectionReports.generatedAt);
      return result;
    } catch (error) {
      console.error('Error fetching inspection reports by coordinator:', error);
      return [];
    }
  }

  async getInspectionReportsByInspectionRequest(inspectionRequestId: string): Promise<InspectionReport[]> {
    try {
      const result = await db.select()
        .from(inspectionReports)
        .where(eq(inspectionReports.inspectionRequestId, inspectionRequestId))
        .orderBy(inspectionReports.generatedAt);
      return result;
    } catch (error) {
      console.error('Error fetching inspection reports by inspection request:', error);
      return [];
    }
  }

  async createInspectionReport(report: InsertInspectionReport): Promise<InspectionReport> {
    try {
      const result = await db.insert(inspectionReports)
        .values({ id: randomUUID(), ...report })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating inspection report:', error);
      throw error;
    }
  }

  async updateInspectionReport(id: string, updates: Partial<InspectionReport>): Promise<InspectionReport | undefined> {
    try {
      const result = await db.update(inspectionReports)
        .set(updates)
        .where(eq(inspectionReports.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating inspection report:', error);
      return undefined;
    }
  }

  async updateInspectionReportStatus(id: string, status: string, approvedBy?: string): Promise<InspectionReport | undefined> {
    try {
      const updates: any = { status };
      if (status === 'approved' && approvedBy) {
        updates.approvedBy = approvedBy;
        updates.approvedAt = new Date();
      }
      if (status === 'delivered') {
        updates.deliveredAt = new Date();
      }

      const result = await db.update(inspectionReports)
        .set(updates)
        .where(eq(inspectionReports.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating inspection report status:', error);
      return undefined;
    }
  }

  async deleteInspectionReport(id: string): Promise<boolean> {
    try {
      const result = await db.delete(inspectionReports)
        .where(eq(inspectionReports.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting inspection report:', error);
      return false;
    }
  }

  // Report data aggregation methods
  async getReportDataForCall(callId: string): Promise<{
    call: Call | undefined;
    inspectionRequest: InspectionRequest | undefined;
    client: Client | undefined;
    media: { images: CapturedImage[]; videos: VideoRecording[] };
    assessments: AssetAssessment[];
    wearTearAssessments: WearTearAssessment[];
    appraisalReports: AppraisalReport[];
  }> {
    try {
      const call = await this.getCall(callId);
      if (!call) {
        return {
          call: undefined,
          inspectionRequest: undefined,
          client: undefined,
          media: { images: [], videos: [] },
          assessments: [],
          wearTearAssessments: [],
          appraisalReports: []
        };
      }

      const [inspectionRequest, media, assessments, wearTearAssessments, appraisalReports] = await Promise.all([
        call.inspectionRequestId ? this.getInspectionRequest(call.inspectionRequestId) : Promise.resolve(undefined),
        this.getAllMediaForCall(callId),
        this.getAssetAssessmentsByCall(callId),
        this.getWearTearAssessmentsByCall(callId),
        this.getAppraisalReportsByCall(callId)
      ]);

      const client = inspectionRequest?.clientId ? await this.getClient(inspectionRequest.clientId) : undefined;

      return {
        call,
        inspectionRequest,
        client,
        media,
        assessments,
        wearTearAssessments,
        appraisalReports
      };
    } catch (error) {
      console.error('Error fetching report data for call:', error);
      return {
        call: undefined,
        inspectionRequest: undefined,
        client: undefined,
        media: { images: [], videos: [] },
        assessments: [],
        wearTearAssessments: [],
        appraisalReports: []
      };
    }
  }

  async getReportDataForInspectionRequest(inspectionRequestId: string): Promise<{
    inspectionRequest: InspectionRequest | undefined;
    client: Client | undefined;
    calls: Call[];
    media: { images: CapturedImage[]; videos: VideoRecording[] };
    assessments: AssetAssessment[];
    wearTearAssessments: WearTearAssessment[];
    appraisalReports: AppraisalReport[];
  }> {
    try {
      const inspectionRequest = await this.getInspectionRequest(inspectionRequestId);
      if (!inspectionRequest) {
        return {
          inspectionRequest: undefined,
          client: undefined,
          calls: [],
          media: { images: [], videos: [] },
          assessments: [],
          wearTearAssessments: [],
          appraisalReports: []
        };
      }

      // Get all calls related to this inspection request
      const calls = await db.select()
        .from(calls)
        .where(eq(calls.inspectionRequestId, inspectionRequestId))
        .orderBy(calls.startedAt);

      // Aggregate media from all calls
      const allMedia = await Promise.all(
        calls.map(call => this.getAllMediaForCall(call.id))
      );
      
      const aggregatedMedia = allMedia.reduce(
        (acc, media) => ({
          images: [...acc.images, ...media.images],
          videos: [...acc.videos, ...media.videos]
        }),
        { images: [] as CapturedImage[], videos: [] as VideoRecording[] }
      );

      const [client, assessments, wearTearAssessments, appraisalReports] = await Promise.all([
        this.getClient(inspectionRequest.clientId),
        this.getAssetAssessmentsByInspectionRequest(inspectionRequestId),
        this.getWearTearAssessmentsByInspectionRequest(inspectionRequestId),
        this.getAppraisalReportsByInspectionRequest(inspectionRequestId)
      ]);

      return {
        inspectionRequest,
        client,
        calls,
        media: aggregatedMedia,
        assessments,
        wearTearAssessments,
        appraisalReports
      };
    } catch (error) {
      console.error('Error fetching report data for inspection request:', error);
      return {
        inspectionRequest: undefined,
        client: undefined,
        calls: [],
        media: { images: [], videos: [] },
        assessments: [],
        wearTearAssessments: [],
        appraisalReports: []
      };
    }
  }

  // Inspection Package Methods Implementation

  async getInspectionPackage(id: string): Promise<InspectionPackage | undefined> {
    try {
      const result = await db.select()
        .from(inspectionPackages)
        .where(eq(inspectionPackages.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting inspection package:', error);
      return undefined;
    }
  }

  async getInspectionPackagesByClient(clientId: string): Promise<InspectionPackage[]> {
    try {
      return await db.select()
        .from(inspectionPackages)
        .where(eq(inspectionPackages.clientId, clientId))
        .orderBy(sql`${inspectionPackages.createdAt} DESC`);
    } catch (error) {
      console.error('Error getting inspection packages by client:', error);
      return [];
    }
  }

  async getInspectionPackagesByCoordinator(coordinatorId: string): Promise<InspectionPackage[]> {
    try {
      return await db.select()
        .from(inspectionPackages)
        .where(eq(inspectionPackages.coordinatorId, coordinatorId))
        .orderBy(sql`${inspectionPackages.createdAt} DESC`);
    } catch (error) {
      console.error('Error getting inspection packages by coordinator:', error);
      return [];
    }
  }

  async getInspectionPackagesByInspectionRequest(inspectionRequestId: string): Promise<InspectionPackage[]> {
    try {
      return await db.select()
        .from(inspectionPackages)
        .where(eq(inspectionPackages.inspectionRequestId, inspectionRequestId))
        .orderBy(sql`${inspectionPackages.createdAt} DESC`);
    } catch (error) {
      console.error('Error getting inspection packages by inspection request:', error);
      return [];
    }
  }

  async createInspectionPackage(inspectionPackage: InsertInspectionPackage): Promise<InspectionPackage> {
    try {
      const result = await db.insert(inspectionPackages)
        .values({
          ...inspectionPackage,
          id: randomUUID(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating inspection package:', error);
      throw new Error('Failed to create inspection package');
    }
  }

  async updateInspectionPackage(id: string, updates: Partial<InspectionPackage>): Promise<InspectionPackage | undefined> {
    try {
      const result = await db.update(inspectionPackages)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(inspectionPackages.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating inspection package:', error);
      return undefined;
    }
  }

  async updateInspectionPackageStatus(id: string, status: string): Promise<InspectionPackage | undefined> {
    try {
      const updates: Partial<InspectionPackage> = { 
        status,
        updatedAt: new Date()
      };

      // Set delivery timestamp when status changes to delivered
      if (status === 'delivered') {
        updates.deliveredAt = new Date();
      }

      const result = await db.update(inspectionPackages)
        .set(updates)
        .where(eq(inspectionPackages.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating inspection package status:', error);
      return undefined;
    }
  }

  async updateInspectionPackageAccess(id: string, accessData: { 
    firstAccessedAt?: Date; 
    lastAccessedAt?: Date; 
    downloadCount?: number; 
  }): Promise<InspectionPackage | undefined> {
    try {
      const updates: Partial<InspectionPackage> = {
        ...accessData,
        updatedAt: new Date()
      };

      const result = await db.update(inspectionPackages)
        .set(updates)
        .where(eq(inspectionPackages.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating inspection package access:', error);
      return undefined;
    }
  }

  async deleteInspectionPackage(id: string): Promise<boolean> {
    try {
      const result = await db.delete(inspectionPackages)
        .where(eq(inspectionPackages.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting inspection package:', error);
      return false;
    }
  }

  async getInspectionPackageByAccessToken(accessToken: string): Promise<InspectionPackage | undefined> {
    try {
      const result = await db.select()
        .from(inspectionPackages)
        .where(eq(inspectionPackages.accessToken, accessToken))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting inspection package by access token:', error);
      return undefined;
    }
  }

  async validateInspectionPackageAccess(id: string, clientId: string, accessToken?: string): Promise<boolean> {
    try {
      const inspectionPackage = await this.getInspectionPackage(id);
      if (!inspectionPackage) {
        return false;
      }

      // Verify client ownership
      if (inspectionPackage.clientId !== clientId) {
        return false;
      }

      // Check if package has expired
      if (inspectionPackage.expiresAt && new Date() > new Date(inspectionPackage.expiresAt)) {
        return false;
      }

      // If access token is required, verify it
      if (inspectionPackage.accessToken && accessToken !== inspectionPackage.accessToken) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating inspection package access:', error);
      return false;
    }
  }
}

// Use database storage instead of memory storage
export const storage = new DbStorage();
