/**
 * Bengali (বাংলা) Translations
 * 
 * Enterprise-grade i18n support for PeopleFlow HRMS
 */

export type Locale = "en" | "bn";

export interface Translations {
    common: {
        search: string;
        save: string;
        cancel: string;
        delete: string;
        edit: string;
        add: string;
        view: string;
        loading: string;
        noData: string;
        confirm: string;
        actions: string;
        status: string;
        date: string;
        time: string;
        from: string;
        to: string;
        total: string;
        submit: string;
        approve: string;
        reject: string;
        pending: string;
        approved: string;
        rejected: string;
        active: string;
        inactive: string;
        all: string;
        filter: string;
        export: string;
        import: string;
        download: string;
        upload: string;
        refresh: string;
        back: string;
        next: string;
        previous: string;
        close: string;
        open: string;
        new: string;
        required: string;
        optional: string;
    };
    nav: {
        dashboard: string;
        employees: string;
        attendance: string;
        leaves: string;
        leaveRequests: string;
        leaveSettings: string;
        calendar: string;
        payroll: string;
        recruitment: string;
        performance: string;
        reports: string;
        departments: string;
        designations: string;
        shifts: string;
        settings: string;
        notifications: string;
        profile: string;
        logout: string;
    };
    employee: {
        title: string;
        addNew: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        department: string;
        designation: string;
        joiningDate: string;
        status: string;
        employmentType: string;
        gender: string;
        dateOfBirth: string;
        address: string;
        salary: string;
        bankDetails: string;
        documents: string;
        emergencyContact: string;
    };
    leave: {
        title: string;
        apply: string;
        leaveType: string;
        fromDate: string;
        toDate: string;
        totalDays: string;
        reason: string;
        balance: string;
        used: string;
        remaining: string;
        halfDay: string;
        fullDay: string;
    };
    attendance: {
        title: string;
        checkIn: string;
        checkOut: string;
        workingHours: string;
        overtime: string;
        late: string;
        present: string;
        absent: string;
        onLeave: string;
        holiday: string;
        weekend: string;
    };
    payroll: {
        title: string;
        salary: string;
        basic: string;
        allowances: string;
        deductions: string;
        gross: string;
        net: string;
        taxDeduction: string;
        providentFund: string;
        bonus: string;
        salarySlip: string;
    };
    errors: {
        required: string;
        invalidEmail: string;
        invalidPhone: string;
        minLength: string;
        maxLength: string;
        serverError: string;
        networkError: string;
        unauthorized: string;
        notFound: string;
    };
    messages: {
        saved: string;
        deleted: string;
        updated: string;
        confirmDelete: string;
        noResults: string;
        welcome: string;
    };
    accessibility: {
        skipToContent: string;
        mainNavigation: string;
        userMenu: string;
        closeMenu: string;
        openMenu: string;
        expandSubmenu: string;
        collapseSubmenu: string;
        notifications: string;
        searchPlaceholder: string;
        goToHome: string;
    };
}

