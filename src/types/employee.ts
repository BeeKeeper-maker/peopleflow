import { Employee as PrismaEmployee, Organization, Department, Designation, Branch, Shift } from "@/generated/prisma";

export type EmploymentStatus = 'active' | 'resigned' | 'terminated' | 'retired';
export type EmploymentType = 'permanent' | 'contractual' | 'intern' | 'probation';
export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

export interface Employee extends PrismaEmployee {
    department?: Department | null;
    designation?: Designation | null;
    branch?: Branch | null;
    shift?: Shift | null;
    reportingManager?: Employee | null;
}

export interface EmployeeFormData {
    // Personal Info
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: Gender;
    bloodGroup?: string;
    maritalStatus?: MaritalStatus;
    nidNumber?: string;
    presentAddress?: string;
    permanentAddress?: string;

    // Employment
    employeeCode: string;
    departmentId: string;
    designationId: string;
    branchId?: string;
    shiftId?: string;
    reportingManagerId?: string;
    joiningDate: Date;
    employmentType: EmploymentType;
    employmentStatus: EmploymentStatus;

    // Financial
    basicSalary: number;
    bankName?: string;
    bankAccount?: string;
}

export interface EmployeeFilters {
    search?: string;
    departmentId?: string;
    employmentStatus?: EmploymentStatus;
    page?: number;
    limit?: number;
}
