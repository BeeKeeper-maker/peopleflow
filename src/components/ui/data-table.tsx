"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react"
import { useLocale } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchKey?: string
    placeholder?: string
    isLoading?: boolean
    emptyTitle?: string
    emptyDescription?: string
    emptyVariant?: "employees" | "documents" | "calendar" | "jobs" | "files" | "inbox" | "search" | "default"
    onAdd?: () => void
    addLabel?: string
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchKey,
    placeholder,
    isLoading = false,
    emptyTitle = "No data found",
    emptyDescription = "There are no records to display yet.",
    emptyVariant = "default",
    onAdd,
    addLabel,
}: DataTableProps<TData, TValue>) {
    const locale = useLocale()
    const isBn = locale.startsWith("bn")
    const defaultPlaceholder = isBn ? "খুঁজুন..." : "Search..."
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

    const pageIndex = table.getState().pagination.pageIndex
    const pageCount = table.getPageCount()

    // Skeleton loading state
    if (isLoading) {
        return (
            <div className="space-y-4 animate-fade-in">
                {searchKey && (
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
                    </div>
                )}
                <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-card-border bg-hover">
                                {Array.from({ length: columns.length }).map((_, i) => (
                                    <th key={i} className="h-12 px-4 text-left">
                                        <Skeleton className="h-4 w-20" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 5 }).map((_, rowIdx) => (
                                <tr key={rowIdx} className="border-b border-card-border">
                                    {Array.from({ length: columns.length }).map((_, colIdx) => (
                                        <td key={colIdx} className="p-4">
                                            <Skeleton className={`h-4 ${colIdx === 0 ? 'w-32' : 'w-20'}`} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-40" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {searchKey && (
                <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center space-x-2">
                        <Input
                            placeholder={placeholder ?? defaultPlaceholder}
                            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                                table.getColumn(searchKey)?.setFilterValue(event.target.value)
                            }
                            className="max-w-sm"
                            leftIcon={<Search className="h-4 w-4" />}
                        />
                    </div>
                </div>
            )}
            <div className="rounded-xl border border-card-border bg-card-bg backdrop-blur-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-hover">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-card-border hover:bg-transparent">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="border-card-border hover:bg-hover text-foreground transition-colors"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-auto p-0"
                                >
                                    <EmptyState
                                        variant={emptyVariant}
                                        title={emptyTitle}
                                        description={emptyDescription}
                                        actionLabel={addLabel}
                                        onAction={onAdd}
                                        className="py-12"
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Enhanced Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length > 0 ? (
                        <>
                            {isBn ? "দেখানো হচ্ছে " : "Showing "}<span className="font-medium text-foreground">{pageIndex * table.getState().pagination.pageSize + 1}</span>
                            {isBn ? " থেকে " : " to "}
                            <span className="font-medium text-foreground">
                                {Math.min((pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}
                            </span>
                            {isBn ? " / " : " of "}
                            <span className="font-medium text-foreground">{table.getFilteredRowModel().rows.length}</span>{isBn ? "টি ফল" : " results"}
                        </>
                    ) : (
                        <span>{isBn ? "কোনো ফল পাওয়া যায়নি" : "No results"}</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                        className="h-8 w-8 p-0 border-card-border"
                    >
                        <span className="sr-only">{isBn ? "প্রথম পেজে যান" : "Go to first page"}</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="h-8 w-8 p-0 border-card-border"
                    >
                        <span className="sr-only">{isBn ? "আগের পেজে যান" : "Go to previous page"}</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page Number Indicator */}
                    {pageCount > 0 && (
                        <div className="flex items-center gap-1 px-2">
                            <span className="text-sm text-muted-foreground">
                                {isBn ? "পৃষ্ঠা " : "Page "}<span className="font-medium text-foreground">{pageIndex + 1}</span>{isBn ? " / " : " of "}
                                <span className="font-medium text-foreground">{pageCount}</span>
                            </span>
                        </div>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="h-8 w-8 p-0 border-card-border"
                    >
                        <span className="sr-only">{isBn ? "পরের পেজে যান" : "Go to next page"}</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                        className="h-8 w-8 p-0 border-card-border"
                    >
                        <span className="sr-only">{isBn ? "শেষ পেজে যান" : "Go to last page"}</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