// English translations
export const en: Translations = {
    common: {
        search: "Search",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        add: "Add",
        view: "View",
        loading: "Loading...",
        noData: "No data available",
        confirm: "Confirm",
        actions: "Actions",
        status: "Status",
        date: "Date",
        time: "Time",
        from: "From",
        to: "To",
        total: "Total",
        submit: "Submit",
        approve: "Approve",
        reject: "Reject",
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
        active: "Active",
        inactive: "Inactive",
        all: "All",
        filter: "Filter",
        export: "Export",
        import: "Import",
        download: "Download",
        upload: "Upload",
        refresh: "Refresh",
        back: "Back",
        next: "Next",
        previous: "Previous",
        close: "Close",
        open: "Open",
        new: "New",
        required: "Required",
        optional: "Optional",
    },
    nav: {
        dashboard: "Dashboard",
        employees: "Employees",
        attendance: "Attendance",
        leaves: "Leaves",
        leaveRequests: "Leave Requests",
        leaveSettings: "Leave Settings",
        calendar: "Calendar",
        payroll: "Payroll",
        recruitment: "Recruitment",
        performance: "Performance",
        reports: "Reports",
        departments: "Departments",
        designations: "Designations",
        shifts: "Shifts",
        settings: "Settings",
        notifications: "Notifications",
        profile: "Profile",
        logout: "Logout",
    },
    employee: {
        title: "Employees",
        addNew: "Add Employee",
        employeeCode: "Employee ID",
        firstName: "First Name",
        lastName: "Last Name",
        email: "Email",
        phone: "Phone",
        department: "Department",
        designation: "Designation",
        joiningDate: "Joining Date",
        status: "Status",
        employmentType: "Employment Type",
        gender: "Gender",
        dateOfBirth: "Date of Birth",
        address: "Address",
        salary: "Salary",
        bankDetails: "Bank Details",
        documents: "Documents",
        emergencyContact: "Emergency Contact",
    },
    leave: {
        title: "Leave Management",
        apply: "Apply Leave",
        leaveType: "Leave Type",
        fromDate: "From Date",
        toDate: "To Date",
        totalDays: "Total Days",
        reason: "Reason",
        balance: "Balance",
        used: "Used",
        remaining: "Remaining",
        halfDay: "Half Day",
        fullDay: "Full Day",
    },
    attendance: {
        title: "Attendance",
        checkIn: "Check In",
        checkOut: "Check Out",
        workingHours: "Working Hours",
        overtime: "Overtime",
        late: "Late",
        present: "Present",
        absent: "Absent",
        onLeave: "On Leave",
        holiday: "Holiday",
        weekend: "Weekend",
    },
    payroll: {
        title: "Payroll",
        salary: "Salary",
        basic: "Basic Salary",
        allowances: "Allowances",
        deductions: "Deductions",
        gross: "Gross Salary",
        net: "Net Salary",
        taxDeduction: "Tax Deduction",
        providentFund: "Provident Fund",
        bonus: "Bonus",
        salarySlip: "Salary Slip",
    },
    errors: {
        required: "This field is required",
        invalidEmail: "Please enter a valid email address",
        invalidPhone: "Please enter a valid phone number",
        minLength: "Must be at least {min} characters",
        maxLength: "Must be at most {max} characters",
        serverError: "Server error. Please try again later",
        networkError: "Network error. Please check your connection",
        unauthorized: "You are not authorized to perform this action",
        notFound: "The requested resource was not found",
    },
    messages: {
        saved: "Saved successfully",
        deleted: "Deleted successfully",
        updated: "Updated successfully",
        confirmDelete: "Are you sure you want to delete this?",
        noResults: "No results found",
        welcome: "Welcome back",
    },
    accessibility: {
        skipToContent: "Skip to main content",
        mainNavigation: "Main navigation",
        userMenu: "User menu",
        closeMenu: "Close menu",
        openMenu: "Open menu",
        expandSubmenu: "Expand submenu",
        collapseSubmenu: "Collapse submenu",
        notifications: "Notifications",
        searchPlaceholder: "Search employees, departments...",
        goToHome: "Go to home",
    },
};

