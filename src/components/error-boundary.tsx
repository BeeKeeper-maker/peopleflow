"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches React rendering errors and displays a user-friendly fallback
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        // Log error to console (in production, send to monitoring service)
        console.error("ErrorBoundary caught an error:", error, errorInfo);

        // TODO: Send to error monitoring service (Sentry, etc.)
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-linear-to-br from-background to-card flex items-center justify-center p-4">
                    <div className="bg-hover backdrop-blur-xl border border-card-border rounded-2xl p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>

                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Something went wrong
                        </h1>

                        <p className="text-muted-foreground mb-6">
                            We apologize for the inconvenience. Please try refreshing the page
                            or return to the dashboard.
                        </p>

                        {process.env.NODE_ENV === "development" && this.state.error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-left">
                                <p className="text-red-400 text-sm font-mono">
                                    {this.state.error.message}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="text-red-400/70 text-xs mt-2 overflow-auto max-h-40">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-foreground rounded-lg transition-colors"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Try Again
                            </button>

                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 px-4 py-2 bg-hover hover:bg-hover text-foreground rounded-lg transition-colors"
                            >
                                <Home className="h-4 w-4" />
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
): React.FC<P> {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}
