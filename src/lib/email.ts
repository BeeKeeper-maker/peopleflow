/**
 * Email Service
 * Handles sending transactional emails using Nodemailer/Resend
 */

import nodemailer from "nodemailer";
import { emailLogger } from "@/lib/logger";

// Email configuration from environment
const emailConfig = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
    },
    from: process.env.SMTP_FROM || "PeopleFlow <noreply@peopleflow.app>",
};

// Create reusable transporter (lazy initialization)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: emailConfig.host,
            port: emailConfig.port,
            secure: emailConfig.secure,
            auth: emailConfig.auth,
        });
    }
    return transporter;
}

/**
 * Email templates
 */
export const emailTemplates = {
    leaveApproved: (data: { employeeName: string; leaveType: string; dates: string }) => ({
        subject: "Leave Request Approved",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">PeopleFlow HRMS</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Leave Request Approved ✅</h2>
                    <p style="color: #4b5563;">Dear ${data.employeeName},</p>
                    <p style="color: #4b5563;">
                        Your <strong>${data.leaveType}</strong> leave request for 
                        <strong>${data.dates}</strong> has been approved.
                    </p>
                    <div style="margin-top: 20px; padding: 15px; background: #ecfdf5; border-radius: 8px;">
                        <p style="color: #065f46; margin: 0;">
                            You can view your leave history in the ESS portal.
                        </p>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }),

    leaveRejected: (data: { employeeName: string; leaveType: string; dates: string; reason?: string }) => ({
        subject: "Leave Request Rejected",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">PeopleFlow HRMS</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Leave Request Rejected</h2>
                    <p style="color: #4b5563;">Dear ${data.employeeName},</p>
                    <p style="color: #4b5563;">
                        Your <strong>${data.leaveType}</strong> leave request for 
                        <strong>${data.dates}</strong> has been rejected.
                    </p>
                    ${data.reason ? `
                        <div style="margin-top: 20px; padding: 15px; background: #fef2f2; border-radius: 8px;">
                            <p style="color: #991b1b; margin: 0;"><strong>Reason:</strong> ${data.reason}</p>
                        </div>
                    ` : ""}
                    <p style="color: #4b5563; margin-top: 20px;">
                        Please contact your manager for more information.
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }),

    expenseApproved: (data: { employeeName: string; title: string; amount: string }) => ({
        subject: "Expense Claim Approved",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">PeopleFlow HRMS</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Expense Claim Approved ✅</h2>
                    <p style="color: #4b5563;">Dear ${data.employeeName},</p>
                    <p style="color: #4b5563;">
                        Your expense claim "<strong>${data.title}</strong>" for 
                        <strong>${data.amount}</strong> has been approved.
                    </p>
                    <div style="margin-top: 20px; padding: 15px; background: #ecfdf5; border-radius: 8px;">
                        <p style="color: #065f46; margin: 0;">
                            The amount will be reimbursed in the next payroll cycle.
                        </p>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }),

    payslipReady: (data: { employeeName: string; month: string; year: number }) => ({
        subject: `Payslip for ${data.month} ${data.year}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">PeopleFlow HRMS</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Your Payslip is Ready 📄</h2>
                    <p style="color: #4b5563;">Dear ${data.employeeName},</p>
                    <p style="color: #4b5563;">
                        Your salary slip for <strong>${data.month} ${data.year}</strong> is now available.
                    </p>
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/ess/payslips" 
                           style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
                            View Payslip
                        </a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }),

    welcomeEmployee: (data: { employeeName: string; loginUrl: string; tempPassword?: string }) => ({
        subject: "Welcome to PeopleFlow HRMS",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Welcome to PeopleFlow!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Hello ${data.employeeName}! 👋</h2>
                    <p style="color: #4b5563;">
                        Your account has been created in PeopleFlow HRMS. You can now access 
                        the Employee Self-Service portal to manage your profile, leaves, 
                        attendance, and more.
                    </p>
                    ${data.tempPassword ? `
                        <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-radius: 8px;">
                            <p style="color: #92400e; margin: 0;">
                                <strong>Temporary Password:</strong> ${data.tempPassword}<br/>
                                Please change this after your first login.
                            </p>
                        </div>
                    ` : ""}
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${data.loginUrl}" 
                           style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
                            Login Now
                        </a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }),

    passwordReset: (data: { userName: string; resetUrl: string }) => ({
        subject: "Reset Your PeopleFlow Password",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #EF4444, #DC2626); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🔑 Password Reset</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Hello ${data.userName},</h2>
                    <p style="color: #4b5563;">
                        We received a request to reset your password. Click the button below
                        to set a new password. This link will expire in <strong>1 hour</strong>.
                    </p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${data.resetUrl}" 
                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #EF4444, #DC2626); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Reset Password
                        </a>
                    </div>
                    <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-radius: 8px;">
                        <p style="color: #92400e; margin: 0; font-size: 13px;">
                            ⚠️ If you didn't request this password reset, please ignore this email.
                            Your account is safe.
                        </p>
                    </div>
                    <p style="color: #9ca3af; font-size: 12px;">
                        Or copy this link: ${data.resetUrl}
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }),

    verifyEmail: (data: { userName: string; verifyUrl: string }) => ({
        subject: "Verify Your PeopleFlow Email Address",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">✉️ Verify Your Email</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Welcome ${data.userName}! 🎉</h2>
                    <p style="color: #4b5563;">
                        Thank you for creating your PeopleFlow account. Please verify your
                        email address by clicking the button below. This link expires in <strong>24 hours</strong>.
                    </p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${data.verifyUrl}" 
                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10B981, #059669); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Verify Email Address
                        </a>
                    </div>
                    <p style="color: #9ca3af; font-size: 12px;">
                        Or copy this link: ${data.verifyUrl}
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }),
};
/**
 * Send an email
 */
export async function sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Skip in development if SMTP not configured
    if (!emailConfig.auth.user && process.env.NODE_ENV !== "production") {
        emailLogger.debug({ subject: options.subject }, "Skipped email (SMTP not configured)");
        return { success: true, messageId: "dev-skipped" };
    }

    try {
        const info = await getTransporter().sendMail({
            from: emailConfig.from,
            to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            attachments: options.attachments,
        });

        emailLogger.info({ subject: options.subject, to: options.to }, "Email sent");
        return { success: true, messageId: info.messageId };
    } catch (error) {
        emailLogger.error({ err: error, subject: options.subject }, "Email send failed");
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Send email using a template
 */
export async function sendTemplateEmail<T extends keyof typeof emailTemplates>(
    to: string | string[],
    templateName: T,
    data: Parameters<typeof emailTemplates[T]>[0]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = emailTemplates[templateName](data as never);
    return sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
