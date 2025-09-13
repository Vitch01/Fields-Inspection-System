import fs from "fs";
import path from "path";
import archiver from "archiver";
import { storage } from "../storage";
import { pdfGenerator } from "./pdf-generator";
import type { InspectionRequest, InspectionReport, InspectionPackage, Client, User } from "@shared/schema";

export interface PackageContents {
  reports: {
    fileName: string;
    originalPath: string;
    size: number;
    type: 'pdf';
  }[];
  media: {
    images: {
      fileName: string;
      originalPath: string;
      size: number;
      category: string;
      capturedAt: string;
    }[];
    videos: {
      fileName: string;
      originalPath: string;
      size: number;
      category: string;
      recordedAt: string;
      duration?: string;
    }[];
  };
  assessments: {
    fileName: string;
    content: any;
    type: 'json';
  }[];
  summary: {
    fileName: string;
    content: string;
    type: 'text';
  };
}

export interface PackageGenerationOptions {
  inspectionRequestId: string;
  coordinatorId: string;
  packageType: 'complete' | 'reports_only' | 'media_only' | 'custom';
  includeReports: boolean;
  includeMedia: boolean;
  includeAssessments: boolean;
  customTitle?: string;
  notes?: string;
}

export class PackageGeneratorService {
  private readonly packagesDir = 'packages';
  private readonly tempDir = 'temp';

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories() {
    try {
      // Ensure packages and temp directories exist
      if (!fs.existsSync(this.packagesDir)) {
        fs.mkdirSync(this.packagesDir, { recursive: true });
      }
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
      console.log('Package directories initialized');
    } catch (error) {
      console.error('Failed to create package directories:', error);
    }
  }

