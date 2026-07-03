/**
 * PeopleFlow AI Resume Parser
 *
 * Parses resume text to extract structured candidate information:
 *   - Name (first/last)
 *   - Email
 *   - Phone
 *   - Skills (comma-separated)
 *   - Years of experience
 *   - Current/most recent job title
 *   - Current/most recent company
 *   - Education (highest degree)
 *   - LinkedIn URL
 *   - Portfolio URL
 *
 * This is a rule-based parser (not ML-based) for production use:
 *   - No external API dependency (works offline)
 *   - No privacy concerns (resume text never leaves the server)
 *   - Fast (regex + heuristics, <1ms per resume)
 *   - Accurate for Bangladesh job market resumes (English format)
 *
 * For future enhancement: integrate with an LLM API for complex resumes
 * that the rule-based parser can't handle (unusual formats, Bengali text).
 */

export interface ParsedResume {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    skills: string[];
    yearsOfExperience: number | null;
    currentTitle: string | null;
    currentCompany: string | null;
    education: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    confidence: number; // 0-1, how confident the parser is
    warnings: string[];
}

// ── Known Skills Database ────────────────────────────────────────────

const SKILLS_DB = [
    // Programming
    "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "PHP", "Ruby", "Go", "Rust", "Kotlin", "Swift",
    "Dart", "Scala", "R", "MATLAB", "Perl", "Objective-C", "Shell", "Bash", "PowerShell",
    // Frontend
    "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "jQuery", "Bootstrap", "Tailwind", "Material UI",
    "Redux", "Zustand", "MobX", "Webpack", "Vite", "HTML", "CSS", "SCSS", "SASS", "LESS",
    // Backend
    "Node.js", "Express", "NestJS", "Django", "Flask", "FastAPI", "Spring", "Spring Boot", "Laravel",
    "Rails", "ASP.NET", ".NET Core", "GraphQL", "REST", "gRPC", "WebSocket", "Socket.io",
    // Database
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Oracle", "SQL Server", "DynamoDB",
    "Elasticsearch", "Cassandra", "Firebase", "Supabase", "Prisma", "TypeORM", "Sequelize",
    // DevOps & Cloud
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "Jenkins", "GitLab CI", "GitHub Actions",
    "Terraform", "Ansible", "Nginx", "Apache", "Linux", "Ubuntu", "CentOS",
    // Mobile
    "React Native", "Flutter", "iOS", "Android", "Xamarin", "Ionic", "PWA",
    // Tools
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence", "Figma", "Adobe XD",
    "Postman", "Swagger", "Jest", "Vitest", "Cypress", "Playwright", "Selenium",
    // Data & AI
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn",
    "Data Science", "Data Analysis", "Power BI", "Tableau", "Excel", "ETL",
    // Business
    "Project Management", "Agile", "Scrum", "Kanban", "PMP", "Product Management",
    "Digital Marketing", "SEO", "Content Marketing", "Social Media", "Google Analytics",
    // Design
    "UI/UX", "Graphic Design", "Photoshop", "Illustrator", "After Effects", "Premiere Pro",
    // Office
    "Microsoft Office", "MS Excel", "MS Word", "PowerPoint", "Google Workspace",
    // Bangladesh-specific
    "Bengali", "English", "IELTS", "TOEFL", "Bangla", "টাইপিং",
];

// ── Education Keywords ───────────────────────────────────────────────

const EDUCATION_PATTERNS = [
    { regex: /(?:Ph\.?D|Doctorate|Doctor of Philosophy)[^.\n]*/i, degree: "PhD" },
    { regex: /(?:M\.?Tech|M\.?Sc|Masters?|M\.?A|M\.?Com|MBA|M\.?Eng)[^.\n]*/i, degree: "Masters" },
    { regex: /(?:B\.?Tech|B\.?Sc|Bachelors?|B\.?A|B\.?Com|BBA|B\.?Eng|BSS|HSC|SSC)[^.\n]*/i, degree: "Bachelors" },
    { regex: /(?:Diploma|Polytechnic)[^.\n]*/i, degree: "Diploma" },
    { regex: /(?:HSC|Higher Secondary|Intermediate)[^.\n]*/i, degree: "HSC" },
    { regex: /(?:SSC|Secondary)[^.\n]*/i, degree: "SSC" },
];

// ── Main Parser ──────────────────────────────────────────────────────

/**
 * Parse resume text and extract structured candidate information.
 *
 * @param text  The full text content of the resume (from PDF/DOCX/TXT)
 * @returns     ParsedResume with extracted fields + confidence score
 */