// Bengali translations
export const bn: Translations = {
    common: {
        search: "অনুসন্ধান",
        save: "সংরক্ষণ",
        cancel: "বাতিল",
        delete: "মুছুন",
        edit: "সম্পাদনা",
        add: "যোগ করুন",
        view: "দেখুন",
        loading: "লোড হচ্ছে...",
        noData: "কোনো তথ্য নেই",
        confirm: "নিশ্চিত করুন",
        actions: "কার্যক্রম",
        status: "অবস্থা",
        date: "তারিখ",
        time: "সময়",
        from: "থেকে",
        to: "পর্যন্ত",
        total: "মোট",
        submit: "জমা দিন",
        approve: "অনুমোদন",
        reject: "প্রত্যাখ্যান",
        pending: "অপেক্ষমাণ",
        approved: "অনুমোদিত",
        rejected: "প্রত্যাখ্যাত",
        active: "সক্রিয়",
        inactive: "নিষ্ক্রিয়",
        all: "সব",
        filter: "ফিল্টার",
        export: "রপ্তানি",
        import: "আমদানি",
        download: "ডাউনলোড",
        upload: "আপলোড",
        refresh: "রিফ্রেশ",
        back: "পেছনে",
        next: "পরবর্তী",
        previous: "পূর্ববর্তী",
        close: "বন্ধ",
        open: "খুলুন",
        new: "নতুন",
        required: "আবশ্যক",
        optional: "ঐচ্ছিক",
    },
    nav: {
        dashboard: "ড্যাশবোর্ড",
        employees: "কর্মচারী",
        attendance: "উপস্থিতি",
        leaves: "ছুটি",
        leaveRequests: "ছুটির অনুরোধ",
        leaveSettings: "ছুটির সেটিংস",
        calendar: "ক্যালেন্ডার",
        payroll: "বেতন",
        recruitment: "নিয়োগ",
        performance: "পারফরম্যান্স",
        reports: "রিপোর্ট",
        departments: "বিভাগ",
        designations: "পদবী",
        shifts: "শিফট",
        settings: "সেটিংস",
        notifications: "বিজ্ঞপ্তি",
        profile: "প্রোফাইল",
        logout: "লগআউট",
    },
    employee: {
        title: "কর্মচারী",
        addNew: "কর্মচারী যোগ করুন",
        employeeCode: "কর্মী আইডি",
        firstName: "প্রথম নাম",
        lastName: "শেষ নাম",
        email: "ইমেইল",
        phone: "ফোন",
        department: "বিভাগ",
        designation: "পদবী",
        joiningDate: "যোগদানের তারিখ",
        status: "অবস্থা",
        employmentType: "নিয়োগের ধরন",
        gender: "লিঙ্গ",
        dateOfBirth: "জন্ম তারিখ",
        address: "ঠিকানা",
        salary: "বেতন",
        bankDetails: "ব্যাংক তথ্য",
        documents: "ডকুমেন্ট",
        emergencyContact: "জরুরি যোগাযোগ",
    },
    leave: {
        title: "ছুটি ব্যবস্থাপনা",
        apply: "ছুটির আবেদন",
        leaveType: "ছুটির ধরন",
        fromDate: "শুরুর তারিখ",
        toDate: "শেষ তারিখ",
        totalDays: "মোট দিন",
        reason: "কারণ",
        balance: "ব্যালেন্স",
        used: "ব্যবহৃত",
        remaining: "বাকি",
        halfDay: "অর্ধ দিন",
        fullDay: "পূর্ণ দিন",
    },
    attendance: {
        title: "উপস্থিতি",
        checkIn: "চেক ইন",
        checkOut: "চেক আউট",
        workingHours: "কর্মঘণ্টা",
        overtime: "ওভারটাইম",
        late: "দেরি",
        present: "উপস্থিত",
        absent: "অনুপস্থিত",
        onLeave: "ছুটিতে",
        holiday: "ছুটির দিন",
        weekend: "সাপ্তাহিক ছুটি",
    },
    payroll: {
        title: "বেতন",
        salary: "বেতন",
        basic: "মূল বেতন",
        allowances: "ভাতা",
        deductions: "কর্তন",
        gross: "মোট বেতন",
        net: "প্রাপ্ত বেতন",
        taxDeduction: "কর কর্তন",
        providentFund: "ভবিষ্য তহবিল",
        bonus: "বোনাস",
        salarySlip: "বেতন স্লিপ",
    },
    errors: {
        required: "এই ফিল্ডটি আবশ্যক",
        invalidEmail: "সঠিক ইমেইল ঠিকানা দিন",
        invalidPhone: "সঠিক ফোন নম্বর দিন",
        minLength: "সর্বনিম্ন {min} অক্ষর হতে হবে",
        maxLength: "সর্বোচ্চ {max} অক্ষর হতে পারে",
        serverError: "সার্ভার ত্রুটি। পরে আবার চেষ্টা করুন",
        networkError: "নেটওয়ার্ক ত্রুটি। সংযোগ পরীক্ষা করুন",
        unauthorized: "এই কাজটি করার অনুমতি নেই",
        notFound: "অনুরোধকৃত বিষয়বস্তু পাওয়া যায়নি",
    },
    messages: {
        saved: "সফলভাবে সংরক্ষিত",
        deleted: "সফলভাবে মুছে ফেলা হয়েছে",
        updated: "সফলভাবে আপডেট হয়েছে",
        confirmDelete: "আপনি কি নিশ্চিতভাবে মুছতে চান?",
        noResults: "কোনো ফলাফল পাওয়া যায়নি",
        welcome: "স্বাগতম",
    },
    accessibility: {
        skipToContent: "মূল বিষয়বস্তুতে যান",
        mainNavigation: "প্রধান নেভিগেশন",
        userMenu: "ব্যবহারকারী মেনু",
        closeMenu: "মেনু বন্ধ করুন",
        openMenu: "মেনু খুলুন",
        expandSubmenu: "সাবমেনু বড় করুন",
        collapseSubmenu: "সাবমেনু ছোট করুন",
        notifications: "বিজ্ঞপ্তি",
        searchPlaceholder: "কর্মচারী, বিভাগ অনুসন্ধান করুন...",
        goToHome: "হোমে যান",
    },
};

// Translation helper functions
const translations: Record<Locale, Translations> = { en, bn };

export function getTranslations(locale: Locale): Translations {
    return translations[locale] || en;
}

export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
    const keys = key.split(".");
    let value: unknown = translations[locale] || en;

    for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
            value = (value as Record<string, unknown>)[k];
        } else {
            return key; // Return key if translation not found
        }
    }

    if (typeof value !== "string") {
        return key;
    }

    // Replace parameters
    if (params) {
        return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
    }

    return value;
}
