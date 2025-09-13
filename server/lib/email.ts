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