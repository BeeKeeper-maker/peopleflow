"use client";

import { useState, useCallback, useRef } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
}

/**
 * useConfirmDialog — a hook that replaces browser-native confirm() with
 * a design-system AlertDialog.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirmDialog()
 *
 *   const handleDelete = async () => {
 *       const ok = await confirm({
 *           title: "Delete report?",
 *           description: "This cannot be undone.",
 *           confirmLabel: "Delete",
 *           variant: "destructive",
 *       })
 *       if (!ok) return
 *       // proceed with delete
 *   }
 *
 *   // At the end of your component:
 *   return (
 *       <>
 *           ...your content...
 *           {dialog}
 *       </>
 *   )
 */
export function useConfirmDialog() {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: "",
    });
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        setOptions(opts);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setOpen(false);
        resolveRef.current?.(true);
        resolveRef.current = null;
    }, []);

    const handleCancel = useCallback(() => {
        setOpen(false);
        resolveRef.current?.(false);
        resolveRef.current = null;
    }, []);

    const dialog = (
        <AlertDialog open={open} onOpenChange={(v) => {
            if (!v) handleCancel();
            setOpen(v);
        }}>
            <AlertDialogContent className="bg-card border-card-border">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">
                        {options.title}
                    </AlertDialogTitle>
                    {options.description && (
                        <AlertDialogDescription className="text-muted-foreground">
                            {options.description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        onClick={handleCancel}
                        className="border-card-border"
                    >
                        {options.cancelLabel || "Cancel"}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className={
                            options.variant === "destructive"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                        }
                    >
                        {options.confirmLabel || "Confirm"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { confirm, dialog };
}
