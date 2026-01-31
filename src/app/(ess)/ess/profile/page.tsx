"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    Calendar,
    Building2,
    Clock,
    Edit2,
    Save,
    X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmployeeProfile {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    personalEmail: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string;
    maritalStatus: string;
    nationality: string;
    nidNumber: string;

    department: string;
    designation: string;
    joiningDate: string;
    employmentType: string;
    reportingManager: string;
    shift: string;
    branch: string;

    presentAddress: string;
    permanentAddress: string;
    emergencyContact: {
        name: string;
        relation: string;
        phone: string;
    };

    bankName: string;
    accountNumber: string;
    routingNumber: string;
}

export default function ESSProfilePage() {
    const { data: session } = useSession();
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [editedProfile, setEditedProfile] = useState<Partial<EmployeeProfile>>({});

    const user = session?.user;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                // TODO: Fetch real data from API
                await new Promise((resolve) => setTimeout(resolve, 1000));

                const mockProfile: EmployeeProfile = {
                    id: "1",
                    employeeCode: "EMP-2024-0042",
                    firstName: user?.name?.split(" ")[0] || "John",
                    lastName: user?.name?.split(" ")[1] || "Doe",
                    email: user?.email || "john@company.com",
                    phone: "+880 1711-123456",
                    personalEmail: "john.personal@gmail.com",
                    dateOfBirth: "1990-03-15",
                    gender: "Male",
                    bloodGroup: "O+",
                    maritalStatus: "Married",
                    nationality: "Bangladeshi",
                    nidNumber: "1234567890",

                    department: "Engineering",
                    designation: "Senior Software Engineer",
                    joiningDate: "2020-01-01",
                    employmentType: "Permanent",
                    reportingManager: "Jane Smith",
                    shift: "Day Shift (9:00 AM - 6:00 PM)",
                    branch: "Dhaka HQ",

                    presentAddress: "House 12, Road 5, Dhanmondi, Dhaka-1205",
                    permanentAddress: "Village: ABC, Upazila: XYZ, District: Dhaka",
                    emergencyContact: {
                        name: "Sarah Doe",
                        relation: "Spouse",
                        phone: "+880 1712-654321",
                    },

                    bankName: "Dutch Bangla Bank",
                    accountNumber: "XXXXXXXXX1234",
                    routingNumber: "123456789",
                };

                setProfile(mockProfile);
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleEditToggle = () => {
        if (isEditing) {
            // Cancel editing
            setEditedProfile({});
        } else {
            // Start editing
            setEditedProfile({
                phone: profile?.phone,
                personalEmail: profile?.personalEmail,
                presentAddress: profile?.presentAddress,
                emergencyContact: profile?.emergencyContact,
            });
        }
        setIsEditing(!isEditing);
    };

    const handleSave = async () => {
        try {
            // TODO: Call API to save changes
            console.log("Saving:", editedProfile);

            // Update local state
            if (profile) {
                setProfile({
                    ...profile,
                    ...editedProfile,
                });
            }

            setIsEditing(false);
            setEditedProfile({});
        } catch (error) {
            console.error("Error saving profile:", error);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-6">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-white/60">Failed to load profile</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24 border-4 border-white/10">
                        <AvatarImage src={user?.image || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl">
                            {profile.firstName[0]}{profile.lastName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {profile.firstName} {profile.lastName}
                        </h1>
                        <p className="text-white/60">{profile.designation}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                {profile.employeeCode}
                            </Badge>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                {profile.employmentType}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleEditToggle}
                                className="border-white/10 text-white/60 hover:text-white"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="bg-green-600 hover:bg-green-500"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </Button>
                        </>
                    ) : (
                        <Button
                            onClick={handleEditToggle}
                            className="bg-blue-600 hover:bg-blue-500"
                        >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            {/* Profile Tabs */}
            <Tabs defaultValue="personal" className="space-y-6">
                <TabsList className="bg-[#141419] border border-white/5">
                    <TabsTrigger value="personal" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        Personal Info
                    </TabsTrigger>
                    <TabsTrigger value="employment" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        Employment
                    </TabsTrigger>
                    <TabsTrigger value="contact" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        Contact & Address
                    </TabsTrigger>
                    <TabsTrigger value="bank" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        Bank Details
                    </TabsTrigger>
                </TabsList>

                {/* Personal Info Tab */}
                <TabsContent value="personal">
                    <Card className="bg-[#141419] border-white/5">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-400" />
                                Personal Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-white/60">First Name</Label>
                                    <p className="text-white">{profile.firstName}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Last Name</Label>
                                    <p className="text-white">{profile.lastName}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Date of Birth</Label>
                                    <p className="text-white">{new Date(profile.dateOfBirth).toLocaleDateString()}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Gender</Label>
                                    <p className="text-white">{profile.gender}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Blood Group</Label>
                                    <p className="text-white">{profile.bloodGroup}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Marital Status</Label>
                                    <p className="text-white">{profile.maritalStatus}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Nationality</Label>
                                    <p className="text-white">{profile.nationality}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">NID Number</Label>
                                    <p className="text-white">{profile.nidNumber}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Employment Tab */}
                <TabsContent value="employment">
                    <Card className="bg-[#141419] border-white/5">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-green-400" />
                                Employment Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-white/60">Employee Code</Label>
                                    <p className="text-white">{profile.employeeCode}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Department</Label>
                                    <p className="text-white">{profile.department}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Designation</Label>
                                    <p className="text-white">{profile.designation}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Employment Type</Label>
                                    <p className="text-white">{profile.employmentType}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Joining Date</Label>
                                    <p className="text-white">{new Date(profile.joiningDate).toLocaleDateString()}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Reporting Manager</Label>
                                    <p className="text-white">{profile.reportingManager}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Shift</Label>
                                    <p className="text-white">{profile.shift}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Branch</Label>
                                    <p className="text-white">{profile.branch}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Contact Tab */}
                <TabsContent value="contact">
                    <div className="space-y-6">
                        <Card className="bg-[#141419] border-white/5">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Phone className="h-5 w-5 text-purple-400" />
                                    Contact Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Work Email</Label>
                                        <p className="text-white">{profile.email}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Personal Email</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.personalEmail || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, personalEmail: e.target.value })
                                                }
                                                className="bg-white/5 border-white/10 text-white"
                                            />
                                        ) : (
                                            <p className="text-white">{profile.personalEmail}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Phone</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.phone || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, phone: e.target.value })
                                                }
                                                className="bg-white/5 border-white/10 text-white"
                                            />
                                        ) : (
                                            <p className="text-white">{profile.phone}</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#141419] border-white/5">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-orange-400" />
                                    Address
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Present Address</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.presentAddress || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, presentAddress: e.target.value })
                                                }
                                                className="bg-white/5 border-white/10 text-white"
                                            />
                                        ) : (
                                            <p className="text-white">{profile.presentAddress}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Permanent Address</Label>
                                        <p className="text-white">{profile.permanentAddress}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#141419] border-white/5">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <User className="h-5 w-5 text-red-400" />
                                    Emergency Contact
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Name</Label>
                                        <p className="text-white">{profile.emergencyContact.name}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Relation</Label>
                                        <p className="text-white">{profile.emergencyContact.relation}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/60">Phone</Label>
                                        <p className="text-white">{profile.emergencyContact.phone}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Bank Tab */}
                <TabsContent value="bank">
                    <Card className="bg-[#141419] border-white/5">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-yellow-400" />
                                Bank Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-white/60">Bank Name</Label>
                                    <p className="text-white">{profile.bankName}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Account Number</Label>
                                    <p className="text-white">{profile.accountNumber}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60">Routing Number</Label>
                                    <p className="text-white">{profile.routingNumber}</p>
                                </div>
                            </div>
                            <p className="mt-4 text-sm text-white/40">
                                * Bank details can only be updated by HR. Please contact HR for any changes.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
