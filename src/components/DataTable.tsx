import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  RowSelectionState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Download,
  Trash2,
  X,
  Check,
  CheckSquare,
  Square,
  MinusSquare,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from '../contexts/LanguageContext';
import { removeVietnameseTones } from '../utils/vietnamese';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  pageSize?: number;
  actionButton?: React.ReactNode;
  enableRowSelection?: boolean;
  onSelectionChange?: (selectedRows: TData[]) => void;
  onBatchDelete?: (selectedRows: TData[]) => void;
  batchActions?: (selectedRows: TData[], clearSelection: () => void) => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 10,
  actionButton,
  enableRowSelection = true,
  onSelectionChange,
  onBatchDelete,
  batchActions,
}: DataTableProps<TData, TValue>) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const defaultSearchPlaceholder = searchPlaceholder || (isEn ? 'Search data...' : 'Tìm kiếm dữ liệu...');

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Prepend checkbox selection column if row selection is enabled
  const tableColumns = useMemo(() => {
    if (!enableRowSelection) return columns;

    const selectColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            ref={(input) => {
              if (input) {
                input.indeterminate = table.getIsSomePageRowsSelected();
              }
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/30 cursor-pointer accent-amber-500"
            title={isEn ? 'Select all on this page' : 'Chọn tất cả trang này'}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/30 cursor-pointer accent-amber-500"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    };

    return [selectColumn, ...columns];
  }, [columns, enableRowSelection, isEn]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      columnVisibility,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true;
      const search = removeVietnameseTones(String(filterValue)).toLowerCase().trim();
      if (!search) return true;
      const value = row.getValue(columnId);
      if (value == null) return false;
      const target = removeVietnameseTones(String(value)).toLowerCase();
      return target.includes(search);
    },
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enableRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater);
      if (onSelectionChange) {
        // Delay slight execution to get updated selection
        setTimeout(() => {
          const selectedIndexes = Object.keys(
            typeof updater === 'function' ? updater(rowSelection) : updater
          );
          const selectedData = selectedIndexes.map((idx) => data[Number(idx)]).filter(Boolean);
          onSelectionChange(selectedData);
        }, 0);
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: pageSize,
      },
    },
  });

  const selectedRowsData = useMemo(() => {
    return table.getSelectedRowModel().rows.map((r) => r.original);
  }, [rowSelection, table]);

  const handleExportSelectedCSV = () => {
    if (selectedRowsData.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(selectedRowsData, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `export_selected_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const clearSelection = () => setRowSelection({});

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all">
      {/* Top Filter Toolbar */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={defaultSearchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all dark:text-zinc-100 shadow-2xs"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Column Visibility Menu */}
          <div className="relative">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />
              <span>{isEn ? 'Columns' : 'Cột Hiển Thị'}</span>
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-30 p-2 space-y-1 text-xs">
                <p className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {isEn ? 'Show / Hide Columns' : 'Ẩn / Hiện Cột'}
                </p>
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium capitalize"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500/20 accent-amber-500"
                      />
                      <span>
                        {typeof column.columnDef.header === 'string'
                          ? column.columnDef.header
                          : column.id}
                      </span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          {/* Page Size Selector */}
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-200 shadow-2xs focus:outline-hidden"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} {isEn ? 'rows / page' : 'hàng / trang'}
              </option>
            ))}
          </select>

          {actionButton && <div className="flex items-center gap-2">{actionButton}</div>}
        </div>
      </div>

      {/* Bulk Action Banner when 1+ rows selected */}
      {selectedRowsData.length > 0 && (
        <div className="px-4 py-2.5 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 font-black text-[11px]">
              {selectedRowsData.length}
            </span>
            <span>{isEn ? 'item(s) selected from list' : 'mục đã được chọn từ danh sách'}</span>
          </div>

          <div className="flex items-center gap-2">
            {batchActions && batchActions(selectedRowsData, clearSelection)}
            <button
              onClick={handleExportSelectedCSV}
              className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />{' '}
              {isEn ? 'Export Selected' : 'Xuất Hàng Chọn'}
            </button>
            {onBatchDelete && (
              <button
                onClick={() => {
                  onBatchDelete(selectedRowsData);
                  clearSelection();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> {isEn ? 'Delete Selected' : 'Xóa Hàng Chọn'}
              </button>
            )}
            <button
              onClick={clearSelection}
              className="p-1 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-300 transition-colors"
              title={isEn ? 'Clear selection' : 'Bỏ chọn tất cả'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className="px-4 py-3 select-none text-[11px] whitespace-nowrap relative group"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1.5 ${
                            canSort
                              ? 'cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors'
                              : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="text-zinc-400">
                              {isSorted === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-amber-500 font-bold" />
                              ) : isSorted === 'desc' ? (
                                <ArrowDown className="h-3.5 w-3.5 text-amber-500 font-bold" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Drag Column Resizer Handle */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none hover:bg-amber-500/80 transition-colors z-10 flex items-center justify-center ${
                            header.column.getIsResizing() ? 'bg-amber-500 w-2.5' : 'bg-transparent'
                          }`}
                          title={isEn ? 'Drag to adjust column width' : 'Kéo để điều chỉnh độ rộng cột'}
                        >
                          <div className="w-[2px] h-3.5 bg-zinc-300 dark:bg-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const isSelected = row.getIsSelected();
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-amber-500/10 dark:bg-amber-500/15'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="px-4 py-12 text-center text-zinc-400 dark:text-zinc-500"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Layers className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="font-semibold text-sm">
                      {isEn ? 'No matching records found' : 'Không tìm thấy dữ liệu phù hợp'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {isEn
                        ? 'Try adjusting your search terms or active filters'
                        : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modern AntD / Shadcn Style Pagination Footer */}
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50 font-medium">
        <div>
          {isEn ? 'Showing ' : 'Hiển thị '}
          <strong className="text-zinc-900 dark:text-zinc-100">
            {table.getFilteredRowModel().rows.length === 0
              ? 0
              : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
          </strong>{' '}
          {isEn ? 'to ' : 'đến '}
          <strong className="text-zinc-900 dark:text-zinc-100">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}
          </strong>{' '}
          {isEn ? 'of ' : 'trong tổng số '}
          <strong className="text-zinc-900 dark:text-zinc-100">
            {table.getFilteredRowModel().rows.length}
          </strong>{' '}
          {isEn ? 'entries' : 'bản ghi'}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            title={isEn ? 'First page' : 'Trang đầu'}
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            title={isEn ? 'Previous page' : 'Trang trước'}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-3 py-1 font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-200/60 dark:bg-zinc-800 rounded-lg">
            {isEn ? 'Page' : 'Trang'} {table.getState().pagination.pageIndex + 1} /{' '}
            {table.getPageCount() || 1}
          </span>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            title={isEn ? 'Next page' : 'Trang sau'}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            title={isEn ? 'Last page' : 'Trang cuối'}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}