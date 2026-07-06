export default function BillingLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white/[0.04]" />
                <div className="space-y-2">
                    <div className="h-6 w-48 rounded bg-white/[0.04]" />
                    <div className="h-3 w-64 rounded bg-white/[0.04]" />
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 rounded-xl bg-white/[0.04]" />
                ))}
            </div>
            <div className="h-16 rounded-xl bg-white/[0.04]" />
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="space-y-3 p-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            {Array.from({ length: 8 }).map((_, j) => (
                                <div
                                    key={j}
                                    className="h-4 rounded bg-white/[0.04]"
                                    style={{ width: `${40 + Math.random() * 40}%` }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
