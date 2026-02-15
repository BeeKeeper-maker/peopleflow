/**
 * Page-level i18n translations
 * 
 * Centralized translation map for all page titles, subtitles,
 * button text, and common UI strings used across the application.
 */

// ─── Bengali Number Conversion ──────────────────────────────────────────────────

const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumber(num: number | string): string {
    return String(num).replace(/\d/g, (d) => bnDigits[parseInt(d)] || d);
}

// ─── Bengali Date Formatting ────────────────────────────────────────────────────

const bnMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const bnDays = [
    'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'
];

export function toBengaliDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    return `${toBengaliNumber(d.getDate())} ${bnMonths[d.getMonth()]} ${toBengaliNumber(d.getFullYear())}`;
}

export function toBengaliDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    const hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${toBengaliDate(d)} ${toBengaliNumber(h12)}:${toBengaliNumber(mins)} ${ampm}`;
}

export function getBengaliDayName(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return bnDays[d.getDay()];
}

// ─── Page Translation Map ───────────────────────────────────────────────────────

export type Locale = 'en' | 'bn';

interface PageText {
    title: string;
    titleBn: string;
    subtitle?: string;
    subtitleBn?: string;
}

export const pageTranslations: Record<string, PageText> = {
    // ─── Admin Pages ────────────────────────────────────────────────────────────
    employees: {
        title: "Employees",
        titleBn: "কর্মচারী",
        subtitle: "Manage your organization's workforce",
        subtitleBn: "আপনার প্রতিষ্ঠানের কর্মীবাহিনী পরিচালনা করুন",
    },
    employeesNew: {
        title: "Add New Employee",
        titleBn: "নতুন কর্মচারী যোগ করুন",
    },
    departments: {
        title: "Departments",
        titleBn: "বিভাগসমূহ",
        subtitle: "Manage your organization's departments",
        subtitleBn: "আপনার প্রতিষ্ঠানের বিভাগসমূহ পরিচালনা করুন",
    },
    departmentsNew: {
        title: "Create Department",
        titleBn: "নতুন বিভাগ তৈরি করুন",
    },
    designations: {
        title: "Designations",
        titleBn: "পদবীসমূহ",
        subtitle: "Manage job titles and designations",
        subtitleBn: "পদবী এবং উপাধি পরিচালনা করুন",
    },
    designationsNew: {
        title: "Create Designation",
        titleBn: "নতুন পদবী তৈরি করুন",
    },
    attendance: {
        title: "Attendance",
        titleBn: "উপস্থিতি",
        subtitle: "Track and manage employee attendance",
        subtitleBn: "কর্মচারীদের উপস্থিতি ট্র্যাক এবং পরিচালনা করুন",
    },
    leaveRequests: {
        title: "Leave Requests",
        titleBn: "ছুটির অনুরোধ",
        subtitle: "Review and manage employee leave requests",
        subtitleBn: "কর্মচারীদের ছুটির অনুরোধ পর্যালোচনা এবং পরিচালনা করুন",
    },
    leaveTypes: {
        title: "Leave Types",
        titleBn: "ছুটির ধরন",
        subtitle: "Configure leave types and policies",
        subtitleBn: "ছুটির ধরন এবং নীতি কনফিগার করুন",
    },
    leaveCalendar: {
        title: "Leave Calendar",
        titleBn: "ছুটির ক্যালেন্ডার",
        subtitle: "View all leaves on calendar",
        subtitleBn: "ক্যালেন্ডারে সব ছুটি দেখুন",
    },
    leaveApply: {
        title: "Apply for Leave",
        titleBn: "ছুটির জন্য আবেদন করুন",
    },
    payroll: {
        title: "Payroll",
        titleBn: "বেতন",
        subtitle: "Manage employee payroll and compensation",
        subtitleBn: "কর্মচারীদের বেতন এবং ক্ষতিপূরণ পরিচালনা করুন",
    },
    performance: {
        title: "Performance",
        titleBn: "পারফরম্যান্স",
        subtitle: "Track and manage employee performance",
        subtitleBn: "কর্মচারীদের কর্মদক্ষতা ট্র্যাক এবং পরিচালনা করুন",
    },
    recruitment: {
        title: "Recruitment",
        titleBn: "নিয়োগ",
        subtitle: "Manage job postings and applicants",
        subtitleBn: "চাকরির বিজ্ঞাপন এবং আবেদনকারী পরিচালনা করুন",
    },
    reports: {
        title: "Reports",
        titleBn: "রিপোর্ট",
        subtitle: "Generate and view reports",
        subtitleBn: "রিপোর্ট তৈরি এবং দেখুন",
    },
    settings: {
        title: "Settings",
        titleBn: "সেটিংস",
        subtitle: "Configure system settings",
        subtitleBn: "সিস্টেম সেটিংস কনফিগার করুন",
    },
    shifts: {
        title: "Shifts",
        titleBn: "শিফটসমূহ",
        subtitle: "Manage work shifts and schedules",
        subtitleBn: "কর্ম শিফট এবং সময়সূচী পরিচালনা করুন",
    },
    notifications: {
        title: "Notifications",
        titleBn: "বিজ্ঞপ্তি",
        subtitle: "View all notifications",
        subtitleBn: "সব বিজ্ঞপ্তি দেখুন",
    },
    profile: {
        title: "My Profile",
        titleBn: "আমার প্রোফাইল",
        subtitle: "View and edit your profile",
        subtitleBn: "আপনার প্রোফাইল দেখুন এবং সম্পাদনা করুন",
    },

    // ─── ESS Pages ──────────────────────────────────────────────────────────────
    essDashboard: {
        title: "My Dashboard",
        titleBn: "আমার ড্যাশবোর্ড",
    },
    essLeaves: {
        title: "My Leaves",
        titleBn: "আমার ছুটি",
        subtitle: "View and manage your leave requests",
        subtitleBn: "আপনার ছুটির অনুরোধ দেখুন এবং পরিচালনা করুন",
    },
    essAttendance: {
        title: "My Attendance",
        titleBn: "আমার উপস্থিতি",
        subtitle: "View your attendance records",
        subtitleBn: "আপনার উপস্থিতির রেকর্ড দেখুন",
    },
    essPayslips: {
        title: "My Payslips",
        titleBn: "আমার বেতন স্লিপ",
        subtitle: "View and download your payslips",
        subtitleBn: "আপনার বেতন স্লিপ দেখুন এবং ডাউনলোড করুন",
    },
    essExpenses: {
        title: "My Expenses",
        titleBn: "আমার খরচ",
        subtitle: "Submit and track expense claims",
        subtitleBn: "খরচের দাবি জমা দিন এবং ট্র্যাক করুন",
    },
    essProfile: {
        title: "My Profile",
        titleBn: "আমার প্রোফাইল",
    },

    // ─── Manager Pages ──────────────────────────────────────────────────────────
    managerDashboard: {
        title: "Manager Dashboard",
        titleBn: "ম্যানেজার ড্যাশবোর্ড",
    },
    managerTeam: {
        title: "My Team",
        titleBn: "আমার টিম",
        subtitle: "View and manage your team members",
        subtitleBn: "আপনার টিমের সদস্যদের দেখুন এবং পরিচালনা করুন",
    },
    managerApprovals: {
        title: "Approvals",
        titleBn: "অনুমোদন",
        subtitle: "Review pending approval requests",
        subtitleBn: "অপেক্ষমাণ অনুমোদনের অনুরোধ পর্যালোচনা করুন",
    },
    managerAttendance: {
        title: "Team Attendance",
        titleBn: "টিম উপস্থিতি",
        subtitle: "View your team's attendance",
        subtitleBn: "আপনার টিমের উপস্থিতি দেখুন",
    },
    managerLeaves: {
        title: "Team Leaves",
        titleBn: "টিম ছুটি",
        subtitle: "View your team's leave requests",
        subtitleBn: "আপনার টিমের ছুটির অনুরোধ দেখুন",
    },
};

// ─── Common UI Strings ──────────────────────────────────────────────────────────

export const commonUI = {
    // Buttons
    save: { en: "Save", bn: "সংরক্ষণ" },
    cancel: { en: "Cancel", bn: "বাতিল" },
    delete: { en: "Delete", bn: "মুছুন" },
    edit: { en: "Edit", bn: "সম্পাদনা" },
    add: { en: "Add", bn: "যোগ করুন" },
    create: { en: "Create", bn: "তৈরি করুন" },
    update: { en: "Update", bn: "আপডেট" },
    submit: { en: "Submit", bn: "জমা দিন" },
    confirm: { en: "Confirm", bn: "নিশ্চিত করুন" },
    close: { en: "Close", bn: "বন্ধ করুন" },
    back: { en: "Back", bn: "পিছনে" },
    next: { en: "Next", bn: "পরবর্তী" },
    previous: { en: "Previous", bn: "পূর্ববর্তী" },
    loading: { en: "Loading...", bn: "লোড হচ্ছে..." },
    noData: { en: "No data found", bn: "কোনো তথ্য পাওয়া যায়নি" },
    search: { en: "Search", bn: "অনুসন্ধান" },
    filter: { en: "Filter", bn: "ফিল্টার" },
    export: { en: "Export", bn: "এক্সপোর্ট" },
    download: { en: "Download", bn: "ডাউনলোড" },
    upload: { en: "Upload", bn: "আপলোড" },
    view: { en: "View", bn: "দেখুন" },
    viewAll: { en: "View All", bn: "সব দেখুন" },
    approve: { en: "Approve", bn: "অনুমোদন" },
    reject: { en: "Reject", bn: "প্রত্যাখ্যান" },
    pending: { en: "Pending", bn: "অপেক্ষমাণ" },
    approved: { en: "Approved", bn: "অনুমোদিত" },
    rejected: { en: "Rejected", bn: "প্রত্যাখ্যাত" },
    active: { en: "Active", bn: "সক্রিয়" },
    inactive: { en: "Inactive", bn: "নিষ্ক্রিয়" },
    actions: { en: "Actions", bn: "কার্যক্রম" },
    total: { en: "Total", bn: "মোট" },
    addEmployee: { en: "Add Employee", bn: "কর্মচারী যোগ করুন" },
    searchEmployees: { en: "Search employees...", bn: "কর্মচারী অনুসন্ধান করুন..." },
    applyLeave: { en: "Apply Leave", bn: "ছুটির আবেদন করুন" },
    checkIn: { en: "Check In", bn: "চেক ইন" },
    checkOut: { en: "Check Out", bn: "চেক আউট" },

    // Table headers
    name: { en: "Name", bn: "নাম" },
    email: { en: "Email", bn: "ইমেইল" },
    phone: { en: "Phone", bn: "ফোন" },
    department: { en: "Department", bn: "বিভাগ" },
    designation: { en: "Designation", bn: "পদবী" },
    status: { en: "Status", bn: "স্থিতি" },
    date: { en: "Date", bn: "তারিখ" },
    type: { en: "Type", bn: "ধরন" },
    from: { en: "From", bn: "থেকে" },
    to: { en: "To", bn: "পর্যন্ত" },
    days: { en: "Days", bn: "দিন" },
    reason: { en: "Reason", bn: "কারণ" },
    amount: { en: "Amount", bn: "পরিমাণ" },
    salary: { en: "Salary", bn: "বেতন" },
    joiningDate: { en: "Joining Date", bn: "যোগদানের তারিখ" },

    // Greeting
    goodMorning: { en: "Good Morning", bn: "সুপ্রভাত" },
    goodAfternoon: { en: "Good Afternoon", bn: "শুভ অপরাহ্ন" },
    goodEvening: { en: "Good Evening", bn: "শুভ সন্ধ্যা" },

    // Dashboard stat cards
    totalEmployees: { en: "Total Employees", bn: "মোট কর্মচারী" },
    presentToday: { en: "Present Today", bn: "আজ উপস্থিত" },
    onLeave: { en: "On Leave", bn: "ছুটিতে" },
    pendingRequests: { en: "Pending Requests", bn: "অপেক্ষমাণ অনুরোধ" },
    pendingApprovals: { en: "Pending Approvals", bn: "অপেক্ষমাণ অনুমোদন" },
    teamMembers: { en: "Team Members", bn: "টিম সদস্য" },
    onTime: { en: "On Time", bn: "সময়মতো" },
    late: { en: "Late", bn: "দেরিতে" },
    absent: { en: "Absent", bn: "অনুপস্থিত" },
    present: { en: "Present", bn: "উপস্থিত" },
    leaveBalance: { en: "Leave Balance", bn: "ছুটির ব্যালান্স" },
    quickActions: { en: "Quick Actions", bn: "দ্রুত কার্যক্রম" },
    recentActivity: { en: "Recent Activity", bn: "সাম্প্রতিক কার্যকলাপ" },
    upcomingEvents: { en: "Upcoming Events", bn: "আসন্ন ইভেন্ট" },
    todayAttendance: { en: "Today's Attendance", bn: "আজকের উপস্থিতি" },
    monthlyOverview: { en: "Monthly Overview", bn: "মাসিক সারসংক্ষেপ" },
    attendanceSummary: { en: "Attendance Summary", bn: "উপস্থিতি সারাংশ" },
    teamOverview: { en: "Team Overview", bn: "টিম সারসংক্ষেপ" },

    // Form labels
    firstName: { en: "First Name", bn: "প্রথম নাম" },
    lastName: { en: "Last Name", bn: "শেষ নাম" },
    dateOfBirth: { en: "Date of Birth", bn: "জন্ম তারিখ" },
    gender: { en: "Gender", bn: "লিঙ্গ" },
    address: { en: "Address", bn: "ঠিকানা" },
    city: { en: "City", bn: "শহর" },
    country: { en: "Country", bn: "দেশ" },
    password: { en: "Password", bn: "পাসওয়ার্ড" },
    description: { en: "Description", bn: "বিবরণ" },
    startDate: { en: "Start Date", bn: "শুরুর তারিখ" },
    endDate: { en: "End Date", bn: "শেষ তারিখ" },
    required: { en: "Required", bn: "আবশ্যক" },
    optional: { en: "Optional", bn: "ঐচ্ছিক" },

    // Toast messages
    savedSuccessfully: { en: "Saved successfully", bn: "সফলভাবে সংরক্ষিত" },
    deletedSuccessfully: { en: "Deleted successfully", bn: "সফলভাবে মুছে ফেলা হয়েছে" },
    updatedSuccessfully: { en: "Updated successfully", bn: "সফলভাবে আপডেট হয়েছে" },
    errorOccurred: { en: "An error occurred", bn: "একটি ত্রুটি ঘটেছে" },
    confirmDelete: { en: "Are you sure you want to delete?", bn: "আপনি কি মুছে ফেলতে চান?" },
};

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Get localized text for a page from the pageTranslations map
 */
export function getPageTitle(key: string, locale: Locale): string {
    const page = pageTranslations[key];
    if (!page) return key;
    return locale === 'bn' ? page.titleBn : page.title;
}

export function getPageSubtitle(key: string, locale: Locale): string | undefined {
    const page = pageTranslations[key];
    if (!page) return undefined;
    return locale === 'bn' ? page.subtitleBn : page.subtitle;
}

/**
 * Get localized text for a common UI string
 */
export function ui(key: keyof typeof commonUI, locale: Locale): string {
    return commonUI[key][locale];
}
