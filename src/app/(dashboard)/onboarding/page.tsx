"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft, Building2, Briefcase, Clock, UserPlus, PartyPopper, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const STEPS = [
    { id: "welcome", icon: Sparkles, label: "Welcome" },
    { id: "departments", icon: Building2, label: "Departments" },
    { id: "designations", icon: Briefcase, label: "Designations" },
    { id: "shift", icon: Clock, label: "Work Shift" },
    { id: "employee", icon: UserPlus, label: "First Employee" },
    { id: "complete", icon: PartyPopper, label: "Complete" },
];

export default function OnboardingPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [onboardingStatus, setOnboardingStatus] = useState<Record<string, boolean>>({});

    // Form state
    const [departments, setDepartments] = useState([{ name: "Administration", code: "ADMIN" }, { name: "Operations", code: "OPS" }]);
    const [designations, setDesignations] = useState([{ name: "Manager", code: "MGR" }, { name: "Officer", code: "OFF" }]);
    const [shift, setShift] = useState({ name: "General Shift", startTime: "09:00", endTime: "18:00", breakDuration: 60, graceMinutes: 15 });
    const [employee, setEmployee] = useState({ firstName: "", lastName: "", email: "", phone: "", employeeCode: "EMP-001", departmentId: "", designationId: "" });
    const [createdDepts, setCreatedDepts] = useState<{ id: string; name: string }[]>([]);
    const [createdDesignations, setCreatedDesignations] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        fetch("/api/setup/onboarding-status", { credentials: "include" })
            .then(r => r.json())
            .then(data => {
                setOnboardingStatus(data);
                // Skip to first incomplete step
                if (data.hasDepartments && data.hasDesignations && data.hasShifts && data.hasEmployees) {
                    setCurrentStep(5); // All done
                }
            })
            .catch(() => {});
    }, []);

    const handleCreateDepartments = async () => {
        setLoading(true);
        try {
            const created = [];
            for (const dept of departments.filter(d => d.name.trim())) {
                const res = await fetch("/api/departments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(dept),
                });
                if (res.ok) {
                    const data = await res.json();
                    created.push({ id: data.id, name: data.name });
                }
            }
            setCreatedDepts(created);
            addToast({ title: `${created.length} department(s) created`, type: "success" });
            setCurrentStep(2);
        } catch {
            addToast({ title: "Failed to create departments", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDesignations = async () => {
        setLoading(true);
        try {
            const created = [];
            for (const desig of designations.filter(d => d.name.trim())) {
                const res = await fetch("/api/designations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(desig),
                });
                if (res.ok) {
                    const data = await res.json();
                    created.push({ id: data.id, name: data.name });
                }
            }
            setCreatedDesignations(created);
            addToast({ title: `${created.length} designation(s) created`, type: "success" });
            setCurrentStep(3);
        } catch {
            addToast({ title: "Failed to create designations", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateShift = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/shifts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ...shift, isDefault: true }),
            });
            if (res.ok) {
                addToast({ title: "Work shift created", type: "success" });
                setCurrentStep(4);
            } else {
                const data = await res.json().catch(() => ({}));
                addToast({ title: data.error || "Failed to create shift", type: "error" });
            }
        } catch {
            addToast({ title: "Failed to create shift", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEmployee = async () => {
        if (!employee.firstName || !employee.lastName) {
            addToast({ title: "First name and last name are required", type: "error" });
            return;
        }
        if (!employee.departmentId || !employee.designationId) {
            addToast({ title: "Please select department and designation", type: "error" });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    ...employee,
                    joiningDate: new Date().toISOString().split("T")[0],
                    employmentType: "permanent",
                }),
            });
            if (res.ok) {
                addToast({ title: "First employee created!", type: "success" });
                setCurrentStep(5);
            } else {
                const data = await res.json().catch(() => ({}));
                addToast({ title: data.error || "Failed to create employee", type: "error" });
            }
        } catch {
            addToast({ title: "Failed to create employee", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors";
    const labelCls = "block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2";

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
            <div className="max-w-2xl mx-auto">
                {/* Progress Indicator */}
                <div className="flex items-center justify-between mb-8">
                    {STEPS.map((step, i) => {
                        const Icon = step.icon;
                        const isActive = i === currentStep;
                        const isComplete = i < currentStep;
                        return (
                            <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center gap-1.5">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                                            isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110"
                                            : isComplete ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : "bg-white/[0.04] text-zinc-600 border border-white/[0.06]"
                                        }`}
                                    >
                                        {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                                    </div>
                                    <span className={`text-[10px] font-medium hidden sm:block ${isActive ? "text-blue-400" : isComplete ? "text-emerald-400" : "text-zinc-600"}`}>
                                        {step.label}
                                    </span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all duration-300 ${i < currentStep ? "bg-emerald-500/30" : "bg-white/[0.04]"}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <Card className="bg-card border-card-border">
                    <CardContent className="p-6 sm:p-8">

                        {/* Step 0: Welcome */}
                        {currentStep === 0 && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6">
                                    <Sparkles className="w-8 h-8 text-blue-400" />
                                </div>
                                <h1 className="text-2xl font-display font-bold text-foreground mb-3">Welcome to PeopleFlow!</h1>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                                    Let&apos;s set up your organization in a few quick steps. You&apos;ll be ready to manage employees, attendance, and payroll in minutes.
                                </p>
                                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                                    <Button onClick={() => setCurrentStep(1)} className="w-full h-11 bg-blue-600 hover:bg-blue-700">
                                        Get Started <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                    <Button variant="ghost" onClick={() => router.push("/dashboard")} className="text-muted-foreground">
                                        Skip setup for now
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Departments */}
                        {currentStep === 1 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-display font-semibold text-foreground">Create Departments</h2>
                                        <p className="text-xs text-muted-foreground">Organize your teams into departments</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {departments.map((dept, i) => (
                                        <div key={i} className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Name</label>
                                                <Input value={dept.name} onChange={e => setDepartments(prev => prev.map((d, j) => j === i ? { ...d, name: e.target.value } : d))} placeholder="Department name" className={inputCls} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Code (optional)</label>
                                                <Input value={dept.code} onChange={e => setDepartments(prev => prev.map((d, j) => j === i ? { ...d, code: e.target.value } : d))} placeholder="CODE" className={inputCls} />
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setDepartments(prev => [...prev, { name: "", code: "" }])} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">+ Add another department</button>
                                </div>
                                <div className="flex justify-between mt-8">
                                    <Button variant="ghost" onClick={() => setCurrentStep(0)} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => setCurrentStep(2)} className="text-muted-foreground">Skip</Button>
                                        <Button onClick={handleCreateDepartments} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Continue <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Designations */}
                        {currentStep === 2 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                                        <Briefcase className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-display font-semibold text-foreground">Create Designations</h2>
                                        <p className="text-xs text-muted-foreground">Define job titles for your employees</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {designations.map((desig, i) => (
                                        <div key={i} className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Name</label>
                                                <Input value={desig.name} onChange={e => setDesignations(prev => prev.map((d, j) => j === i ? { ...d, name: e.target.value } : d))} placeholder="Designation name" className={inputCls} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Code (optional)</label>
                                                <Input value={desig.code} onChange={e => setDesignations(prev => prev.map((d, j) => j === i ? { ...d, code: e.target.value } : d))} placeholder="CODE" className={inputCls} />
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setDesignations(prev => [...prev, { name: "", code: "" }])} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">+ Add another designation</button>
                                </div>
                                <div className="flex justify-between mt-8">
                                    <Button variant="ghost" onClick={() => setCurrentStep(1)} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => setCurrentStep(3)} className="text-muted-foreground">Skip</Button>
                                        <Button onClick={handleCreateDesignations} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Continue <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Shift */}
                        {currentStep === 3 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-display font-semibold text-foreground">Configure Work Shift</h2>
                                        <p className="text-xs text-muted-foreground">Set up your standard working hours</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Shift Name</label>
                                        <Input value={shift.name} onChange={e => setShift(prev => ({ ...prev, name: e.target.value }))} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Break (minutes)</label>
                                        <Input type="number" value={shift.breakDuration} onChange={e => setShift(prev => ({ ...prev, breakDuration: parseInt(e.target.value) || 60 }))} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Start Time</label>
                                        <Input type="time" value={shift.startTime} onChange={e => setShift(prev => ({ ...prev, startTime: e.target.value }))} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>End Time</label>
                                        <Input type="time" value={shift.endTime} onChange={e => setShift(prev => ({ ...prev, endTime: e.target.value }))} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Grace Period (minutes)</label>
                                        <Input type="number" value={shift.graceMinutes} onChange={e => setShift(prev => ({ ...prev, graceMinutes: parseInt(e.target.value) || 15 }))} className={inputCls} />
                                    </div>
                                </div>
                                <div className="flex justify-between mt-8">
                                    <Button variant="ghost" onClick={() => setCurrentStep(2)} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => setCurrentStep(4)} className="text-muted-foreground">Skip</Button>
                                        <Button onClick={handleCreateShift} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Continue <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: First Employee */}
                        {currentStep === 4 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                                        <UserPlus className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-display font-semibold text-foreground">Add Your First Employee</h2>
                                        <p className="text-xs text-muted-foreground">Start with one employee — you can add more later</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>First Name *</label>
                                        <Input value={employee.firstName} onChange={e => setEmployee(prev => ({ ...prev, firstName: e.target.value }))} placeholder="First name" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Last Name *</label>
                                        <Input value={employee.lastName} onChange={e => setEmployee(prev => ({ ...prev, lastName: e.target.value }))} placeholder="Last name" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email</label>
                                        <Input type="email" value={employee.email} onChange={e => setEmployee(prev => ({ ...prev, email: e.target.value }))} placeholder="email@company.com" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Phone</label>
                                        <Input value={employee.phone} onChange={e => setEmployee(prev => ({ ...prev, phone: e.target.value }))} placeholder="01XXXXXXXXX" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Employee Code</label>
                                        <Input value={employee.employeeCode} onChange={e => setEmployee(prev => ({ ...prev, employeeCode: e.target.value }))} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Department</label>
                                        <select value={employee.departmentId} onChange={e => setEmployee(prev => ({ ...prev, departmentId: e.target.value }))} className={`w-full ${inputCls}`}>
                                            <option value="">Select department...</option>
                                            {createdDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Designation</label>
                                        <select value={employee.designationId} onChange={e => setEmployee(prev => ({ ...prev, designationId: e.target.value }))} className={`w-full ${inputCls}`}>
                                            <option value="">Select designation...</option>
                                            {createdDesignations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-between mt-8">
                                    <Button variant="ghost" onClick={() => setCurrentStep(3)} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => setCurrentStep(5)} className="text-muted-foreground">Skip</Button>
                                        <Button onClick={handleCreateEmployee} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Create Employee <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Complete */}
                        {currentStep === 5 && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                    <PartyPopper className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h1 className="text-2xl font-display font-bold text-foreground mb-3">You&apos;re all set! 🎉</h1>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                                    Your organization is ready. You can now manage employees, track attendance, process payroll, and more.
                                </p>
                                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                                    <Button onClick={() => router.push("/dashboard")} className="w-full h-11 bg-blue-600 hover:bg-blue-700">
                                        Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                    <Button variant="ghost" onClick={() => router.push("/employees")} className="text-muted-foreground">
                                        Add More Employees
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
