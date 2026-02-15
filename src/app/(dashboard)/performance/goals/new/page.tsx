"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowLeft,
    Target,
    Plus,
    Trash2,
    Save,
    Loader2,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { useTranslations } from "next-intl"

interface KeyResultInput {
    id: string
    title: string
    targetValue: string
    unit: string
}

export default function NewGoalPage() {
    const router = useRouter()
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)
    const t = useTranslations("FormPerformanceGoals")

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        type: "individual",
        priority: "medium",
        startDate: "",
        dueDate: "",
    })

    const [keyResults, setKeyResults] = useState<KeyResultInput[]>([])

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const addKeyResult = () => {
        setKeyResults(prev => [
            ...prev,
            { id: Date.now().toString(), title: "", targetValue: "100", unit: "%" }
        ])
    }

    const updateKeyResult = (id: string, field: string, value: string) => {
        setKeyResults(prev => prev.map(kr =>
            kr.id === id ? { ...kr, [field]: value } : kr
        ))
    }

    const removeKeyResult = (id: string) => {
        setKeyResults(prev => prev.filter(kr => kr.id !== id))
    }

    const handleSubmit = async () => {
        if (!formData.title) {
            addToast({
                title: t("error"),
                description: t("titleRequired"),
                type: "error",
            })
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/performance/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    keyResults: keyResults.filter(kr => kr.title).map(kr => ({
                        title: kr.title,
                        targetValue: parseFloat(kr.targetValue) || 100,
                        unit: kr.unit,
                    })),
                }),
            })

            if (res.ok) {
                addToast({
                    title: t("success"),
                    description: t("createSuccess"),
                    type: "success",
                })
                router.push("/performance")
            } else {
                throw new Error(t("createFailed"))
            }
        } catch (error) {
            addToast({
                title: t("error"),
                description: t("createFailed"),
                type: "error",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/performance">
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
                {/* Goal Details */}
                <Card className="bg-card border-card-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Target className="h-5 w-5 text-purple-400" />
                            {t("goalDetails")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-foreground">{t("goalTitle")}</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => handleChange("title", e.target.value)}
                                placeholder={t("goalTitlePlaceholder")}
                                className="mt-1.5 bg-hover border-card-border"
                            />
                        </div>

                        <div>
                            <Label className="text-foreground">{t("description")}</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                placeholder={t("descriptionPlaceholder")}
                                rows={3}
                                className="mt-1.5 bg-hover border-card-border"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-foreground">{t("type")}</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(v) => handleChange("type", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-hover border-card-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="individual">{t("typeIndividual")}</SelectItem>
                                        <SelectItem value="team">{t("typeTeam")}</SelectItem>
                                        <SelectItem value="company">{t("typeCompany")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-foreground">{t("priority")}</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v) => handleChange("priority", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-hover border-card-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">{t("priorityLow")}</SelectItem>
                                        <SelectItem value="medium">{t("priorityMedium")}</SelectItem>
                                        <SelectItem value="high">{t("priorityHigh")}</SelectItem>
                                        <SelectItem value="critical">{t("priorityCritical")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-foreground">{t("startDate")}</Label>
                                <Input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => handleChange("startDate", e.target.value)}
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>

                            <div>
                                <Label className="text-foreground">{t("dueDate")}</Label>
                                <Input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => handleChange("dueDate", e.target.value)}
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Key Results */}
                <Card className="bg-card border-card-border">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-foreground">{t("keyResults")}</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addKeyResult}
                                className="border-card-border"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t("addKeyResult")}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {keyResults.length === 0 ? (
                            <div className="text-center py-8 text-tertiary-foreground">
                                <p className="mb-2">{t("noKeyResults")}</p>
                                <p className="text-sm">{t("keyResultsHelp")}</p>
                            </div>
                        ) : (
                            keyResults.map((kr, index) => (
                                <div key={kr.id} className="flex gap-3 items-start p-4 rounded-xl bg-hover">
                                    <span className="text-tertiary-foreground font-medium pt-2">{index + 1}.</span>
                                    <div className="flex-1 space-y-3">
                                        <Input
                                            value={kr.title}
                                            onChange={(e) => updateKeyResult(kr.id, "title", e.target.value)}
                                            placeholder={t("keyResultPlaceholder")}
                                            className="bg-hover border-card-border"
                                        />
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <Input
                                                    type="number"
                                                    value={kr.targetValue}
                                                    onChange={(e) => updateKeyResult(kr.id, "targetValue", e.target.value)}
                                                    placeholder={t("targetPlaceholder")}
                                                    className="bg-hover border-card-border"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <Select
                                                    value={kr.unit}
                                                    onValueChange={(v) => updateKeyResult(kr.id, "unit", v)}
                                                >
                                                    <SelectTrigger className="bg-hover border-card-border">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="%">{t("unitPercent")}</SelectItem>
                                                        <SelectItem value="count">{t("unitCount")}</SelectItem>
                                                        <SelectItem value="BDT">{t("unitBDT")}</SelectItem>
                                                        <SelectItem value="hours">{t("unitHours")}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeKeyResult(kr.id)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center gap-4 pt-4">
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-linear-to-r from-purple-500 to-pink-600"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        {t("createGoal")}
                    </Button>
                </div>
            </div>
        </div>
    )
}
