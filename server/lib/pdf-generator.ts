import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { storage } from '../storage';
import type { InspectionReport, AssetAssessment, WearTearAssessment, AppraisalReport, Client, InspectionRequest, Call, CapturedImage, VideoRecording } from '@shared/schema';

export interface ReportData {
  report: InspectionReport;
  client: Client;
  inspectionRequest: InspectionRequest;
  calls: Call[];
  assetAssessments: AssetAssessment[];
  wearTearAssessments: WearTearAssessment[];
  appraisalReports: AppraisalReport[];
  media: {
    images: CapturedImage[];
    videos: VideoRecording[];
  };
}

export interface ReportTemplate {
  headerTemplate: string;
  footerTemplate: string;
  styles: string;
  generateHtml: (data: ReportData) => string;
}

// HTML/CSS templates for different report types
const BASE_STYLES = `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      background: white;
    }
    
    .container {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .company-logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .report-title {
      font-size: 20px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 5px;
    }
    
    .report-subtitle {
      font-size: 14px;
      color: #6b7280;
    }
    
    .section {
      margin-bottom: 30px;
      break-inside: avoid;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #1f2937;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
      margin-bottom: 15px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .info-item {
      padding: 10px;
      background: #f9fafb;
      border-left: 3px solid #2563eb;
    }
    
    .info-label {
      font-weight: bold;
      color: #374151;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .info-value {
      margin-top: 3px;
      color: #1f2937;
      font-size: 13px;
    }
    
    .assessment-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      background: white;
    }
    
    .assessment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .assessment-title {
      font-weight: bold;
      font-size: 14px;
      color: #1f2937;
    }
    
    .condition-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .condition-excellent { background: #dcfce7; color: #166534; }
    .condition-good { background: #dbeafe; color: #1e40af; }
    .condition-fair { background: #fef3c7; color: #92400e; }
    .condition-poor { background: #fee2e2; color: #dc2626; }
    .condition-critical { background: #fecaca; color: #991b1b; }
    
    .wear-level-minimal { background: #dcfce7; color: #166534; }
    .wear-level-light { background: #dbeafe; color: #1e40af; }
    .wear-level-moderate { background: #fef3c7; color: #92400e; }
    .wear-level-heavy { background: #fee2e2; color: #dc2626; }
    .wear-level-severe { background: #fecaca; color: #991b1b; }
    
    .priority-low { background: #dcfce7; color: #166534; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-high { background: #fee2e2; color: #dc2626; }
    .priority-critical { background: #fecaca; color: #991b1b; }
    
    .media-gallery {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 15px;
    }
    
    .media-item {
      text-align: center;
    }
    
    .media-image {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    
    .media-caption {
      font-size: 10px;
      color: #6b7280;
      margin-top: 5px;
      text-align: left;
    }
    
    .recommendations {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
    }
    
    .recommendations-title {
      font-weight: bold;
      color: #0369a1;
      margin-bottom: 10px;
    }
    
    .recommendation-item {
      margin-bottom: 8px;
      padding-left: 15px;
      position: relative;
    }
    
    .recommendation-item:before {
      content: "•";
      color: #0ea5e9;
      position: absolute;
      left: 0;
    }
    
    .cost-summary {
      background: #fffbeb;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
    }
    
    .cost-title {
      font-weight: bold;
      color: #92400e;
      margin-bottom: 10px;
    }
    
    .cost-breakdown {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 10px;
    }
    
    .cost-item {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .cost-total {
      font-weight: bold;
      font-size: 14px;
      border-top: 2px solid #92400e;
      padding-top: 10px;
      margin-top: 10px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    @media print {
      body { margin: 0; }
      .container { padding: 0.25in; }
      .section { break-inside: avoid; }
      .assessment-card { break-inside: avoid; }
    }
  </style>
`;

