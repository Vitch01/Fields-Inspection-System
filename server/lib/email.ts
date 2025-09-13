import nodemailer from "nodemailer";
import { type EmailLog, type InspectionRequest, type Client, type User, type Call } from "@shared/schema";

interface EmailTemplate {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

interface InspectorEmailData {
  inspector: {
    name: string;
    email: string;
  };
  client: Client;
  inspectionRequest: InspectionRequest;
  callId: string;
  callJoinUrl: string;
  coordinator: User;
}

interface PackageDeliveryEmailData {
  client: Client;
  inspectionRequest: InspectionRequest;
  inspectionPackage: {
    id: string;
    title: string;
    description: string;
    accessUrl: string;
    expiresAt: Date;
    packageContents: any;
    zipFileSize: string;
  };
  coordinator: User;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    // Email configuration with fallback to console logging for development
    const emailHost = process.env.SMTP_HOST;
    const emailPort = parseInt(process.env.SMTP_PORT || "587");
    const emailUser = process.env.SMTP_USER;
    const emailPass = process.env.SMTP_PASS;
    
    this.fromEmail = process.env.FROM_EMAIL || "noreply@inspections.com";
    this.fromName = process.env.FROM_NAME || "Inspection Services";

    if (emailHost && emailUser && emailPass) {
      // Production SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    } else {
      // Development fallback - log emails to console
      console.warn("⚠️  SMTP credentials not configured. Emails will be logged to console only.");
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true
      });
    }
  }

  /**
   * Send inspector assignment email with inspection details and call link
   */
  async sendInspectorAssignmentEmail(data: InspectorEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const template = this.generateInspectorAssignmentTemplate(data);
      
      // Prepare email options
      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: data.inspector.email,
        subject: template.subject,
        text: template.bodyText,
        html: template.bodyHtml,
      };

      // Send email using nodemailer
      const result = await this.transporter.sendMail(mailOptions);
      
      // For development/testing, log the email content
      if (!process.env.SMTP_HOST) {
        console.log('📧 EMAIL SENT (Development Mode):');
        console.log('To:', data.inspector.email);
        console.log('Subject:', template.subject);
        console.log('--- EMAIL CONTENT ---');
        console.log(template.bodyText);
        console.log('--- END EMAIL ---');
      }

      console.log(`✓ Inspector assignment email sent successfully to ${data.inspector.email}, Message ID: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId || `dev-${Date.now()}`
      };
    } catch (error: any) {
      console.error("Failed to send inspector assignment email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email"
      };
    }
  }

  /**
   * Generate professional email template for inspector assignment
   */
  private generateInspectorAssignmentTemplate(data: InspectorEmailData): EmailTemplate {
    const {
      inspector,
      client,
      inspectionRequest,
      callJoinUrl,
      coordinator
    } = data;

    // Format dates
    const requestedDate = inspectionRequest.requestedDate 
      ? new Date(inspectionRequest.requestedDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'To be scheduled';

    const location = inspectionRequest.location as any;
    const address = location?.address 
      ? `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`
      : 'Address to be provided';

    const priorityText = inspectionRequest.priority.toUpperCase();
    const assetTypeText = inspectionRequest.assetType.replace('_', ' ').toUpperCase();
    const inspectionTypeText = inspectionRequest.inspectionType.replace('_', ' ').toUpperCase();

    const subject = `New Inspection Assignment - ${client.name} | ${inspectionRequest.title} [${priorityText} Priority]`;

    const bodyText = `
Dear ${inspector.name},

You have been assigned a new inspection by ${coordinator.name}. Please review the details below and join the video call when ready.

INSPECTION DETAILS:
===================
Inspection ID: ${inspectionRequest.id}
Title: ${inspectionRequest.title}
Priority: ${priorityText}
Asset Type: ${assetTypeText}
Inspection Type: ${inspectionTypeText}

CLIENT INFORMATION:
==================
Company: ${client.name}
Contact Person: ${client.contactPerson || 'Not specified'}
Email: ${client.email}
Phone: ${client.phone || 'Not provided'}

LOCATION:
=========
${address}

SCHEDULED DATE:
==============
${requestedDate}

ASSET DESCRIPTION:
=================
${inspectionRequest.assetDescription || 'Please review with client during call'}

INSPECTION DESCRIPTION:
======================
${inspectionRequest.description || 'Standard inspection as per client requirements'}

ESTIMATED VALUE:
===============
${inspectionRequest.estimatedValue ? `$${inspectionRequest.estimatedValue}` : 'To be determined'}

VIDEO CALL JOIN LINK:
====================
${callJoinUrl}

COORDINATOR CONTACT:
===================
Name: ${coordinator.name}
Email: ${coordinator.email || 'Not provided'}
Phone: ${coordinator.phone || 'Not provided'}

NEXT STEPS:
===========
1. Review all inspection details above
2. Click the video call link to join the inspection
3. Ensure you have proper equipment and tools ready
4. Contact the coordinator if you have any questions

Thank you for your professional service.

Best regards,
${this.fromName}

---
This is an automated message. Please do not reply to this email.
For assistance, contact your coordinator using the information provided above.
    `.trim();

    const bodyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inspection Assignment</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background-color: #2563eb;
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .section {
            margin-bottom: 25px;
            padding: 20px;
            background-color: #f8fafc;
            border-radius: 6px;
            border-left: 4px solid #2563eb;
        }
        .section h3 {
            margin: 0 0 15px 0;
            color: #1e40af;
            font-size: 16px;
            text-transform: uppercase;
            font-weight: bold;
        }
        .detail-row {
            margin-bottom: 8px;
        }
        .label {
            font-weight: bold;
            color: #374151;
            display: inline-block;
            width: 140px;
        }
        .value {
            color: #1f2937;
        }
        .priority-high {
            background-color: #dc2626;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
        }
        .priority-urgent {
            background-color: #991b1b;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
        }
        .priority-medium {
            background-color: #d97706;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
        }
        .priority-low {
            background-color: #059669;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
        }
        .call-button {
            display: inline-block;
            background-color: #22c55e;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            text-align: center;
            margin: 10px 0;
            font-size: 16px;
        }
        .call-button:hover {
            background-color: #16a34a;
        }
        .next-steps {
            background-color: #eff6ff;
            border: 1px solid #93c5fd;
            padding: 20px;
            border-radius: 6px;
            margin-top: 25px;
        }
        .next-steps h3 {
            color: #1e40af;
            margin: 0 0 15px 0;
        }
        .next-steps ol {
            margin: 0;
            padding-left: 20px;
        }
        .next-steps li {
            margin-bottom: 8px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Inspection Assignment</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">You have been assigned by ${coordinator.name}</p>
        </div>
        
        <p>Dear <strong>${inspector.name}</strong>,</p>
        <p>You have been assigned a new inspection. Please review the details below and join the video call when ready.</p>
        
        <div class="section">
            <h3>Inspection Details</h3>
            <div class="detail-row">
                <span class="label">Inspection ID:</span>
                <span class="value">${inspectionRequest.id}</span>
            </div>
            <div class="detail-row">
                <span class="label">Title:</span>
                <span class="value">${inspectionRequest.title}</span>
            </div>
            <div class="detail-row">
                <span class="label">Priority:</span>
                <span class="priority-${inspectionRequest.priority}">${priorityText}</span>
            </div>
            <div class="detail-row">
                <span class="label">Asset Type:</span>
                <span class="value">${assetTypeText}</span>
            </div>
            <div class="detail-row">
                <span class="label">Inspection Type:</span>
                <span class="value">${inspectionTypeText}</span>
            </div>
        </div>

        <div class="section">
            <h3>Client Information</h3>
            <div class="detail-row">
                <span class="label">Company:</span>
                <span class="value">${client.name}</span>
            </div>
            <div class="detail-row">
                <span class="label">Contact Person:</span>
                <span class="value">${client.contactPerson || 'Not specified'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Email:</span>
                <span class="value"><a href="mailto:${client.email}">${client.email}</a></span>
            </div>
            <div class="detail-row">
                <span class="label">Phone:</span>
                <span class="value">${client.phone || 'Not provided'}</span>
            </div>
        </div>

        <div class="section">
            <h3>Location & Schedule</h3>
            <div class="detail-row">
                <span class="label">Address:</span>
                <span class="value">${address}</span>
            </div>
            <div class="detail-row">
                <span class="label">Scheduled Date:</span>
                <span class="value">${requestedDate}</span>
            </div>
        </div>

        <div class="section">
            <h3>Asset Information</h3>
            <div class="detail-row">
                <span class="label">Description:</span>
                <span class="value">${inspectionRequest.assetDescription || 'Please review with client during call'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Inspection Notes:</span>
                <span class="value">${inspectionRequest.description || 'Standard inspection as per client requirements'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Estimated Value:</span>
                <span class="value">${inspectionRequest.estimatedValue ? `$${inspectionRequest.estimatedValue}` : 'To be determined'}</span>
            </div>
        </div>

        <div class="section">
            <h3>Video Call</h3>
            <p>Join the inspection video call using the link below:</p>
            <a href="${callJoinUrl}" class="call-button">Join Video Call</a>
            <p><small>Link: <a href="${callJoinUrl}">${callJoinUrl}</a></small></p>
        </div>

        <div class="section">
            <h3>Coordinator Contact</h3>
            <div class="detail-row">
                <span class="label">Name:</span>
                <span class="value">${coordinator.name}</span>
            </div>
            <div class="detail-row">
                <span class="label">Email:</span>
                <span class="value">${coordinator.email ? `<a href="mailto:${coordinator.email}">${coordinator.email}</a>` : 'Not provided'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Phone:</span>
                <span class="value">${coordinator.phone || 'Not provided'}</span>
            </div>
        </div>

        <div class="next-steps">
            <h3>Next Steps</h3>
            <ol>
                <li>Review all inspection details above</li>
                <li>Click the video call link to join the inspection</li>
                <li>Ensure you have proper equipment and tools ready</li>
                <li>Contact the coordinator if you have any questions</li>
            </ol>
        </div>

        <div class="footer">
            <p>Thank you for your professional service.</p>
            <p><strong>${this.fromName}</strong></p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p><small>This is an automated message. Please do not reply to this email.<br>
            For assistance, contact your coordinator using the information provided above.</small></p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return {
      subject,
      bodyText,
      bodyHtml
    };
  }

  /**
   * Send package delivery notification email to client
   */
  async sendPackageDeliveryEmail(data: PackageDeliveryEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const template = this.generatePackageDeliveryTemplate(data);
      
      // Prepare email options
      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: data.client.email,
        subject: template.subject,
        text: template.bodyText,
        html: template.bodyHtml,
      };

      // Send email using nodemailer
      const result = await this.transporter.sendMail(mailOptions);
      
      // For development/testing, log the email content
      if (!process.env.SMTP_HOST) {
        console.log('📧 PACKAGE DELIVERY EMAIL SENT (Development Mode):');
        console.log('To:', data.client.email);
        console.log('Subject:', template.subject);
        console.log('--- EMAIL CONTENT ---');
        console.log(template.bodyText);
        console.log('--- END EMAIL ---');
      }

      console.log(`✓ Package delivery email sent successfully to ${data.client.email}, Message ID: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId || `dev-${Date.now()}`
      };
    } catch (error: any) {
      console.error("Failed to send package delivery email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email"
      };
    }
  }

  /**
   * Generate professional email template for client package delivery
   */
  private generatePackageDeliveryTemplate(data: PackageDeliveryEmailData): EmailTemplate {
    const {
      client,
      inspectionRequest,
      inspectionPackage,
      coordinator
    } = data;

    // Format dates
    const deliveryDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const expirationDate = inspectionPackage.expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const location = inspectionRequest.location as any;
    const address = location?.address 
      ? `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`
      : 'Address on file';

    const assetTypeText = inspectionRequest.assetType.replace('_', ' ').toUpperCase();
    const inspectionTypeText = inspectionRequest.inspectionType.replace('_', ' ').toUpperCase();
    const priorityText = inspectionRequest.priority.toUpperCase();

    // Format file size
    const fileSizeMB = (parseInt(inspectionPackage.zipFileSize) / (1024 * 1024)).toFixed(1);

    // Count package contents
    const contents = inspectionPackage.packageContents || {};
    const reportCount = contents.reports?.length || 0;
    const imageCount = contents.media?.images?.length || 0;
    const videoCount = contents.media?.videos?.length || 0;
    const assessmentCount = contents.assessments?.length || 0;

    const subject = `Your Inspection Package is Ready - ${inspectionRequest.title}`;

    const bodyText = `
Dear ${client.contactPerson || client.name},

Your inspection package for "${inspectionRequest.title}" is now ready for download.

INSPECTION SUMMARY:
==================
Property/Asset: ${inspectionRequest.title}
Location: ${address}
Inspection Type: ${inspectionTypeText}
Asset Type: ${assetTypeText}
Priority: ${priorityText}
Completed Date: ${deliveryDate}

PACKAGE CONTENTS:
================
Reports: ${reportCount} file(s)
Images: ${imageCount} file(s)
Videos: ${videoCount} file(s)
Assessments: ${assessmentCount} file(s)
Package Size: ${fileSizeMB} MB

ACCESS INSTRUCTIONS:
===================
1. Click the secure access link below to view your package
2. Log into your client dashboard using your credentials
3. Navigate to the "Packages" section to access all files
4. Download individual files or the complete package as needed

Secure Access Link:
${inspectionPackage.accessUrl}

IMPORTANT NOTES:
===============
- Your package will be available until: ${expirationDate}
- All files are organized by category for easy navigation
- PDF reports include comprehensive findings and recommendations
- Contact us if you need assistance accessing your files

For any questions about your inspection results or accessing your package, please contact:

${coordinator.name}
${coordinator.email || 'Contact through your client portal'}

Thank you for choosing Professional Field Inspection Services.

Best regards,
${this.fromName}

---
This is an automated message. Please do not reply directly to this email.
For support, log into your client portal or contact your coordinator.
    `.trim();

    const bodyHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Inspection Package is Ready</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 300;">📋 Inspection Package Ready</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your comprehensive inspection results are now available</p>
        </div>

        <!-- Main Content -->
        <div style="background: #fff; border: 1px solid #ddd; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
          
          <p style="font-size: 16px; margin-bottom: 25px;">
            Dear <strong>${client.contactPerson || client.name}</strong>,
          </p>

          <p style="font-size: 16px; margin-bottom: 25px;">
            Your inspection package for "<strong>${inspectionRequest.title}</strong>" has been completed and is now ready for download. All inspection materials have been organized for easy access.
          </p>

          <!-- Inspection Summary -->
          <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📍 Inspection Summary</h3>
            <div style="display: grid; gap: 8px;">
              <div><strong>Property/Asset:</strong> ${inspectionRequest.title}</div>
              <div><strong>Location:</strong> ${address}</div>
              <div><strong>Inspection Type:</strong> ${inspectionTypeText}</div>
              <div><strong>Asset Type:</strong> ${assetTypeText}</div>
              <div><strong>Priority:</strong> <span style="color: #e74c3c; font-weight: bold;">${priorityText}</span></div>
              <div><strong>Completed:</strong> ${deliveryDate}</div>
            </div>
          </div>

          <!-- Package Contents -->
          <div style="background: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📦 Package Contents (${fileSizeMB} MB)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <div style="font-size: 24px; color: #dc3545;">📄</div>
                <div style="font-weight: bold; margin: 5px 0;">${reportCount}</div>
                <div style="font-size: 12px; color: #666;">Reports</div>
              </div>
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <div style="font-size: 24px; color: #28a745;">📸</div>
                <div style="font-weight: bold; margin: 5px 0;">${imageCount}</div>
                <div style="font-size: 12px; color: #666;">Images</div>
              </div>
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <div style="font-size: 24px; color: #007bff;">🎥</div>
                <div style="font-weight: bold; margin: 5px 0;">${videoCount}</div>
                <div style="font-size: 12px; color: #666;">Videos</div>
              </div>
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <div style="font-size: 24px; color: #ffc107;">📊</div>
                <div style="font-weight: bold; margin: 5px 0;">${assessmentCount}</div>
                <div style="font-size: 12px; color: #666;">Assessments</div>
              </div>
            </div>
          </div>

          <!-- Access Instructions -->
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 25px; border-radius: 6px; margin: 25px 0; text-align: center;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px;">🔐 Access Your Package</h3>
            <p style="margin: 0 0 20px 0; font-size: 16px;">Click the secure link below to access your inspection package</p>
            <a href="${inspectionPackage.accessUrl}" 
               style="display: inline-block; background: white; color: #28a745; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 2px solid white; transition: all 0.3s;">
              🔗 Access Package Now
            </a>
          </div>

          <!-- Instructions -->
          <div style="border-left: 4px solid #17a2b8; background: #e7f7ff; padding: 20px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #17a2b8;">💡 How to Access Your Files:</h4>
            <ol style="margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Click the secure access link above</li>
              <li style="margin-bottom: 8px;">Log into your client dashboard with your credentials</li>
              <li style="margin-bottom: 8px;">Navigate to the "Packages" section</li>
              <li style="margin-bottom: 8px;">Download individual files or the complete package</li>
            </ol>
          </div>

          <!-- Important Notes -->
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Important Information:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>Package expires: <strong>${expirationDate}</strong></li>
              <li>Files are organized by category for easy navigation</li>
              <li>PDF reports include comprehensive findings and recommendations</li>
              <li>Contact us if you need assistance accessing your files</li>
            </ul>
          </div>

          <!-- Contact Information -->
          <div style="background: #f8f9fa; border-radius: 4px; padding: 20px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #333;">👤 Your Coordinator:</h4>
            <p style="margin: 0; font-size: 16px;">
              <strong>${coordinator.name}</strong><br>
              ${coordinator.email || 'Contact through your client portal'}
            </p>
          </div>

          <p style="font-size: 16px; margin: 25px 0;">
            Thank you for choosing <strong>Professional Field Inspection Services</strong>. We're committed to providing you with comprehensive, accurate inspection results.
          </p>

          <div style="text-align: center; margin: 30px 0; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              This is an automated message. Please do not reply directly to this email.<br>
              For support, log into your client portal or contact your coordinator.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="text-align: center; margin: 20px 0; color: #666; font-size: 12px;">
          <p style="margin: 0;">Professional Field Inspection Services</p>
          <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleString()}</p>
        </div>

      </body>
      </html>
    `;

    return {
      subject,
      bodyText,
      bodyHtml
    };
  }

  /**
   * Send email notification for assignment updates
   */
  async sendAssignmentUpdateEmail(
    recipientEmail: string, 
    recipientName: string, 
    updateType: string, 
    details: any
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const subject = `Inspection Assignment Update - ${updateType}`;
      const bodyText = `Dear ${recipientName},\n\nYour inspection assignment has been updated.\n\nUpdate: ${updateType}\nDetails: ${JSON.stringify(details, null, 2)}\n\nBest regards,\n${this.fromName}`;
      const bodyHtml = `
        <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Inspection Assignment Update</h2>
          <p>Dear <strong>${recipientName}</strong>,</p>
          <p>Your inspection assignment has been updated.</p>
          <p><strong>Update:</strong> ${updateType}</p>
          <p><strong>Details:</strong></p>
          <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(details, null, 2)}</pre>
          <p>Best regards,<br>${this.fromName}</p>
        </body>
        </html>
      `;

      // Prepare email options for nodemailer
      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: recipientEmail,
        subject,
        text: bodyText,
        html: bodyHtml,
      };

      // Send email using nodemailer
      const result = await this.transporter.sendMail(mailOptions);

      // For development/testing, log the email content
      if (!process.env.SMTP_HOST) {
        console.log('📧 ASSIGNMENT UPDATE EMAIL SENT (Development Mode):');
        console.log('To:', recipientEmail);
        console.log('Subject:', subject);
        console.log('--- EMAIL CONTENT ---');
        console.log(bodyText);
        console.log('--- END EMAIL ---');
      }

      console.log(`✓ Assignment update email sent successfully to ${recipientEmail}, Message ID: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId || `dev-${Date.now()}`
      };
    } catch (error: any) {
      console.error("Failed to send assignment update email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email"
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();