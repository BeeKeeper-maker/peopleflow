/**
 * Email Service
 * Handles sending transactional emails using Nodemailer/Resend
 */

import nodemailer from "nodemailer";
import { emailLogger } from "@/lib/logger";
import { escapeHtml } from "@/lib/sanitize";

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
    leaveApproved: (rawData: { employeeName: string; leaveType: string; dates: string }) => {
        const data = { employeeName: escapeHtml(rawData.employeeName), leaveType: escapeHtml(rawData.leaveType), dates: escapeHtml(rawData.dates) };
        return {
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
    }; },

    leaveRejected: (rawData: { employeeName: string; leaveType: string; dates: string; reason?: string }) => {
        const data = { employeeName: escapeHtml(rawData.employeeName), leaveType: escapeHtml(rawData.leaveType), dates: escapeHtml(rawData.dates), reason: rawData.reason ? escapeHtml(rawData.reason) : undefined };
        return {
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
    }; },

    expenseApproved: (rawData: { employeeName: string; title: string; amount: string }) => {
        const data = { employeeName: escapeHtml(rawData.employeeName), title: escapeHtml(rawData.title), amount: escapeHtml(rawData.amount) };
        return {
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
    }; },

    payslipReady: (rawData: { employeeName: string; month: string; year: number }) => {
        const data = { employeeName: escapeHtml(rawData.employeeName), month: escapeHtml(rawData.month), year: rawData.year };
        return {
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
    }; },

    welcomeEmployee: (rawData: { employeeName: string; loginUrl: string; tempPassword?: string }) => {
        const data = { employeeName: escapeHtml(rawData.employeeName), loginUrl: rawData.loginUrl, tempPassword: rawData.tempPassword };
        return {
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
    }; },

    passwordReset: (rawData: { userName: string; resetUrl: string }) => {
        const data = { userName: escapeHtml(rawData.userName), resetUrl: rawData.resetUrl };
        return {
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
    }; },

    employeeInvitation: (rawData: { userName: string; setupUrl: string; expiresIn?: string }) => {
        const data = {
            userName: escapeHtml(rawData.userName),
            setupUrl: rawData.setupUrl,
            expiresIn: escapeHtml(rawData.expiresIn || "24 hours"),
        };
        return {
        subject: "Welcome to PeopleFlow — Set Your Password",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2563EB, #7C3AED); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Welcome to PeopleFlow</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Hello ${data.userName},</h2>
                    <p style="color: #4b5563; line-height: 1.6;">
                        Your employee account has been created. Please set your password to activate your Employee Self-Service access.
                        This invitation link will expire in <strong>${data.expiresIn}</strong>.
                    </p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${data.setupUrl}"
                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563EB, #7C3AED); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Set Your Password
                        </a>
                    </div>
                    <div style="margin: 20px 0; padding: 15px; background: #eff6ff; border-radius: 8px;">
                        <p style="color: #1d4ed8; margin: 0; font-size: 13px;">
                            If you were not expecting this invitation, please contact your HR administrator.
                        </p>
                    </div>
                    <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">
                        Or copy this link: ${data.setupUrl}
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }; },

    employeeReactivation: (rawData: { userName: string; setupUrl: string; expiresIn?: string }) => {
        const data = {
            userName: escapeHtml(rawData.userName),
            setupUrl: rawData.setupUrl,
            expiresIn: escapeHtml(rawData.expiresIn || "24 hours"),
        };
        return {
        subject: "PeopleFlow Account Reactivated — Set Your Password",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #059669, #2563EB); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Account Reactivated</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Hello ${data.userName},</h2>
                    <p style="color: #4b5563; line-height: 1.6;">
                        Your PeopleFlow employee account has been reactivated. For your security, please set a fresh password before logging in.
                        This link will expire in <strong>${data.expiresIn}</strong>.
                    </p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${data.setupUrl}"
                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669, #2563EB); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Set New Password
                        </a>
                    </div>
                    <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">
                        Or copy this link: ${data.setupUrl}
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }; },

    verifyEmail: (rawData: { userName: string; verifyUrl: string }) => {
        const data = { userName: escapeHtml(rawData.userName), verifyUrl: rawData.verifyUrl };
        return {
        subject: "Verify Your PeopleFlow Email Address",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Verify Your Email</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Welcome to PeopleFlow, ${data.userName}</h2>
                    <p style="color: #4b5563; line-height: 1.6;">
                        Thank you for creating your PeopleFlow account. Please confirm your email address
                        to activate your workspace and keep your account secure. This link expires in <strong>24 hours</strong>.
                    </p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${data.verifyUrl}" 
                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10B981, #059669); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Verify Email Address
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                        If the button does not work, copy and paste this secure link into your browser:<br/>
                        <span style="word-break: break-all; color: #4b5563;">${data.verifyUrl}</span>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
                        If you did not create a PeopleFlow account, you can safely ignore this email.
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }; },

    trialEnding: (rawData: { userName: string; orgName: string; daysLeft: number }) => {
        const data = { userName: escapeHtml(rawData.userName), orgName: escapeHtml(rawData.orgName), daysLeft: rawData.daysLeft };
        return {
        subject: `Your PeopleFlow Trial Ends in ${data.daysLeft} Days`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">⏰ Trial Ending Soon</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Hi ${data.userName},</h2>
                    <p style="color: #4b5563;">
                        Your free trial for <strong>${data.orgName}</strong> on PeopleFlow HRMS ends in
                        <strong>${data.daysLeft} days</strong>. After the trial period, your team will lose access
                        to all premium features.
                    </p>
                    <div style="margin: 25px 0; padding: 20px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="color: #92400e; margin: 0;">
                            <strong>What happens after the trial?</strong><br/>
                            • Your data will be safely preserved for 30 days<br/>
                            • Access to HR modules will be restricted<br/>
                            • Upgrade anytime to restore full access
                        </p>
                    </div>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${process.env.NEXTAUTH_URL || 'https://hr.ailearnersbd.com'}/dashboard/settings/billing"
                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10B981, #059669); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Upgrade Now
                        </a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} PeopleFlow HRMS. All rights reserved.</p>
                </div>
            </div>
        `,
    }; },
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