export function parseResume(text: string): ParsedResume {
    const warnings: string[] = [];
    let confidence = 0;
    const maxConfidence = 10; // 10 fields, each adds 0.1

    // 1. Email
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const email = emailMatch?.[0] || "";
    if (email) confidence += 0.1;

    // 2. Phone (Bangladesh format: +8801XXXXXXXXX or 01XXXXXXXXX)
    const phoneMatch = text.match(/(?:\+?880|0)1[3-9]\d{8}/);
    const phone = phoneMatch?.[0] || "";
    if (phone) confidence += 0.1;

    // 3. Name (first 1-3 lines, skip if it looks like an email/phone)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let name = "";
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        // Skip lines that are too short, too long, or look like contact info
        if (line.length < 3 || line.length > 50) continue;
        if (line.includes("@") || line.match(/^\+?\d/)) continue;
        if (line.match(/^(resume|cv|curriculum)/i)) continue;
        if (line.match(/^(address|phone|email|contact|mobile)/i)) continue;

        // Check if it looks like a name (2-4 words, mostly alphabetic)
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Za-z.'-]+$/.test(w))) {
            name = line;
            break;
        }
    }

    const nameParts = name.split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    if (firstName) confidence += 0.1;

    // 4. Skills
    const skills = extractSkills(text);
    if (skills.length > 0) confidence += 0.1;

    // 5. Years of Experience
    const yearsExp = extractYearsOfExperience(text);
    if (yearsExp !== null) confidence += 0.1;

    // 6. Current Job Title
    const currentTitle = extractCurrentTitle(text);
    if (currentTitle) confidence += 0.1;

    // 7. Current Company
    const currentCompany = extractCurrentCompany(text);
    if (currentCompany) confidence += 0.1;

    // 8. Education
    const education = extractEducation(text);
    if (education) confidence += 0.1;

    // 9. LinkedIn
    const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[\w-]+\/?/i);
    const linkedinUrl = linkedinMatch?.[0] || null;
    if (linkedinUrl) confidence += 0.1;

    // 10. Portfolio/GitHub
    const portfolioMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|behance\.net|dribbble\.com|[\w-]+\.[a-z]{2,}\/portfolio)\/[\w-]+\/?/i);
    const portfolioUrl = portfolioMatch?.[0] || null;
    if (portfolioUrl) confidence += 0.1;

    // Warnings for missing critical fields
    if (!firstName) warnings.push("Could not extract candidate name");
    if (!email) warnings.push("Could not extract email address");
    if (!phone) warnings.push("Could not extract phone number");
    if (skills.length === 0) warnings.push("Could not extract any skills");

    return {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone.startsWith("+") ? phone : phone.startsWith("880") ? `+${phone}` : phone.startsWith("01") ? `+880${phone.slice(1)}` : phone,
        skills,
        yearsOfExperience: yearsExp,
        currentTitle,
        currentCompany,
        education,
        linkedinUrl,
        portfolioUrl,
        confidence: Math.min(confidence, 1),
        warnings,
    };
}

// ── Skill Extraction ─────────────────────────────────────────────────

