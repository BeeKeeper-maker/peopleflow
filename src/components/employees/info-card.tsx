import { cn } from "@/lib/utils";

interface InfoCardProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}

export function InfoCard({ title, icon, children, className, action }: InfoCardProps) {
    return (
        <div className={cn("rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm", className)}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {icon && <div className="text-blue-400">{icon}</div>}
                    <h3 className="font-semibold text-white">{title}</h3>
                </div>
                {action}
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

interface InfoItemProps {
    label: string;
    value?: string | number | null;
    icon?: React.ReactNode;
}

export function InfoItem({ label, value, icon }: InfoItemProps) {
    if (!value && value !== 0) return null;

    return (
        <div className="flex items-start gap-3">
            {icon && <div className="mt-1 text-white/40 h-4 w-4 shrink-0">{icon}</div>}
            <div>
                <p className="text-xs font-medium text-white/40">{label}</p>
                <p className="text-sm text-white font-medium break-all">{value}</p>
            </div>
        </div>
    );
}
