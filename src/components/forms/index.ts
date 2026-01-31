/**
 * Form Components Index
 * 
 * This folder contains reusable form components for scalable development.
 * 
 * Recommended structure:
 * - form-field.tsx - Base form field wrapper with label, error, description
 * - form-input.tsx - Styled input with validation
 * - form-select.tsx - Dropdown select component
 * - form-date-picker.tsx - Date picker with calendar
 * - form-file-upload.tsx - File upload with preview
 * - form-rich-text.tsx - Rich text editor
 * 
 * Usage:
 * import { FormField, FormInput } from "@/components/forms";
 */

// Re-export common form patterns
export { Input } from "@/components/ui/input";
export { Label } from "@/components/ui/label";
export { Button } from "@/components/ui/button";
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Form validation utilities
export { useForm } from "react-hook-form";
export { zodResolver } from "@hookform/resolvers/zod";
export { z } from "zod";

/**
 * Form Component Guidelines for Scalability:
 * 
 * 1. Use react-hook-form for form state management
 * 2. Use Zod for validation (schemas in /lib/validations/)
 * 3. Create specialized form components as needed
 * 4. Keep form logic separate from UI components
 */
