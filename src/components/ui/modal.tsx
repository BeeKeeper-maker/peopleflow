"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    showClose?: boolean;
    closeOnOverlayClick?: boolean;
}

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = "md",
    showClose = true,
    closeOnOverlayClick = true,
}: ModalProps) {
    // Close on escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);

    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-2xl",
        full: "max-w-[90vw] h-[90vh]",
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={closeOnOverlayClick ? onClose : undefined}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full px-4"
                    >
                        <div
                            className={cn(
                                "mx-auto w-full rounded-2xl border border-white/10 bg-[#141419] shadow-2xl",
                                sizeClasses[size]
                            )}
                        >
                            {/* Header */}
                            {(title || showClose) && (
                                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                                    <div>
                                        {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
                                        {description && (
                                            <p className="mt-1 text-sm text-white/60">{description}</p>
                                        )}
                                    </div>
                                    {showClose && (
                                        <button
                                            onClick={onClose}
                                            className="rounded-lg p-2 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Content */}
                            <div className={cn("p-6", size === "full" && "overflow-y-auto max-h-[70vh]")}>
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "default";
    isLoading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    isLoading,
}: ConfirmModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false}>
            <div className="text-center">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {description && <p className="mt-2 text-sm text-white/60">{description}</p>}
                <div className="mt-6 flex gap-3 justify-center">
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant === "danger" ? "destructive" : variant === "warning" ? "secondary" : "default"}
                        onClick={onConfirm}
                        isLoading={isLoading}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
