import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0A0A0F] to-[#1A1A2E] flex items-center justify-center p-4">
            <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                    <FileQuestion className="h-12 w-12 text-blue-400" />
                </div>

                <h1 className="text-8xl font-bold text-white mb-4">404</h1>

                <h2 className="text-2xl font-semibold text-white mb-2">
                    Page Not Found
                </h2>

                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    Please check the URL or navigate back to a known page.
                </p>

                <div className="flex gap-4 justify-center">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                        <Home className="h-5 w-5" />
                        Go to Dashboard
                    </Link>

                    <button
                        onClick={() => window.history.back()}
                        className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Go Back
                    </button>
                </div>

                <div className="mt-12 text-gray-500 text-sm">
                    <p>PeopleFlow HRMS</p>
                </div>
            </div>
        </div>
    );
}
