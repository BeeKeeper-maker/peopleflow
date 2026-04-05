/**
 * Validation Schemas Index
 * Re-exports all validation schemas for easy importing
 */

// Employee
export { employeeSchema, type EmployeeFormValues, type EmployeeData, DEFAULT_EMPLOYEE_VALUES, toPrismaEmployeeData, buildEmergencyContactJson } from "./employee";

// Department
export { departmentSchema, type DepartmentFormValues } from "./department";

// Designation
export { designationSchema, type DesignationFormValues } from "./designation";

// Leave
export { leaveTypeSchema, type LeaveTypeFormValues } from "./leave-type";
export { leaveApplicationSchema, type LeaveApplicationFormValues } from "./leave-application";

// Goals
export { createGoalSchema, updateGoalSchema, type CreateGoalFormValues, type UpdateGoalFormValues } from "./goal";

// Payroll
export { salaryStructureSchema, processPayrollSchema, payrollAssignmentSchema, type SalaryStructureFormValues, type ProcessPayrollInput, type PayrollAssignmentInput } from "./payroll";

// Shift
export { shiftSchema, type ShiftFormValues } from "./shift";

// Attendance
export { checkInSchema, checkOutSchema, manualAttendanceSchema, attendanceReportQuerySchema, type CheckInInput, type CheckOutInput, type ManualAttendanceInput } from "./attendance";

// Recruitment
export { jobPostingSchema, type JobPostingFormValues } from "./recruitment";

// Expense
export { expenseClaimSchema, expenseApprovalSchema, expenseCategorySchema, type ExpenseClaimFormValues, type ExpenseApprovalInput, type ExpenseCategoryFormValues } from "./expense";
