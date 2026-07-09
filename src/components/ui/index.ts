// ──────────────────────────────────────────────────────────────────────────
// PeopleFlow UI barrel — single import surface for all UI primitives.
//
// Import from `@/components/ui` (e.g. `import { Button, Card } from "@/components/ui"`).
// Every component that lives under `src/components/ui/` is re-exported here,
// plus `LoadingSkeleton` from `@/components/loading-skeleton` so consumers
// have one consistent entry point.
//
// Consolidation notes (P5-CONSOLIDATE):
//   • `EmptyState` is exported only from `./empty-state` (variant-based).
//     The duplicate `EmptyState` previously exported from `./error-state`
//     has been removed.
//   • `ErrorFallback` is the single source of truth for error fallback UI
//     (see `@/components/error-fallback`). `ErrorBoundary` delegates to it.
//   • `Skeleton` (domain-specific) and `LoadingSkeleton` (generic) are
//     both kept; they serve different purposes and are both exported here.
// ──────────────────────────────────────────────────────────────────────────

// Buttons & inputs
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";
export { Input } from "./input";
export type { InputProps } from "./input";
export { Textarea } from "./textarea";
export { Label } from "./label";
export { Checkbox } from "./checkbox";
export { Switch } from "./switch";

// Type-only re-exports are flagged when `isolatedModules` is enabled —
// we use `export type` for the form-glue types below as needed.

// Layout
export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardDescription,
    CardContent,
} from "./card";
export { PageHeader } from "./page-header";
export { Breadcrumbs } from "./breadcrumbs";
export { SkipLink } from "./skip-link";

// Data display
export { Badge, badgeVariants } from "./badge";
export type { BadgeProps } from "./badge";
export { Avatar, AvatarImage, AvatarFallback } from "./avatar";
export { Progress } from "./progress";

// Tables
export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
} from "./table";
export { DataTable } from "./data-table";

// Overlays
export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from "./dialog";
export {
    AlertDialog,
    AlertDialogPortal,
    AlertDialogOverlay,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from "./alert-dialog";
export {
    Sheet,
    SheetPortal,
    SheetOverlay,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
} from "./sheet";
export { Popover, PopoverTrigger, PopoverContent } from "./popover";
export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuRadioGroup,
} from "./dropdown-menu";
export { Modal, ConfirmModal } from "./modal";

// Navigation & selection
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
    SelectScrollUpButton,
    SelectScrollDownButton,
} from "./select";
export { SelectField } from "./select-field";
export { SearchableSelect } from "./searchable-select";
export type { ComboboxOption } from "./searchable-select";
export { Calendar } from "./calendar";
export type { CalendarProps } from "./calendar";

// Forms (react-hook-form glue)
export {
    useFormField,
    Form,
    FormItem,
    FormLabel,
    FormControl,
    FormDescription,
    FormMessage,
    FormField,
} from "./form";

// State placeholders
export {
    Skeleton,
    CardSkeleton,
    TableRowSkeleton,
    TableSkeleton,
    ProfileSkeleton,
    DashboardSkeleton,
    FormSkeleton,
    LeaveListSkeleton,
    AttendanceSkeleton,
    PayrollSkeleton,
    EmployeeListSkeleton,
    ESSDashboardSkeleton,
} from "./skeleton";
// Generic shimmer-style loading skeleton (variant: dashboard | list | detail).
// Lives in `src/components/loading-skeleton.tsx`; re-exported here so all
// loading primitives share the same import surface.
export { LoadingSkeleton } from "@/components/loading-skeleton";

// Empty / error states
export {
    EmptyState,
    NoEmployeesState,
    NoDocumentsState,
    NoResultsState,
    NoDataState,
} from "./empty-state";
export { ErrorState } from "./error-state";

// Toasts
export { useToast, ToastProvider, ToastContext } from "./toast";

// Theme & locale
export { ThemeToggle } from "./theme-toggle";
export { LanguageSwitcher } from "./language-switcher";