function extractSkills(text: string): string[] {
    const found = new Set<string>();
    const textLower = text.toLowerCase();

    for (const skill of SKILLS_DB) {
        // Match as whole word (case-insensitive)
        const regex = new RegExp(`\\b${skill.replace(/[.+*?^$()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(text)) {
            found.add(skill);
        }
    }

    // Also check "Skills:" section if present
    const skillsSection = text.match(/(?:technical\s+)?skills?\s*:?\s*\n([\s\S]*?)(?:\n\n|\n[A-Z]|\nExperience|\nEducation|\nWork)/i);
    if (skillsSection) {
        const sectionText = skillsSection[1];
        // Extract comma or bullet separated items
        const items = sectionText.split(/[,\n•·\-|]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 40);
        for (const item of items) {
            // Add if it looks like a skill (not a sentence)
            if (item.split(/\s+/).length <= 3 && /^[A-Za-z0-9#./+ -]+$/.test(item)) {
                found.add(item);
            }
        }
    }

    return Array.from(found).slice(0, 20); // Cap at 20 skills
}

// ── Years of Experience ──────────────────────────────────────────────

function extractYearsOfExperience(text: string): number | null {
    // Pattern 1: "X years of experience"
    const match1 = text.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*years?\s*(?:of)?\s*(?:experience|exp|professional)/i);
    if (match1) return parseFloat(match1[1]);

    // Pattern 2: "Experience: X years"
    const match2 = text.match(/experience\s*:?\s*(\d+(?:\.\d+)?)\s*years?/i);
    if (match2) return parseFloat(match2[1]);

    // Pattern 3: "X+ years"
    const match3 = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*years?/i);
    if (match3) return parseFloat(match3[1]);

    return null;
}

// ── Current Job Title ────────────────────────────────────────────────

function extractCurrentTitle(text: string): string | null {
    // Look for common job title patterns near "Experience" or "Work" sections
    const titlePatterns = [
        /(?:current|present)\s*(?:position|title|role)\s*:?\s*([^\n]{3,50})/i,
        /(?:working as|currently\s+working as)\s+(?:a|an)?\s*([^\n,.]{3,50})/i,
        /(?:position|title|designation)\s*:?\s*([^\n]{3,50})/i,
    ];

    for (const pattern of titlePatterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const title = match[1].trim();
            // Validate: not too long, not a sentence
            if (title.split(/\s+/).length <= 5 && title.length > 3) {
                return title;
            }
        }
    }

    // Fallback: look for common job titles in the text
    const commonTitles = [
        "Software Engineer", "Senior Software Engineer", "Lead Software Engineer",
        "Frontend Developer", "Backend Developer", "Full Stack Developer", "Full-Stack Developer",
        "Mobile Developer", "iOS Developer", "Android Developer",
        "Data Scientist", "Data Analyst", "Data Engineer",
        "DevOps Engineer", "Site Reliability Engineer", "Cloud Engineer",
        "Product Manager", "Project Manager", "Program Manager",
        "UI/UX Designer", "Graphic Designer", "Web Designer",
        "QA Engineer", "Test Engineer", "Automation Engineer",
        "HR Manager", "HR Executive", "Recruiter", "Talent Acquisition",
        "Accountant", "Finance Manager", "Financial Analyst",
        "Marketing Executive", "Digital Marketing Specialist", "SEO Specialist",
        "Sales Executive", "Sales Manager", "Business Development Executive",
        "Operations Manager", "Operations Executive",
        "CEO", "CTO", "CFO", "COO", "CIO",
        "Managing Director", "General Manager", "Branch Manager",
        "Teacher", "Lecturer", "Professor", "Instructor",
        "Nurse", "Doctor", "Pharmacist", "Medical Officer",
        "Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Architect",
    ];

    for (const title of commonTitles) {
        if (text.includes(title)) return title;
    }

    return null;
}

// ── Current Company ──────────────────────────────────────────────────

function extractCurrentCompany(text: string): string | null {
    // Look for "Company: X" or "Organization: X" or "Employer: X"
    const patterns = [
        /(?:current\s+)?(?:company|organization|employer|firm)\s*:?\s*([^\n]{3,50})/i,
        /(?:working at|currently at)\s+([^\n,.]{3,50})/i,
        /(?:employed at)\s+([^\n,.]{3,50})/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const company = match[1].trim();
            if (company.length > 2 && company.split(/\s+/).length <= 5) {
                return company;
            }
        }
    }

    return null;
}

// ── Education ────────────────────────────────────────────────────────

function extractEducation(text: string): string | null {
    // Find the "Education" section
    const eduSection = text.match(/education\s*:?\s*\n([\s\S]*?)(?:\n\n|\n[A-Z]|\nSkills|\nExperience|\nCertification|$)/i);
    if (eduSection) {
        const sectionText = eduSection[1].trim().split(/\n/)[0]; // First line of education section
        if (sectionText.length > 3) return sectionText.trim();
    }

    // Fallback: search for degree keywords anywhere
    for (const pattern of EDUCATION_PATTERNS) {
        const match = text.match(pattern.regex);
        if (match?.[0]) {
            return match[0].trim().substring(0, 100); // Cap length
        }
    }

    return null;
}

// ── Helper: Merge parsed data into candidate form ────────────────────

/**
 * Merge parsed resume data into a candidate creation form payload.
 * Only fills in fields that were successfully extracted.
 */
export function mergeParsedResume(
    parsed: ParsedResume,
    existing: Record<string, unknown>,
): Record<string, unknown> {
    return {
        ...existing,
        ...(parsed.firstName && { firstName: parsed.firstName }),
        ...(parsed.lastName && { lastName: parsed.lastName }),
        ...(parsed.email && { email: parsed.email }),
        ...(parsed.phone && { phone: parsed.phone }),
        ...(parsed.skills.length > 0 && { skills: parsed.skills.join(", ") }),
        ...(parsed.yearsOfExperience !== null && { yearsOfExp: parsed.yearsOfExperience }),
        ...(parsed.currentTitle && { currentTitle: parsed.currentTitle }),
        ...(parsed.currentCompany && { currentCompany: parsed.currentCompany }),
        ...(parsed.education && { education: parsed.education }),
        ...(parsed.linkedinUrl && { linkedinUrl: parsed.linkedinUrl }),
        ...(parsed.portfolioUrl && { portfolioUrl: parsed.portfolioUrl }),
    };
}
