/**
 * PeopleFlow Document/Letter Generation Templates
 *
 * HTML templates for HR documents with dynamic data.
 * Used with PDF generation for downloadable documents.
 * 
 * ✅ All user-supplied data is HTML-escaped to prevent XSS.
 */

export type DocumentType =
    | "offer_letter"
    | "appointment_letter"
    | "experience_certificate"
    | "increment_letter"
    | "warning_letter"
    | "termination_letter"
    | "salary_certificate"
    | "noc_letter";

interface TemplateData {
    [key: string]: string | number | undefined;
}

// ✅ HTML entity escaping to prevent XSS injection
function escapeHtml(value: string | number | undefined): string {
    if (value === undefined || value === null) return "";
    const str = String(value);
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

// ✅ Safe data accessor — escapes all values before template interpolation
function safe(data: TemplateData, key: string, fallback?: string): string {
    const val = data[key];
    if (val === undefined || val === null || val === "") {
        return fallback !== undefined ? escapeHtml(fallback) : "";
    }
    return escapeHtml(val);
}

const COMMON_STYLES = `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #333; }
        .document { max-width: 800px; margin: 0 auto; padding: 50px 60px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #333; padding-bottom: 20px; }
        .header h1 { font-size: 22px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
        .header h2 { font-size: 16px; color: #666; }
        .header .address { font-size: 12px; color: #888; margin-top: 5px; }
        .ref-line { display: flex; justify-content: space-between; margin: 20px 0; font-size: 13px; }
        .subject { text-align: center; font-weight: bold; text-decoration: underline; margin: 25px 0; font-size: 16px; }
        .body p { text-align: justify; margin-bottom: 12px; }
        .body ul { margin: 12px 0 12px 30px; }
        .body li { margin-bottom: 6px; }
        .salary-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .salary-table th, .salary-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        .salary-table th { background: #f5f5f5; font-weight: bold; }
        .signature { margin-top: 60px; }
        .signature-line { display: inline-block; width: 200px; border-top: 1px solid #333; padding-top: 5px; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
    </style>
`;

// ============================================
// Document Templates (all using safe() escaping)
// ============================================

const templates: Record<DocumentType, (data: TemplateData) => string> = {
    offer_letter: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
                <div class="address">${safe(data, "orgAddress")}</div>
            </div>
            <div class="ref-line">
                <span>Ref: ${safe(data, "refNumber", "HR/OL/" + new Date().getFullYear())}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <p><strong>To:</strong> ${safe(data, "employeeName")}<br/>${safe(data, "employeeAddress")}</p>
            <div class="subject">OFFER OF EMPLOYMENT</div>
            <div class="body">
                <p>Dear ${safe(data, "employeeName")},</p>
                <p>We are pleased to offer you the position of <strong>${safe(data, "designation")}</strong> in the <strong>${safe(data, "department")}</strong> department at ${safe(data, "organizationName")}.</p>
                <p>Your compensation details are as follows:</p>
                <table class="salary-table">
                    <tr><th>Component</th><th>Amount (BDT)</th></tr>
                    <tr><td>Gross Salary</td><td>${safe(data, "grossSalary")}</td></tr>
                    <tr><td>Basic Salary</td><td>${safe(data, "basicSalary")}</td></tr>
                    <tr><td>House Rent</td><td>${safe(data, "houseRent")}</td></tr>
                    <tr><td>Medical Allowance</td><td>${safe(data, "medical")}</td></tr>
                    <tr><td>Conveyance</td><td>${safe(data, "conveyance")}</td></tr>
                </table>
                <p>Your expected date of joining is <strong>${safe(data, "joiningDate")}</strong>.</p>
                <p>This offer is valid until <strong>${safe(data, "offerValidUntil", "15 days from the date of this letter")}</strong>.</p>
                <p>Please sign and return a copy of this letter to confirm acceptance.</p>
                <p>We look forward to welcoming you to the team!</p>
            </div>
            <div class="signature">
                <p>Warm regards,</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "Authorized Signatory")}</div>
                <p>${safe(data, "signatoryDesignation", "HR Manager")}</p>
            </div>
        </div></body></html>
    `,

    appointment_letter: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
                <div class="address">${safe(data, "orgAddress")}</div>
            </div>
            <div class="ref-line">
                <span>Ref: ${safe(data, "refNumber", "HR/APT/" + new Date().getFullYear())}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <p><strong>To:</strong> ${safe(data, "employeeName")}</p>
            <div class="subject">LETTER OF APPOINTMENT</div>
            <div class="body">
                <p>Dear ${safe(data, "employeeName")},</p>
                <p>With reference to our discussions, we are pleased to appoint you as <strong>${safe(data, "designation")}</strong> in the <strong>${safe(data, "department")}</strong> department, effective from <strong>${safe(data, "joiningDate")}</strong>.</p>
                <p><strong>Terms and Conditions:</strong></p>
                <ul>
                    <li>You will be on probation for a period of ${safe(data, "probationMonths", "3")} months.</li>
                    <li>Your gross monthly salary is BDT ${safe(data, "grossSalary")}.</li>
                    <li>Working hours: ${safe(data, "workingHours", "9:00 AM to 6:00 PM, Sunday to Thursday")}.</li>
                    <li>You are entitled to ${safe(data, "leaveDays", "14")} days of annual leave.</li>
                    <li>Either party may terminate the contract with ${safe(data, "noticePeriod", "30")} days' notice.</li>
                </ul>
                <p>Please acknowledge acceptance of this appointment by signing and returning this letter.</p>
            </div>
            <div class="signature">
                <p>For ${safe(data, "organizationName")},</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "Authorized Signatory")}</div>
            </div>
        </div></body></html>
    `,

    experience_certificate: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
                <div class="address">${safe(data, "orgAddress")}</div>
            </div>
            <div class="ref-line">
                <span>Ref: ${safe(data, "refNumber", "HR/EXP/" + new Date().getFullYear())}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <div class="subject">EXPERIENCE / SERVICE CERTIFICATE</div>
            <div class="body">
                <p>To Whom It May Concern,</p>
                <p>This is to certify that <strong>${safe(data, "employeeName")}</strong> was employed at <strong>${safe(data, "organizationName")}</strong> as a <strong>${safe(data, "designation")}</strong> in the <strong>${safe(data, "department")}</strong> department from <strong>${safe(data, "joiningDate")}</strong> to <strong>${safe(data, "lastWorkingDate")}</strong>.</p>
                <p>During the tenure, ${safe(data, "pronoun", "they")} demonstrated excellent work ethic, professionalism, and dedication. ${safe(data, "pronoun", "They")} fulfilled all responsibilities associated with the role satisfactorily.</p>
                <p>We wish ${safe(data, "employeeName")} all the best in future endeavors.</p>
            </div>
            <div class="signature">
                <p>Sincerely,</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "Authorized Signatory")}</div>
                <p>${safe(data, "signatoryDesignation", "HR Manager")}</p>
            </div>
        </div></body></html>
    `,

    increment_letter: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
            </div>
            <div class="ref-line">
                <span>Ref: HR/INC/${new Date().getFullYear()}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <p><strong>To:</strong> ${safe(data, "employeeName")}<br/>${safe(data, "designation")}, ${safe(data, "department")}</p>
            <div class="subject">SALARY INCREMENT LETTER</div>
            <div class="body">
                <p>Dear ${safe(data, "employeeName")},</p>
                <p>In recognition of your valuable contributions and performance, we are pleased to inform you of your salary revision effective from <strong>${safe(data, "effectiveDate")}</strong>.</p>
                <table class="salary-table">
                    <tr><th>Detail</th><th>Amount (BDT)</th></tr>
                    <tr><td>Previous Gross Salary</td><td>${safe(data, "previousSalary")}</td></tr>
                    <tr><td>New Gross Salary</td><td>${safe(data, "newSalary")}</td></tr>
                    <tr><td>Increment Amount</td><td>${safe(data, "incrementAmount")}</td></tr>
                    <tr><td>Increment Percentage</td><td>${safe(data, "incrementPercentage")}%</td></tr>
                </table>
                <p>We appreciate your dedication and look forward to your continued excellence.</p>
            </div>
            <div class="signature">
                <p>Best regards,</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "Authorized Signatory")}</div>
            </div>
        </div></body></html>
    `,

    warning_letter: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
            </div>
            <div class="ref-line">
                <span>Ref: HR/WARN/${new Date().getFullYear()}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <p><strong>To:</strong> ${safe(data, "employeeName")}<br/>${safe(data, "designation")}, ${safe(data, "department")}</p>
            <div class="subject">WARNING LETTER</div>
            <div class="body">
                <p>Dear ${safe(data, "employeeName")},</p>
                <p>This letter serves as a <strong>${safe(data, "warningLevel", "first")} warning</strong> regarding ${safe(data, "warningReason")}.</p>
                <p><strong>Details:</strong></p>
                <p>${safe(data, "warningDetails")}</p>
                <p>You are advised to take immediate corrective action. Failure to improve may result in further disciplinary action, up to and including termination of employment.</p>
                <p>Please acknowledge receipt of this letter by signing below.</p>
            </div>
            <div class="signature">
                <p>Issued by,</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "HR Manager")}</div>
            </div>
        </div></body></html>
    `,

    termination_letter: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
            </div>
            <div class="ref-line">
                <span>Ref: HR/TERM/${new Date().getFullYear()}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <p><strong>To:</strong> ${safe(data, "employeeName")}<br/>${safe(data, "designation")}, ${safe(data, "department")}</p>
            <div class="subject">NOTICE OF TERMINATION</div>
            <div class="body">
                <p>Dear ${safe(data, "employeeName")},</p>
                <p>We regret to inform you that your employment with ${safe(data, "organizationName")} is being terminated effective <strong>${safe(data, "terminationDate")}</strong>.</p>
                <p><strong>Reason:</strong> ${safe(data, "terminationReason")}</p>
                <p><strong>Settlement Details:</strong></p>
                <ul>
                    <li>Final salary up to: ${safe(data, "lastWorkingDate")}</li>
                    <li>Leave encashment: BDT ${safe(data, "leaveEncashment", "N/A")}</li>
                    <li>Gratuity: BDT ${safe(data, "gratuity", "N/A")}</li>
                    <li>Notice period pay: BDT ${safe(data, "noticePay", "N/A")}</li>
                </ul>
                <p>Please return all company property by your last working date.</p>
            </div>
            <div class="signature">
                <p>For ${safe(data, "organizationName")},</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "Authorized Signatory")}</div>
            </div>
        </div></body></html>
    `,

    salary_certificate: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
                <div class="address">${safe(data, "orgAddress")}</div>
            </div>
            <div class="ref-line">
                <span>Ref: HR/SC/${new Date().getFullYear()}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <div class="subject">SALARY CERTIFICATE</div>
            <div class="body">
                <p>To Whom It May Concern,</p>
                <p>This is to certify that <strong>${safe(data, "employeeName")}</strong> is employed at ${safe(data, "organizationName")} as a <strong>${safe(data, "designation")}</strong> since <strong>${safe(data, "joiningDate")}</strong>.</p>
                <p>The current salary details are as follows:</p>
                <table class="salary-table">
                    <tr><th>Component</th><th>Amount (BDT)</th></tr>
                    <tr><td>Gross Salary</td><td>${safe(data, "grossSalary")}</td></tr>
                    <tr><td>Basic Salary</td><td>${safe(data, "basicSalary")}</td></tr>
                    <tr><td>Net Salary (after deductions)</td><td>${safe(data, "netSalary")}</td></tr>
                </table>
                <p>This certificate is issued upon request of the employee for ${safe(data, "purpose", "personal use")}.</p>
            </div>
            <div class="signature">
                <p>Authorized by,</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "HR Manager")}</div>
            </div>
        </div></body></html>
    `,

    noc_letter: (data) => `
        <!DOCTYPE html><html><head>${COMMON_STYLES}</head><body>
        <div class="document">
            <div class="header">
                <h1>${safe(data, "organizationName")}</h1>
                <div class="address">${safe(data, "orgAddress")}</div>
            </div>
            <div class="ref-line">
                <span>Ref: HR/NOC/${new Date().getFullYear()}</span>
                <span>Date: ${safe(data, "date")}</span>
            </div>
            <div class="subject">NO OBJECTION CERTIFICATE</div>
            <div class="body">
                <p>To Whom It May Concern,</p>
                <p>This is to certify that <strong>${safe(data, "organizationName")}</strong> has no objection to <strong>${safe(data, "employeeName")}</strong>, currently serving as <strong>${safe(data, "designation")}</strong>, for ${safe(data, "nocPurpose", "the purpose stated")}.</p>
                <p>${safe(data, "employeeName")} has been employed with us since <strong>${safe(data, "joiningDate")}</strong> and has fulfilled all obligations satisfactorily.</p>
                <p>This certificate is issued at the request of the individual and does not constitute any liability on the part of the organization.</p>
            </div>
            <div class="signature">
                <p>Authorized by,</p><br/><br/>
                <div class="signature-line">${safe(data, "signatoryName", "HR Manager")}</div>
            </div>
        </div></body></html>
    `,
};

// ============================================
// Public API
// ============================================

export function generateDocumentHTML(type: DocumentType, data: TemplateData): string {
    const templateFn = templates[type];
    if (!templateFn) {
        throw new Error(`Unknown document type: ${type}`);
    }
    return templateFn(data);
}

export function getDocumentTypes(): { value: DocumentType; label: string }[] {
    return [
        { value: "offer_letter", label: "Offer Letter" },
        { value: "appointment_letter", label: "Appointment Letter" },
        { value: "experience_certificate", label: "Experience Certificate" },
        { value: "increment_letter", label: "Increment Letter" },
        { value: "warning_letter", label: "Warning Letter" },
        { value: "termination_letter", label: "Termination Letter" },
        { value: "salary_certificate", label: "Salary Certificate" },
        { value: "noc_letter", label: "No Objection Certificate (NOC)" },
    ];
}

export function getRequiredFields(type: DocumentType): string[] {
    const commonFields = ["organizationName", "employeeName", "date"];

    const typeFields: Record<DocumentType, string[]> = {
        offer_letter: [...commonFields, "designation", "department", "grossSalary", "joiningDate"],
        appointment_letter: [...commonFields, "designation", "department", "grossSalary", "joiningDate"],
        experience_certificate: [...commonFields, "designation", "department", "joiningDate", "lastWorkingDate"],
        increment_letter: [...commonFields, "designation", "department", "previousSalary", "newSalary", "effectiveDate"],
        warning_letter: [...commonFields, "designation", "department", "warningReason", "warningDetails"],
        termination_letter: [...commonFields, "designation", "department", "terminationDate", "terminationReason"],
        salary_certificate: [...commonFields, "designation", "grossSalary", "basicSalary", "netSalary", "joiningDate"],
        noc_letter: [...commonFields, "designation", "joiningDate"],
    };

    return typeFields[type] || commonFields;
}
