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
        <div className={cn("rounded-xl border border-card-border bg-hover p-6 backdrop-blur-sm", className)}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {icon && <div className="text-blue-400">{icon}</div>}
                    <h3 className="font-semibold text-foreground">{title}</h3>
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
            {icon && <div className="mt-1 text-tertiary-foreground h-4 w-4 shrink-0">{icon}</div>}
            <div>
                <p className="text-xs font-medium text-tertiary-foreground">{label}</p>
                <p className="text-sm text-foreground font-medium break-all">{value}</p>
            </div>
        </div>
    );
}
