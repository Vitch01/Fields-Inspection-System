import { type User, type InsertUser, type Call, type InsertCall, type CapturedImage, type InsertCapturedImage } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private calls: Map<string, Call>;
  private capturedImages: Map<string, CapturedImage>;

  constructor() {
    this.users = new Map();
    this.calls = new Map();
    this.capturedImages = new Map();
    
    // Add some test users
    this.seedTestData();
  }

  private async seedTestData() {
    const coordinator = await this.createUser({
      username: "coordinator1",
      password: "password",
      role: "coordinator",
      name: "Sarah Johnson"
    });

    const inspector = await this.createUser({
      username: "inspector1", 
      password: "password",
      role: "inspector",
      name: "John Martinez"
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "inspector"
    };
    this.users.set(id, user);
    return user;
  }

  async getCall(id: string): Promise<Call | undefined> {
    return this.calls.get(id);
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const id = randomUUID();
    const call: Call = { 
      ...insertCall, 
      id,
      startedAt: new Date(),
      endedAt: null,
      status: insertCall.status || "pending",
      inspectionReference: insertCall.inspectionReference || null,
      inspectorLocation: null,
      metadata: insertCall.metadata || null,
    };
    this.calls.set(id, call);
    return call;
  }

  async updateCallStatus(id: string, status: string, endedAt?: Date): Promise<Call | undefined> {
    const call = this.calls.get(id);
    if (!call) return undefined;
    
    const updatedCall = { 
      ...call, 
      status,
      endedAt: endedAt || call.endedAt 
    };
    this.calls.set(id, updatedCall);
    return updatedCall;
  }

  async updateCallLocation(id: string, locationData: any): Promise<boolean> {
    const call = this.calls.get(id);
    if (!call) return false;
    
    const updatedCall = { 
      ...call, 
      inspectorLocation: locationData 
    };
    this.calls.set(id, updatedCall);
    return true;
  }

  async getActiveCallForUser(userId: string): Promise<Call | undefined> {
    return Array.from(this.calls.values()).find(
      (call) => (call.coordinatorId === userId || call.inspectorId === userId) && call.status === "active"
    );
  }

  async getCapturedImages(callId: string): Promise<CapturedImage[]> {
    return Array.from(this.capturedImages.values()).filter(
      (image) => image.callId === callId
    );
  }

  async createCapturedImage(insertImage: InsertCapturedImage): Promise<CapturedImage> {
    const id = randomUUID();
    const image: CapturedImage = { 
      ...insertImage, 
      id,
      capturedAt: new Date(),
      thumbnailUrl: insertImage.thumbnailUrl || null,
      metadata: insertImage.metadata || null,
    };
    this.capturedImages.set(id, image);
    return image;
  }

  async deleteCapturedImage(id: string): Promise<boolean> {
    return this.capturedImages.delete(id);
  }
}

export const storage = new MemStorage();
