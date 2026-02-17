"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Clock, MapPin, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { differenceInSeconds, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface AttendanceState {
    status: 'checked-in' | 'checked-out' | 'none';
    checkInTime: string | null;
    checkOutTime: string | null;
    shiftStartTime: string | null;
    shiftEndTime: string | null;
    lateMinutes: number;
}

export function AttendanceDashboardCard() {
    const t = useTranslations('Attendance');
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [state, setState] = useState<AttendanceState>({
        status: 'none',
        checkInTime: null,
        checkOutTime: null,
        shiftStartTime: null,
        shiftEndTime: null,
        lateMinutes: 0
    });
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const fetchAttendance = useCallback(async () => {
        try {
            const res = await fetch("/api/attendance/today");
            if (res.ok) {
                const data = await res.json(); // { attendance, shift }

                if (data.attendance) {
                    if (data.attendance.checkOut) {
                        setState(prev => ({ ...prev, status: 'checked-out', checkInTime: data.attendance.checkIn, checkOutTime: data.attendance.checkOut }));
                    } else if (data.attendance.checkIn) {
                        setState(prev => ({
                            ...prev,
                            status: 'checked-in',
                            checkInTime: data.attendance.checkIn,
                            lateMinutes: data.attendance.lateMinutes
                        }));
                        // Calculate initial elapsed
                        const start = new Date(data.attendance.checkIn);
                        const now = new Date();
                        setElapsedSeconds(differenceInSeconds(now, start));
                    }
                }

                if (data.shift) {
                    setState(prev => ({
                        ...prev,
                        shiftStartTime: data.shift.startTime,
                        shiftEndTime: data.shift.endTime
                    }));
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (state.status === 'checked-in') {
            interval = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [state.status]);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    const handleCheckIn = async () => {
        try {
            setActionLoading(true);

            // Get Location
            let location = null;
            if ("geolocation" in navigator) {
                try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    location = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                } catch (e) {
                    console.warn("Geolocation failed", e);
                    addToast({ title: "Could not fetch location, checking in anyway.", type: "warning" });
                }
            }

            const res = await fetch("/api/attendance/check-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ location, source: "web" })
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg);
            }

            addToast({ title: t('checkIn') + ' ✓', type: 'success' });
            await fetchAttendance();

        } catch (error) {
            addToast({ title: error instanceof Error ? error.message : t('checkIn'), type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckOut = async () => {
        try {
            setActionLoading(true);

            // Get Location
            let location = null;
            if ("geolocation" in navigator) {
                try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });
                    location = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                } catch (e) {
                    console.warn(e);
                }
            }

            const res = await fetch("/api/attendance/check-in", { // Same route, PUT method
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ location })
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg);
            }

            addToast({ title: t('checkOut') + ' ✓', type: 'success' });
            await fetchAttendance();

        } catch (error) {
            addToast({ title: error instanceof Error ? error.message : t('checkOut'), type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="h-48 animate-pulse bg-hover rounded-xl" />;
    }

    const todayStr = format(new Date(), "EEEE, dd MMMM yyyy");

    return (
        <Card className="bg-card border-card-border text-foreground overflow-hidden relative">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary-400" />
                            {t('todaysAttendance')}
                        </h3>
                        <p className="text-muted-foreground text-sm mt-1">{todayStr}</p>
                    </div>
                    {state.status === 'checked-in' && (
                        <div className="flex flex-col items-end">
                            <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
                                ● {t('checkedIn')}
                            </Badge>
                            {state.lateMinutes > 0 && (
                                <Badge variant="outline" className="mt-2 border-amber-500/50 text-amber-500 bg-amber-500/10 text-[10px]">
                                    {t('lateBy', { minutes: state.lateMinutes })}
                                </Badge>
                            )}
                        </div>
                    )}
                    {state.status === 'checked-out' && (
                        <Badge variant="secondary" className="bg-hover text-muted-foreground">
                            {t('present')}
                        </Badge>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-hover rounded-lg p-3 border border-card-border">
                        <p className="text-xs text-tertiary-foreground mb-1">{t('checkInTime')}</p>
                        <p className="text-xl font-mono font-medium">
                            {state.checkInTime ? format(new Date(state.checkInTime), "hh:mm a") : "--:--"}
                        </p>
                    </div>
                    <div className="bg-hover rounded-lg p-3 border border-card-border">
                        <p className="text-xs text-tertiary-foreground mb-1">{t('checkOutTime')}</p>
                        <p className="text-xl font-mono font-medium">
                            {state.checkOutTime ? format(new Date(state.checkOutTime), "hh:mm a") : "--:--"}
                        </p>
                    </div>
                </div>

                {state.status === 'checked-in' && (
                    <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">{t('workingDuration')}</span>
                            <span className="font-mono text-primary-400 font-bold">{formatDuration(elapsedSeconds)}</span>
                        </div>
                        <div className="h-2 bg-hover rounded-full overflow-hidden">
                            {/* Progress bar logic could be added here based on shift duration */}
                            <div className="h-full bg-primary-500 w-1/3 animate-pulse" />
                        </div>
                    </div>
                )}

                <div className="action-area">
                    {state.status === 'none' && (
                        <Button
                            className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-700 text-foreground shadow-lg shadow-emerald-900/20"
                            onClick={handleCheckIn}
                            disabled={actionLoading}
                        >
                            {actionLoading ? t('checkingIn') : (
                                <>
                                    <MapPin className="mr-2 h-5 w-5" /> {t('checkIn')}
                                </>
                            )}
                        </Button>
                    )}

                    {state.status === 'checked-in' && (
                        <Button
                            variant="destructive"
                            className="w-full h-12 text-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50"
                            onClick={handleCheckOut}
                            disabled={actionLoading}
                        >
                            {actionLoading ? t('checkingOut') : (
                                <>
                                    <Square className="mr-2 h-5 w-5 fill-current" /> {t('checkOut')}
                                </>
                            )}
                        </Button>
                    )}

                    {state.status === 'checked-out' && (
                        <div className="text-center py-2 text-tertiary-foreground text-sm flex items-center justify-center gap-2">
                            <AlertCircle className="h-4 w-4" /> {t('dayCompleted')}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
