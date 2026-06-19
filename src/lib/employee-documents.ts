export const DOCUMENT_CATEGORIES = [
  { value: "identity", label: "Identity", labelBn: "পরিচয়পত্র" },
  { value: "employment", label: "Employment", labelBn: "চাকরি সংক্রান্ত" },
  { value: "education", label: "Education", labelBn: "শিক্ষা/সনদ" },
  { value: "finance", label: "Finance", labelBn: "ফাইন্যান্স" },
  { value: "compliance", label: "Compliance", labelBn: "কমপ্লায়েন্স" },
  { value: "medical", label: "Medical", labelBn: "মেডিকেল" },
  { value: "other", label: "Other", labelBn: "অন্যান্য" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "nid", label: "National ID / NID", category: "identity" },
  { value: "passport", label: "Passport", category: "identity" },
  { value: "photo", label: "Photo", category: "identity" },
  { value: "cv", label: "CV / Resume", category: "employment" },
  { value: "appointment_letter", label: "Appointment Letter", category: "employment" },
  { value: "contract", label: "Contract", category: "employment" },
  { value: "experience_certificate", label: "Experience Certificate", category: "employment" },
  { value: "certificate", label: "Educational Certificate", category: "education" },
  { value: "bank_document", label: "Bank Document", category: "finance" },
  { value: "tin", label: "TIN / Tax Certificate", category: "finance" },
  { value: "policy_acknowledgement", label: "Policy Acknowledgement", category: "compliance" },
  { value: "medical_record", label: "Medical Record", category: "medical" },
  { value: "other", label: "Other Document", category: "other" },
] as const;

export const DOCUMENT_STATUSES = ["pending", "verified", "rejected"] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export function getDocumentTypeLabel(type: string) {
  return DOCUMENT_TYPES.find((item) => item.value === type)?.label || type.replaceAll("_", " ");
}

export function getDocumentCategoryLabel(category: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label || "Other";
}

export function deriveDocumentCategory(type: string, fallback = "other") {
  return DOCUMENT_TYPES.find((item) => item.value === type)?.category || fallback;
}

export function isDocumentExpired(expiryDate?: string | Date | null) {
  if (!expiryDate) return false;
  const date = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  return !Number.isNaN(date.getTime()) && date < new Date();
}

export function isDocumentExpiringSoon(expiryDate?: string | Date | null, days = 30) {
  if (!expiryDate) return false;
  const date = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + days);
  return date >= now && date <= threshold;
}
