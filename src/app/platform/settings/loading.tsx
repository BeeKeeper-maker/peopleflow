export default function SettingsLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white/[0.04]" />
                <div className="space-y-2">
                    <div className="h-6 w-48 rounded bg-white/[0.04]" />
                    <div className="h-3 w-64 rounded bg-white/[0.04]" />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 rounded-xl bg-white/[0.04]" />
                ))}
            </div>
            <div className="h-96 rounded-xl bg-white/[0.04]" />
        </div>
    );
}
