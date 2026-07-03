"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
    Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

interface EmployeeProfile {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    personalEmail?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    maritalStatus?: string;
    nationality?: string;
    nidNumber?: string;
    photoUrl?: string;

    department?: { name: string };
    designation?: { name: string };
    joiningDate?: string;
    employmentType?: string;
    reportingManager?: { firstName: string; lastName: string };
    shift?: { name: string };
    branch?: { name: string };

    presentAddress?: string;
    permanentAddress?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;

    bankName?: string;
    bankAccountNumber?: string;
    bankRoutingNumber?: string;
}

export default function ESSProfilePage() {
    const t = useTranslations("ESSProfile");
    const { data: session } = useSession();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [editedProfile, setEditedProfile] = useState<Partial<EmployeeProfile>>({});

    const user = session?.user;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch("/api/employees/me");
                if (res.ok) {
                    const json = await res.json();
                    // API now returns { data: { employee: {...}, ... } }
                    const profileData = json.data?.employee || json.data || json;
                    setProfile(profileData);
                } else {
                    console.error("Failed to fetch profile");
                }
            } catch (error) {
                console.error("Error fetching data:", error); addToast({ title: "Failed to load data. Please refresh.", type: "error" }); addToast({ title: "Failed to load data. Please refresh.", type: "error" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleEditToggle = () => {
        if (isEditing) {
            setEditedProfile({});
        } else {
            setEditedProfile({
                phone: profile?.phone,
                personalEmail: profile?.personalEmail,
                presentAddress: profile?.presentAddress,
                emergencyContactName: profile?.emergencyContactName,
                emergencyContactPhone: profile?.emergencyContactPhone,
                emergencyContactRelation: profile?.emergencyContactRelation,
            });
        }
        setIsEditing(!isEditing);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/employees/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editedProfile),
            });

            if (res.ok) {
                const json = await res.json();
                // PATCH returns { data: employee } (flat employee object)
                const updatedProfile = json.data?.employee || json.data || json;
                setProfile(updatedProfile);
                setIsEditing(false);
                setEditedProfile({});
                addToast({ title: t("updateSuccess"), type: "success" });
            } else {
                addToast({ title: t("updateFailed"), type: "error" });
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            addToast({ title: t("updateFailed"), type: "error" });
        } finally {
            setIsSaving(false);
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
                <p className="text-muted-foreground">{t("updateFailed")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24 border-4 border-card-border">
                        <AvatarImage src={profile.photoUrl || user?.image || undefined} />
                        <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-foreground text-3xl">
                            {profile.firstName?.[0]}{profile.lastName?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {profile.firstName} {profile.lastName}
                        </h1>
                        <p className="text-muted-foreground">{profile.designation?.name || t("notProvided")}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                {profile.employeeCode}
                            </Badge>
                            {profile.employmentType && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                    {profile.employmentType}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleEditToggle}
                                disabled={isSaving}
                                className="border-card-border text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4 mr-2" />
                                {t("cancelEdit")}
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-500"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                {isSaving ? t("saving") : t("saveChanges")}
                            </Button>
                        </>
                    ) : (
                        <Button
                            onClick={handleEditToggle}
                            className="bg-blue-600 hover:bg-blue-500"
                        >
                            <Edit2 className="h-4 w-4 mr-2" />
                            {t("editProfile")}
                        </Button>
                    )}
                </div>
            </div>

            {/* Profile Tabs */}
            <Tabs defaultValue="personal" className="space-y-6">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-card border border-card-border sm:inline-flex sm:h-10 sm:w-auto">
                    <TabsTrigger value="personal" className="min-h-9 whitespace-normal text-center data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 sm:min-h-0 sm:whitespace-nowrap">
                        {t("personalInfo")}
                    </TabsTrigger>
                    <TabsTrigger value="employment" className="min-h-9 whitespace-normal text-center data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 sm:min-h-0 sm:whitespace-nowrap">
                        {t("workInfo")}
                    </TabsTrigger>
                    <TabsTrigger value="contact" className="min-h-9 whitespace-normal text-center data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 sm:min-h-0 sm:whitespace-nowrap">
                        {t("emergencyContact")}
                    </TabsTrigger>
                    <TabsTrigger value="bank" className="min-h-9 whitespace-normal text-center data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 sm:min-h-0 sm:whitespace-nowrap">
                        {t("bankInfo")}
                    </TabsTrigger>
                </TabsList>

                {/* Personal Info Tab */}
                <TabsContent value="personal">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-400" />
                                {t("personalInfo")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("fullName")}</Label>
                                    <p className="text-foreground">{profile.firstName} {profile.lastName}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("email")}</Label>
                                    <p className="text-foreground">{profile.email}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("dateOfBirth")}</Label>
                                    <p className="text-foreground">
                                        {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : t("notProvided")}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("gender")}</Label>
                                    <p className="text-foreground">{profile.gender || t("notProvided")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("bloodGroup")}</Label>
                                    <p className="text-foreground">{profile.bloodGroup || t("notProvided")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("maritalStatus")}</Label>
                                    <p className="text-foreground">{profile.maritalStatus || t("notProvided")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Employment Tab */}
                <TabsContent value="employment">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-green-400" />
                                {t("workInfo")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("employeeCode")}</Label>
                                    <p className="text-foreground">{profile.employeeCode}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("department")}</Label>
                                    <p className="text-foreground">{profile.department?.name || t("notProvided")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("designation")}</Label>
                                    <p className="text-foreground">{profile.designation?.name || t("notProvided")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("employmentType")}</Label>
                                    <p className="text-foreground">{profile.employmentType || t("notProvided")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("joinDate")}</Label>
                                    <p className="text-foreground">
                                        {profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : t("notProvided")}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Contact Tab */}
                <TabsContent value="contact">
                    <div className="space-y-6">
                        <Card className="bg-card border-card-border">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <Phone className="h-5 w-5 text-purple-400" />
                                    {t("personalInfo")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("email")}</Label>
                                        <p className="text-foreground">{profile.email}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("personalEmail")}</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.personalEmail || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, personalEmail: e.target.value })
                                                }
                                                className="bg-hover border-card-border text-foreground"
                                            />
                                        ) : (
                                            <p className="text-foreground">{profile.personalEmail || t("notProvided")}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("phone")}</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.phone || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, phone: e.target.value })
                                                }
                                                className="bg-hover border-card-border text-foreground"
                                            />
                                        ) : (
                                            <p className="text-foreground">{profile.phone || t("notProvided")}</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-card-border">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-orange-400" />
                                    {t("presentAddress")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("presentAddress")}</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.presentAddress || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, presentAddress: e.target.value })
                                                }
                                                className="bg-hover border-card-border text-foreground"
                                            />
                                        ) : (
                                            <p className="text-foreground">{profile.presentAddress || t("notProvided")}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("permanentAddress")}</Label>
                                        <p className="text-foreground">{profile.permanentAddress || t("notProvided")}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-card-border">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <User className="h-5 w-5 text-red-400" />
                                    {t("emergencyContact")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("emergencyContact")}</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.emergencyContactName || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, emergencyContactName: e.target.value })
                                                }
                                                className="bg-hover border-card-border text-foreground"
                                            />
                                        ) : (
                                            <p className="text-foreground">{profile.emergencyContactName || t("notProvided")}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("emergencyRelation")}</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.emergencyContactRelation || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, emergencyContactRelation: e.target.value })
                                                }
                                                className="bg-hover border-card-border text-foreground"
                                            />
                                        ) : (
                                            <p className="text-foreground">{profile.emergencyContactRelation || t("notProvided")}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t("emergencyPhone")}</Label>
                                        {isEditing ? (
                                            <Input
                                                value={editedProfile.emergencyContactPhone || ""}
                                                onChange={(e) =>
                                                    setEditedProfile({ ...editedProfile, emergencyContactPhone: e.target.value })
                                                }
                                                className="bg-hover border-card-border text-foreground"
                                            />
                                        ) : (
                                            <p className="text-foreground">{profile.emergencyContactPhone || t("notProvided")}</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Bank Tab */}
                <TabsContent value="bank">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-yellow-400" />
                                {t("bankInfo")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("bankName")}</Label>
                                    <p className="text-foreground">{profile.bankName || t("notProvided")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("bankAccount")}</Label>
                                    <p className="text-foreground">{profile.bankAccountNumber || t("notProvided")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">{t("bankRouting")}</Label>
                                    <p className="text-foreground">{profile.bankRoutingNumber || t("notProvided")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
