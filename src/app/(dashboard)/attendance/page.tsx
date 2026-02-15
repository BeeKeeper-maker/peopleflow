"use client";

import { AttendanceDashboardCard } from "@/components/attendance/attendance-dashboard-card";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { useTranslations } from "next-intl";

export default function AttendancePage() {
    const t = useTranslations('Attendance');

    return (
        <div className="flex-1 space-y-8 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 lg:col-span-3 space-y-6">
                    <AttendanceDashboardCard />
                </div>
                <div className="col-span-4">
                    <AttendanceHistory />
                </div>
            </div>
        </div>
    );
}

