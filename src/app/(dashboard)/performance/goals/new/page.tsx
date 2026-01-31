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
                title: "Error",
                description: "Goal title is required",
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
                    title: "Success",
                    description: "Goal created successfully",
                    type: "success",
                })
                router.push("/performance")
            } else {
                throw new Error("Failed to create goal")
            }
        } catch (error) {
            addToast({
                title: "Error",
                description: "Failed to create goal",
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
                    <Button variant="ghost" size="icon" className="text-white/60">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Set New Goal</h1>
                    <p className="text-white/60 mt-1">Define your objectives and key results</p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
                {/* Goal Details */}
                <Card className="bg-[#12121A] border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Target className="h-5 w-5 text-purple-400" />
                            Goal Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-white/80">Goal Title *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => handleChange("title", e.target.value)}
                                placeholder="e.g. Increase sales by 20%"
                                className="mt-1.5 bg-white/5 border-white/10"
                            />
                        </div>

                        <div>
                            <Label className="text-white/80">Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                placeholder="Describe your goal..."
                                rows={3}
                                className="mt-1.5 bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-white/80">Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(v) => handleChange("type", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="individual">Individual</SelectItem>
                                        <SelectItem value="team">Team</SelectItem>
                                        <SelectItem value="company">Company</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-white/80">Priority</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v) => handleChange("priority", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-white/80">Start Date</Label>
                                <Input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => handleChange("startDate", e.target.value)}
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>

                            <div>
                                <Label className="text-white/80">Due Date</Label>
                                <Input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => handleChange("dueDate", e.target.value)}
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Key Results */}
                <Card className="bg-[#12121A] border-white/10">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-white">Key Results (OKRs)</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addKeyResult}
                                className="border-white/10"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Key Result
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {keyResults.length === 0 ? (
                            <div className="text-center py-8 text-white/40">
                                <p className="mb-2">No key results added yet</p>
                                <p className="text-sm">Key results help measure progress toward your goal</p>
                            </div>
                        ) : (
                            keyResults.map((kr, index) => (
                                <div key={kr.id} className="flex gap-3 items-start p-4 rounded-xl bg-white/5">
                                    <span className="text-white/40 font-medium pt-2">{index + 1}.</span>
                                    <div className="flex-1 space-y-3">
                                        <Input
                                            value={kr.title}
                                            onChange={(e) => updateKeyResult(kr.id, "title", e.target.value)}
                                            placeholder="Key result title"
                                            className="bg-white/5 border-white/10"
                                        />
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <Input
                                                    type="number"
                                                    value={kr.targetValue}
                                                    onChange={(e) => updateKeyResult(kr.id, "targetValue", e.target.value)}
                                                    placeholder="Target"
                                                    className="bg-white/5 border-white/10"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <Select
                                                    value={kr.unit}
                                                    onValueChange={(v) => updateKeyResult(kr.id, "unit", v)}
                                                >
                                                    <SelectTrigger className="bg-white/5 border-white/10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="%">%</SelectItem>
                                                        <SelectItem value="count">Count</SelectItem>
                                                        <SelectItem value="BDT">BDT</SelectItem>
                                                        <SelectItem value="hours">Hours</SelectItem>
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
                        className="bg-gradient-to-r from-purple-500 to-pink-600"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Create Goal
                    </Button>
                </div>
            </div>
        </div>
    )
}
