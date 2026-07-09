"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { EmployeeForm } from "@/components/employees/employee-form"

/**
 * Edit Employee Page — CRIT-11 FIX
 * 
 * Previously, this page cherry-picked ~12 fields from the API response,
 * silently dropping ~15 fields (bengaliName, passportNumber, bloodGroup,
 * addresses, emergency contact, biometricUserId, etc.). Every edit
 * would overwrite those fields with empty values.
 * 
 * Now we pass the FULL API response as initialData to the EmployeeForm,
 * which handles all field mapping in its defaultValues. Zero data loss.
 */
export default function EditEmployeePage() {
    const params = useParams()
    const { addToast } = useToast()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [initialData, setInitialData] = useState<any>(undefined)
    const [isFetching, setIsFetching] = useState(true)

    useEffect(() => {
        async function fetchEmployee() {
            try {
                const response = await fetch(`/api/employees/${params.id}`)
                if (!response.ok) throw new Error("Failed to fetch employee")
                const data = await response.json()

                // Pass the COMPLETE API response — EmployeeForm handles all mapping
                setInitialData(data)
            } catch (error) {
                console.error(error)
                addToast({
                    title: "Error",
                    description: "Failed to load employee data",
                    type: "error"
                })
            } finally {
                setIsFetching(false)
            }
        }

        if (params.id) fetchEmployee()
    }, [params.id, addToast])

    if (isFetching) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href={`/employees/${params.id}`}>
                    <Button variant="ghost" size="icon" className="h-10 w-10" title="Back" aria-label="Back">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">Edit Employee</h1>
                    <p className="text-muted-foreground">Update employee information</p>
                </div>
            </div>

            {initialData && initialData.employmentStatus !== "active" && (
                <div data-testid="employee-reactivation-guidance" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                        <div>
                            <p className="font-semibold">Employee is currently inactive</p>
                            <p className="mt-1 text-sm text-amber-100/80">
                                Reactivating this employee will require a fresh reset invitation before ESS access resumes. Old passwords and old sessions stay blocked.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <EmployeeForm initialData={initialData} />
        </div>
    )
}