  /**
   * Generate a complete inspection package with all components
   */
  async generatePackage(options: PackageGenerationOptions): Promise<{ 
    success: boolean; 
    packageId?: string; 
    packagePath?: string;
    error?: string;
  }> {
    try {
      console.log(`Starting package generation for inspection request: ${options.inspectionRequestId}`);

      // Get inspection request and related data
      const inspectionRequest = await storage.getInspectionRequest(options.inspectionRequestId);
      if (!inspectionRequest) {
        return { success: false, error: 'Inspection request not found' };
      }

      const client = await storage.getClient(inspectionRequest.clientId);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }

      const coordinator = await storage.getUser(options.coordinatorId);
      if (!coordinator) {
        return { success: false, error: 'Coordinator not found' };
      }

      // Collect all package contents
      const packageContents = await this.collectPackageContents(inspectionRequest, options);
      if (!packageContents) {
        return { success: false, error: 'Failed to collect package contents' };
      }

      // Generate zip file
      const packageInfo = await this.createPackageZip(inspectionRequest, client, packageContents, options);
      if (!packageInfo.success) {
        return { success: false, error: packageInfo.error };
      }

      // Create database entry for the package
      const inspectionPackage = await this.createPackageRecord(
        inspectionRequest, 
        coordinator, 
        packageInfo, 
        packageContents, 
        options
      );

      console.log(`✓ Package generated successfully: ${inspectionPackage.id}`);
      return {
        success: true,
        packageId: inspectionPackage.id,
        packagePath: packageInfo.filePath
      };

    } catch (error: any) {
      console.error('Package generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate package'
      };
    }
  }

  /**
   * Collect all contents that should be included in the package
   */
  private async collectPackageContents(
    inspectionRequest: InspectionRequest, 
    options: PackageGenerationOptions
  ): Promise<PackageContents | null> {
    try {
      const contents: PackageContents = {
        reports: [],
        media: { images: [], videos: [] },
        assessments: [],
        summary: {
          fileName: 'inspection-summary.txt',
          content: '',
          type: 'text'
        }
      };

      // Collect inspection reports
      if (options.includeReports) {
        const reports = await storage.getInspectionReportsByInspectionRequest(inspectionRequest.id);
        
        for (const report of reports) {
          if (report.status === 'approved' || report.status === 'delivered') {
            // Generate PDF if not exists or regenerate
            const pdfResult = await pdfGenerator.generateReportPdf(report.id);
            if (pdfResult.success && pdfResult.filePath) {
              const stats = fs.statSync(pdfResult.filePath);
              contents.reports.push({
                fileName: path.basename(pdfResult.filePath),
                originalPath: pdfResult.filePath,
                size: stats.size,
                type: 'pdf'
              });
            }
          }
        }
      }

      // Collect media (images and videos)
      if (options.includeMedia) {
        const reportData = await storage.getReportDataForInspectionRequest(inspectionRequest.id);
        
        // Add images
        for (const image of reportData.media.images) {
          if (fs.existsSync(image.originalUrl)) {
            const stats = fs.statSync(image.originalUrl);
            contents.media.images.push({
              fileName: image.filename,
              originalPath: image.originalUrl,
              size: stats.size,
              category: image.categoryId || 'uncategorized',
              capturedAt: image.capturedAt?.toISOString() || ''
            });
          }
        }

        // Add videos
        for (const video of reportData.media.videos) {
          if (fs.existsSync(video.originalUrl)) {
            const stats = fs.statSync(video.originalUrl);
            contents.media.videos.push({
              fileName: video.filename,
              originalPath: video.originalUrl,
              size: stats.size,
              category: video.categoryId || 'uncategorized',
              recordedAt: video.recordedAt?.toISOString() || '',
              duration: video.duration || undefined
            });
          }
        }
      }

      // Collect assessments as JSON files
      if (options.includeAssessments) {
        const [assetAssessments, wearTearAssessments, appraisalReports] = await Promise.all([
          storage.getAssetAssessmentsByInspectionRequest(inspectionRequest.id),
          storage.getWearTearAssessmentsByInspectionRequest(inspectionRequest.id),
          storage.getAppraisalReportsByInspectionRequest(inspectionRequest.id)
        ]);

        // Asset assessments
        if (assetAssessments.length > 0) {
          contents.assessments.push({
            fileName: 'asset-assessments.json',
            content: assetAssessments,
            type: 'json'
          });
        }

        // Wear and tear assessments
        if (wearTearAssessments.length > 0) {
          contents.assessments.push({
            fileName: 'wear-tear-assessments.json',
            content: wearTearAssessments,
            type: 'json'
          });
        }

        // Appraisal reports
        if (appraisalReports.length > 0) {
          contents.assessments.push({
            fileName: 'appraisal-reports.json',
            content: appraisalReports,
            type: 'json'
          });
        }
      }

      // Generate package summary
      contents.summary.content = this.generatePackageSummary(inspectionRequest, contents, options);

      return contents;
    } catch (error) {
      console.error('Error collecting package contents:', error);
      return null;
    }
  }

  /**
   * Create the zip file with organized directory structure
   */
  private async createPackageZip(
    inspectionRequest: InspectionRequest,
    client: Client,
    contents: PackageContents,
    options: PackageGenerationOptions
  ): Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }> {
    return new Promise((resolve) => {
      try {
        const timestamp = Date.now();
        const packageName = `${client.name.replace(/\s+/g, '_')}_Inspection_${inspectionRequest.id.substring(0, 8)}_${timestamp}.zip`;
        const zipPath = path.join(this.packagesDir, packageName);
        
        // Create a file to stream archive data to
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Sets the compression level
        });

        // Listen for all archive data to be written
        output.on('close', () => {
          const fileSize = archive.pointer();
          console.log(`✓ Package zip created: ${zipPath} (${fileSize} bytes)`);
          resolve({
            success: true,
            filePath: zipPath,
            fileSize
          });
        });

        // Handle errors
        archive.on('error', (err) => {
          console.error('Archive error:', err);
          resolve({
            success: false,
            error: err.message
          });
        });

        // Pipe archive data to the file
        archive.pipe(output);

        // Add reports to /reports directory
        for (const report of contents.reports) {
          if (fs.existsSync(report.originalPath)) {
            archive.file(report.originalPath, { name: `reports/${report.fileName}` });
          }
        }

        // Add images to /media/images directory organized by category
        const imagesByCategory: Record<string, typeof contents.media.images> = {};
        for (const image of contents.media.images) {
          const category = image.category || 'uncategorized';
          if (!imagesByCategory[category]) {
            imagesByCategory[category] = [];
          }
          imagesByCategory[category].push(image);
        }

        for (const [category, images] of Object.entries(imagesByCategory)) {
          for (const image of images) {
            if (fs.existsSync(image.originalPath)) {
              archive.file(image.originalPath, { 
                name: `media/images/${category}/${image.fileName}` 
              });
            }
          }
        }

        // Add videos to /media/videos directory organized by category
        const videosByCategory: Record<string, typeof contents.media.videos> = {};
        for (const video of contents.media.videos) {
          const category = video.category || 'uncategorized';
          if (!videosByCategory[category]) {
            videosByCategory[category] = [];
          }
          videosByCategory[category].push(video);
        }

        for (const [category, videos] of Object.entries(videosByCategory)) {
          for (const video of videos) {
            if (fs.existsSync(video.originalPath)) {
              archive.file(video.originalPath, { 
                name: `media/videos/${category}/${video.fileName}` 
              });
            }
          }
        }

        // Add assessments to /assessments directory
        for (const assessment of contents.assessments) {
          archive.append(JSON.stringify(assessment.content, null, 2), { 
            name: `assessments/${assessment.fileName}` 
          });
        }

        // Add package summary
        archive.append(contents.summary.content, { 
          name: contents.summary.fileName 
        });

        // Add package metadata
        const metadata = {
          packageInfo: {
            generatedAt: new Date().toISOString(),
            inspectionRequestId: inspectionRequest.id,
            clientName: client.name,
            packageType: options.packageType,
            contents: {
              reports: contents.reports.length,
              images: contents.media.images.length,
              videos: contents.media.videos.length,
              assessments: contents.assessments.length
            }
          }
        };
        archive.append(JSON.stringify(metadata, null, 2), { name: 'package-info.json' });

        // Finalize the archive
        archive.finalize();

      } catch (error: any) {
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Create database record for the package
   */
  private async createPackageRecord(
    inspectionRequest: InspectionRequest,
    coordinator: User,
    packageInfo: any,
    contents: PackageContents,
    options: PackageGenerationOptions
  ): Promise<InspectionPackage> {
    const accessToken = this.generateAccessToken();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 90); // Expire in 90 days

    const packageContentsMetadata = {
      reports: contents.reports.map(r => ({ fileName: r.fileName, size: r.size, type: r.type })),
      media: {
        images: contents.media.images.map(i => ({ 
          fileName: i.fileName, 
          size: i.size, 
          category: i.category,
          capturedAt: i.capturedAt
        })),
        videos: contents.media.videos.map(v => ({ 
          fileName: v.fileName, 
          size: v.size, 
          category: v.category,
          recordedAt: v.recordedAt,
          duration: v.duration
        }))
      },
      assessments: contents.assessments.map(a => ({ fileName: a.fileName, type: a.type })),
      summary: { fileName: contents.summary.fileName, type: contents.summary.type }
    };

    return await storage.createInspectionPackage({
      inspectionRequestId: inspectionRequest.id,
      clientId: inspectionRequest.clientId,
      coordinatorId: coordinator.id,
      title: options.customTitle || `Inspection Package - ${inspectionRequest.title}`,
      description: options.notes || `Complete inspection package for ${inspectionRequest.title}`,
      status: 'ready',
      packageType: options.packageType,
      zipFilePath: packageInfo.filePath,
      zipFileSize: packageInfo.fileSize?.toString(),
      packageContents: packageContentsMetadata,
      accessToken,
      expiresAt: expirationDate,
      notes: options.notes
    });
  }

  /**
   * Generate a summary text for the package
   */
  private generatePackageSummary(
    inspectionRequest: InspectionRequest,
    contents: PackageContents,
    options: PackageGenerationOptions
  ): string {
    const location = inspectionRequest.location as any;
    const address = location?.address 
      ? `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`
      : 'Location details to be confirmed';

    let summary = `INSPECTION PACKAGE SUMMARY
========================================

Inspection Details:
- Request ID: ${inspectionRequest.id}
- Title: ${inspectionRequest.title}
- Asset Type: ${inspectionRequest.assetType.replace('_', ' ').toUpperCase()}
- Inspection Type: ${inspectionRequest.inspectionType.replace('_', ' ').toUpperCase()}
- Priority: ${inspectionRequest.priority.toUpperCase()}
- Status: ${inspectionRequest.status.toUpperCase()}

Location:
${address}

Package Contents:
- Reports: ${contents.reports.length} file(s)
- Images: ${contents.media.images.length} file(s)
- Videos: ${contents.media.videos.length} file(s)
- Assessments: ${contents.assessments.length} file(s)

Generated: ${new Date().toLocaleString()}
Package Type: ${options.packageType.replace('_', ' ').toUpperCase()}

`;

    if (inspectionRequest.description) {
      summary += `Description:
${inspectionRequest.description}

`;
    }

    if (contents.media.images.length > 0) {
      const imagesByCategory: Record<string, number> = {};
      contents.media.images.forEach(img => {
        const category = img.category || 'uncategorized';
        imagesByCategory[category] = (imagesByCategory[category] || 0) + 1;
      });

      summary += `Images by Category:\n`;
      Object.entries(imagesByCategory).forEach(([category, count]) => {
        summary += `- ${category}: ${count} image(s)\n`;
      });
      summary += '\n';
    }

    if (contents.media.videos.length > 0) {
      const videosByCategory: Record<string, number> = {};
      contents.media.videos.forEach(vid => {
        const category = vid.category || 'uncategorized';
        videosByCategory[category] = (videosByCategory[category] || 0) + 1;
      });

      summary += `Videos by Category:\n`;
      Object.entries(videosByCategory).forEach(([category, count]) => {
        summary += `- ${category}: ${count} video(s)\n`;
      });
      summary += '\n';
    }

    summary += `Directory Structure:
/reports/                 - PDF inspection reports
/media/images/           - Captured inspection images organized by category
/media/videos/           - Recorded inspection videos organized by category
/assessments/            - Detailed assessment data (JSON format)
inspection-summary.txt   - This summary file
package-info.json        - Package metadata

For questions about this inspection package, please contact your coordinator.

Professional Field Inspection Services
Generated: ${new Date().toISOString()}
`;

    return summary;
  }

  /**
   * Generate a secure access token for the package
   */
  private generateAccessToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Clean up old packages (called periodically)
   */
  async cleanupExpiredPackages(): Promise<void> {
    try {
      // This would be implemented to clean up expired packages
      // Could be called via a cron job or scheduled task
      console.log('Package cleanup not yet implemented');
    } catch (error) {
      console.error('Error during package cleanup:', error);
    }
  }
}

// Export singleton instance
export const packageGenerator = new PackageGeneratorService();