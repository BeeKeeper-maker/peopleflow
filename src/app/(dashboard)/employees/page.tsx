"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/toast"
import { EmployeeDirectory } from "@/components/employees/employee-directory"
import { DeleteConfirmationModal } from "@/components/modals/delete-confirmation-modal"
import type { DirectoryEmployee, DirectoryDepartment } from "@/components/employees/employee-directory"

/**
 * Tenant Dashboard: Employee Directory
 *
 * Uses the shared $100M EmployeeDirectory component with CRUD actions enabled.
 * Replaces the old DataTable-based page with the premium Grid+List directory.
 */
export default function EmployeesPage() {
    const router = useRouter()
    const { addToast } = useToast()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rawData, setRawData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Delete modal state
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Fetch employees
    const fetchData = async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/employees?limit=5000")
            if (!response.ok) throw new Error("Failed to load employees")
            const result = await response.json()
            setRawData(result.data || result || [])
        } catch {
            addToast({ title: "Error", description: "Failed to load employees", type: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    // Transform API data to shared DirectoryEmployee shape
    const employees: DirectoryEmployee[] = useMemo(() =>
        rawData.map((e: any) => ({
            id: e.id,
            employeeCode: e.employeeCode || "",
            firstName: e.firstName || "",
            lastName: e.lastName || "",
            email: e.email || null,
            phone: e.phone || null,
            gender: e.gender || null,
            photoUrl: e.photoUrl || null,
            joiningDate: typeof e.joiningDate === "string" ? e.joiningDate : new Date(e.joiningDate).toISOString(),
            employmentType: e.employmentType || "permanent",
            employmentStatus: e.employmentStatus || "active",
            department: e.department ? { name: e.department.name, code: e.department.code || null } : null,
            designation: e.designation ? { name: e.designation.name, grade: e.designation.grade || null } : null,
            branch: e.branch ? { name: e.branch.name } : null,
            manager: e.reportingManager
                ? { name: `${e.reportingManager.firstName} ${e.reportingManager.lastName}`, photo: e.reportingManager.photoUrl }
                : null,
        })),
    [rawData])

    // Extract unique departments for filter
    const departments: DirectoryDepartment[] = useMemo(() => {
        const map = new Map<string, DirectoryDepartment>()
        rawData.forEach((e: any) => {
            if (e.department?.id) {
                map.set(e.department.id, {
                    id: e.department.id,
                    name: e.department.name,
                    code: e.department.code || null,
                })
            }
        })
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    }, [rawData])

    // Stats
    const stats = useMemo(() => ({
        total: employees.length,
        active: employees.filter(e => e.employmentStatus === "active").length,
        onProbation: employees.filter(e => e.employmentType === "probation").length,
        departments: departments.length,
    }), [employees, departments])

    // Handle delete
    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/employees/${deleteTarget.id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete")
            addToast({ title: "Success", description: "Employee offboarded and ESS access locked", type: "success" })
            fetchData() // Re-fetch after delete
        } catch {
            addToast({ title: "Error", description: "Failed to delete employee", type: "error" })
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }

    // Find employee name for delete modal
    const findEmployeeName = (id: string) => {
        const emp = rawData.find((e: any) => e.id === id)
        return emp ? `${emp.firstName} ${emp.lastName}` : "this employee"
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                {/* Skeleton Stats */}
                <div className="h-10 w-48 rounded-lg bg-white/[0.03] animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
                    ))}
                </div>
                <div className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-56 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <>
            <EmployeeDirectory
                employees={employees}
                departments={departments}
                stats={stats}
                config={{
                    profileBasePath: "/employees",
                    showCrudActions: true,
                    showAnalytics: true,
                    title: "Employee Directory",
                    subtitle: "Manage your organization's workforce",
                    onAddEmployee: () => router.push("/employees/new"),
                    onEditEmployee: (id) => router.push(`/employees/${id}/edit`),
                    onDeleteEmployee: (id) => setDeleteTarget({ id, name: findEmployeeName(id) }),
                }}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                open={!!deleteTarget}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleDelete}
                isLoading={isDeleting}
                title={`Offboard ${deleteTarget?.name}?`}
                description="This will mark the employee as terminated, lock their ESS login, clear active sessions, and preserve payroll/history records."
                confirmLabel="Offboard employee"
                loadingLabel="Offboarding..."
            />
        </>
    )
}
