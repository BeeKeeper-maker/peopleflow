import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-hover text-muted-foreground",
                primary: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                secondary: "bg-card text-muted-foreground border border-border",
                success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                danger: "bg-red-500/20 text-red-400 border border-red-500/30",
                info: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
                outline: "bg-transparent text-muted-foreground border border-border",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
    dot?: boolean;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant, dot, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(badgeVariants({ variant }), className)}
                {...props}
            >
                {dot && (
                    <span
                        className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            {
                                "bg-muted-foreground": variant === "default" || !variant,
                                "bg-blue-400": variant === "primary",
                                "bg-tertiary-foreground": variant === "secondary" || variant === "outline",
                                "bg-emerald-400": variant === "success",
                                "bg-amber-400": variant === "warning",
                                "bg-red-400": variant === "danger",
                                "bg-cyan-400": variant === "info",
                            }
                        )}
                    />
                )}
                {children}
            </div>
        );
    }
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