// Comprehensive report template
const COMPREHENSIVE_TEMPLATE: ReportTemplate = {
  headerTemplate: `
    <div style="text-align: center; font-size: 10px; color: #6b7280; margin-top: 10px;">
      <span>Inspection Report - Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `,
  footerTemplate: `
    <div style="text-align: center; font-size: 10px; color: #6b7280; margin-bottom: 10px;">
      <span>Generated on <span class="date"></span> | Professional Field Inspection Services</span>
    </div>
  `,
  styles: BASE_STYLES,
  generateHtml: (data: ReportData) => {
    const { report, client, inspectionRequest, assetAssessments, wearTearAssessments, appraisalReports, media } = data;
    
    // Format currency values
    const formatCurrency = (value: string | null | undefined) => {
      if (!value) return 'N/A';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(Number(value));
    };

    // Format dates
    const formatDate = (date: string | Date | null | undefined) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Get condition badge class
    const getConditionClass = (condition: string) => {
      return `condition-${condition?.toLowerCase() || 'unknown'}`;
    };

    // Get wear level badge class
    const getWearLevelClass = (level: string) => {
      return `wear-level-${level?.toLowerCase()?.replace(' ', '-') || 'unknown'}`;
    };

    // Get priority class
    const getPriorityClass = (priority: string) => {
      return `priority-${priority?.toLowerCase() || 'medium'}`;
    };

    // Calculate total estimated costs
    const calculateTotalCosts = () => {
      let totalRepairCost = 0;
      let totalReplacementCost = 0;
      let totalMaintenanceCost = 0;
      
      assetAssessments.forEach(assessment => {
        if (assessment.estimatedRepairCost) {
          totalRepairCost += Number(assessment.estimatedRepairCost);
        }
      });

      wearTearAssessments.forEach(assessment => {
        if (assessment.replacementCost) {
          totalReplacementCost += Number(assessment.replacementCost);
        }
        if (assessment.maintenanceCost) {
          totalMaintenanceCost += Number(assessment.maintenanceCost);
        }
      });

      return {
        repair: totalRepairCost,
        replacement: totalReplacementCost,
        maintenance: totalMaintenanceCost,
        total: totalRepairCost + totalReplacementCost + totalMaintenanceCost
      };
    };

    const costs = calculateTotalCosts();

    return `
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="company-logo">Professional Field Inspection Services</div>
          <div class="report-title">${report.title || 'Comprehensive Inspection Report'}</div>
          <div class="report-subtitle">Report ID: ${report.id}</div>
        </div>

        <!-- Executive Summary -->
        <div class="section">
          <div class="section-title">Executive Summary</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Client</div>
              <div class="info-value">${client.name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Report Status</div>
              <div class="info-value">${report.status?.toUpperCase()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Generated Date</div>
              <div class="info-value">${formatDate(report.generatedAt)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Report Type</div>
              <div class="info-value">${report.reportType?.replace('_', ' ').toUpperCase()}</div>
            </div>
          </div>
          ${report.executiveSummary ? `<p>${report.executiveSummary}</p>` : ''}
        </div>

        <!-- Asset Information -->
        <div class="section">
          <div class="section-title">Asset Information</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Asset Type</div>
              <div class="info-value">${inspectionRequest.assetType}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Inspection Type</div>
              <div class="info-value">${inspectionRequest.inspectionType?.replace('_', ' ')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Priority Level</div>
              <div class="info-value">
                <span class="condition-badge ${getPriorityClass(inspectionRequest.priority)}">${inspectionRequest.priority?.toUpperCase()}</span>
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">Estimated Value</div>
              <div class="info-value">${formatCurrency(inspectionRequest.estimatedValue)}</div>
            </div>
          </div>
          ${inspectionRequest.assetDescription ? `<p><strong>Description:</strong> ${inspectionRequest.assetDescription}</p>` : ''}
        </div>

        <!-- Asset Condition Assessments -->
        ${assetAssessments.length > 0 ? `
        <div class="section">
          <div class="section-title">Asset Condition Assessments</div>
          ${assetAssessments.map(assessment => `
            <div class="assessment-card">
              <div class="assessment-header">
                <div class="assessment-title">${assessment.assetType} - ${assessment.assetDescription || 'Assessment'}</div>
                <span class="condition-badge ${getConditionClass(assessment.overallCondition)}">${assessment.overallCondition?.toUpperCase()}</span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Condition Score</div>
                  <div class="info-value">${assessment.conditionScore || 'N/A'}/100</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Structural Integrity</div>
                  <div class="info-value">${assessment.structuralIntegrity || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Functional Status</div>
                  <div class="info-value">${assessment.functionalStatus || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Safety Compliance</div>
                  <div class="info-value">${assessment.safetyCompliance || 'N/A'}</div>
                </div>
              </div>
              ${assessment.recommendedActions ? `<p><strong>Recommended Actions:</strong> ${assessment.recommendedActions}</p>` : ''}
              ${assessment.estimatedRepairCost ? `<p><strong>Estimated Repair Cost:</strong> ${formatCurrency(assessment.estimatedRepairCost)}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Wear and Tear Analysis -->
        ${wearTearAssessments.length > 0 ? `
        <div class="section">
          <div class="section-title">Wear and Tear Analysis</div>
          ${wearTearAssessments.map(assessment => `
            <div class="assessment-card">
              <div class="assessment-header">
                <div class="assessment-title">${assessment.componentType} - ${assessment.componentDescription || 'Component'}</div>
                <span class="condition-badge ${getWearLevelClass(assessment.wearLevel)}">${assessment.wearLevel?.toUpperCase()}</span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Wear Percentage</div>
                  <div class="info-value">${assessment.wearPercentage || 'N/A'}%</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Expected Life Remaining</div>
                  <div class="info-value">${assessment.expectedLifeRemaining || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Replacement Priority</div>
                  <div class="info-value">
                    <span class="condition-badge ${getPriorityClass(assessment.replacementPriority)}">${assessment.replacementPriority?.toUpperCase()}</span>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-label">Environmental Factors</div>
                  <div class="info-value">${assessment.environmentalFactors || 'N/A'}</div>
                </div>
              </div>
              ${assessment.replacementCost ? `<p><strong>Replacement Cost:</strong> ${formatCurrency(assessment.replacementCost)}</p>` : ''}
              ${assessment.maintenanceCost ? `<p><strong>Maintenance Cost:</strong> ${formatCurrency(assessment.maintenanceCost)}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Appraisal Reports -->
        ${appraisalReports.length > 0 ? `
        <div class="section">
          <div class="section-title">Asset Appraisal</div>
          ${appraisalReports.map(appraisal => `
            <div class="assessment-card">
              <div class="assessment-header">
                <div class="assessment-title">${appraisal.assetType} Appraisal</div>
                <span class="condition-badge condition-good">${appraisal.appraisalMethod?.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Current Market Value</div>
                  <div class="info-value">${formatCurrency(appraisal.currentMarketValue)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Replacement Cost</div>
                  <div class="info-value">${formatCurrency(appraisal.replacementCost)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Depreciation</div>
                  <div class="info-value">${formatCurrency(appraisal.depreciation)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Salvage Value</div>
                  <div class="info-value">${formatCurrency(appraisal.salvageValue)}</div>
                </div>
              </div>
              ${appraisal.appraiserNotes ? `<p><strong>Appraiser Notes:</strong> ${appraisal.appraiserNotes}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Media Documentation -->
        ${media.images.length > 0 ? `
        <div class="section">
          <div class="section-title">Photographic Documentation</div>
          <div class="media-gallery">
            ${media.images.slice(0, 12).map(image => `
              <div class="media-item">
                <img src="${image.originalUrl}" alt="Inspection Photo" class="media-image" />
                <div class="media-caption">${image.notes || `Photo captured at ${formatDate(image.capturedAt)}`}</div>
              </div>
            `).join('')}
          </div>
          ${media.images.length > 12 ? `<p><em>Additional ${media.images.length - 12} photos available in digital format.</em></p>` : ''}
        </div>
        ` : ''}

        <!-- Cost Summary -->
        ${costs.total > 0 ? `
        <div class="section">
          <div class="section-title">Cost Summary</div>
          <div class="cost-summary">
            <div class="cost-title">Estimated Costs Breakdown</div>
            <div class="cost-breakdown">
              <div class="cost-item">
                <span>Repair Costs:</span>
                <span>${formatCurrency(costs.repair.toString())}</span>
              </div>
              <div class="cost-item">
                <span>Replacement Costs:</span>
                <span>${formatCurrency(costs.replacement.toString())}</span>
              </div>
              <div class="cost-item">
                <span>Maintenance Costs:</span>
                <span>${formatCurrency(costs.maintenance.toString())}</span>
              </div>
              <div class="cost-item cost-total">
                <span>Total Estimated Cost:</span>
                <span>${formatCurrency(costs.total.toString())}</span>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Recommendations -->
        ${report.recommendations ? `
        <div class="section">
          <div class="section-title">Recommendations</div>
          <div class="recommendations">
            <div class="recommendations-title">Professional Recommendations</div>
            <div class="recommendation-item">${report.recommendations}</div>
          </div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p>This report was generated by Professional Field Inspection Services.</p>
          <p>For questions about this report, please contact your assigned coordinator.</p>
          <p>Report generated on ${formatDate(new Date())} | Confidential and proprietary</p>
        </div>
      </div>
    `;
  }
};

export class PdfGenerator {
  private templates: { [key: string]: ReportTemplate } = {
    comprehensive: COMPREHENSIVE_TEMPLATE,
    condition_only: COMPREHENSIVE_TEMPLATE,
    wear_tear_only: COMPREHENSIVE_TEMPLATE,
    appraisal_only: COMPREHENSIVE_TEMPLATE
  };

  async generateReportPdf(reportId: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    let browser;
    try {
      // Fetch report data
      const report = await storage.getInspectionReport(reportId);
      if (!report) {
        return { success: false, error: 'Report not found' };
      }

      // Get report data aggregation
      const reportData = await this.getReportData(report);
      if (!reportData) {
        return { success: false, error: 'Failed to fetch report data' };
      }

      // Generate HTML content
      const template = this.templates[report.reportType] || this.templates.comprehensive;
      const htmlContent = this.generateHtmlReport(reportData, template);

      // Generate actual PDF using Puppeteer
      const fileName = `report_${reportId}_${Date.now()}.pdf`;
      const filePath = path.join('uploads', fileName);
      
      // Ensure uploads directory exists
      if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads', { recursive: true });
      }

      // Launch Puppeteer browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      
      // Set page content and generate PDF
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
          right: '0.5in'
        }
      });

      return { 
        success: true, 
        filePath: filePath 
      };

    } catch (error: any) {
      console.error('PDF generation error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async getReportData(report: InspectionReport): Promise<ReportData | null> {
    try {
      const [client, inspectionRequest] = await Promise.all([
        storage.getClient(report.clientId),
        storage.getInspectionRequest(report.inspectionRequestId)
      ]);

      if (!client || !inspectionRequest) {
        return null;
      }

      // Get assessment data
      const [assetAssessments, wearTearAssessments, appraisalReports] = await Promise.all([
        storage.getAssetAssessmentsByInspectionRequest(report.inspectionRequestId),
        storage.getWearTearAssessmentsByInspectionRequest(report.inspectionRequestId),
        storage.getAppraisalReportsByInspectionRequest(report.inspectionRequestId)
      ]);

      // Get calls and media
      const aggregatedData = await storage.getReportDataForInspectionRequest(report.inspectionRequestId);

      return {
        report,
        client,
        inspectionRequest,
        calls: aggregatedData.calls,
        assetAssessments,
        wearTearAssessments,
        appraisalReports,
        media: aggregatedData.media
      };

    } catch (error) {
      console.error('Error fetching report data:', error);
      return null;
    }
  }

  private generateHtmlReport(data: ReportData, template: ReportTemplate): string {
    const htmlContent = template.generateHtml(data);
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.report.title} - Inspection Report</title>
        ${template.styles}
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
  }

  // Method to get available templates
  getAvailableTemplates(): string[] {
    return Object.keys(this.templates);
  }

  // Method to preview report HTML (for frontend preview)
  async generateReportPreview(reportId: string): Promise<{ success: boolean; html?: string; error?: string }> {
    try {
      const report = await storage.getInspectionReport(reportId);
      if (!report) {
        return { success: false, error: 'Report not found' };
      }

      const reportData = await this.getReportData(report);
      if (!reportData) {
        return { success: false, error: 'Failed to fetch report data' };
      }

      const template = this.templates[report.reportType] || this.templates.comprehensive;
      const htmlContent = this.generateHtmlReport(reportData, template);

      return { success: true, html: htmlContent };

    } catch (error: any) {
      console.error('Report preview error:', error);
      return { success: false, error: error.message };
    }
  }
}

export const pdfGenerator = new PdfGenerator();