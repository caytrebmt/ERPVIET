import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Receipt, FileSpreadsheet, Download, Filter, CheckCircle2, ArrowDownLeft, ArrowUpRight, Calculator } from 'lucide-react';
import { DataTable } from '../../components/DataTable';

interface VatRecordItem {
  id: number;
  code: string; // Mã hóa đơn / chứng từ
  date: string;
  partnerName: string;
  taxCode: string; // Mã số thuế
  description: string;
  vatRate: number; // 0, 5, 8, 10%
  taxableAmount: number; // Dân số tính thuế
  vatAmount: number; // Tiền thuế GTGT
  totalAmount: number; // Tổng tiền
  vatType: 'output' | 'input'; // VAT đầu ra hay đầu vào
}

export const SaaSVATPage: React.FC = () => {
  const [vatType, setVatType] = useState<'output' | 'input'>('output');
  const [month, setMonth] = useState<number>(7);
  const [year, setYear] = useState<number>(2026);

  const [records] = useState<VatRecordItem[]>([
    {
      id: 1,
      code: 'HD-XK-001',
      date: '2026-07-28',
      partnerName: 'Công ty TNHH Giải Pháp Công Nghệ Việt',
      taxCode: '0101234567',
      description: 'Xuất bán Laptop Dell Inspiron 15 theo PXK-001',
      vatRate: 10,
      taxableAmount: 155000000,
      vatAmount: 15500000,
      totalAmount: 170500000,
      vatType: 'output',
    },
    {
      id: 2,
      code: 'HD-XK-002',
      date: '2026-07-25',
      partnerName: 'Nguyễn Văn Minh (Cửa hàng Tin Học)',
      taxCode: '0109876543',
      description: 'Xuất bán Giấy A4 Double A theo PXK-002',
      vatRate: 8,
      taxableAmount: 52000000,
      vatAmount: 4160000,
      totalAmount: 56160000,
      vatType: 'output',
    },
    {
      id: 3,
      code: 'HD-NK-088',
      date: '2026-07-15',
      partnerName: 'Tổng Công Ty Giấy & Bao Bì Double A Việt Nam',
      taxCode: '0301122334',
      description: 'Nhập kho lô giấy A4 theo PNK-001',
      vatRate: 8,
      taxableAmount: 120000000,
      vatAmount: 9600000,
      totalAmount: 12960000,
      vatType: 'input',
    },
    {
      id: 4,
      code: 'HD-NK-092',
      date: '2026-07-10',
      partnerName: 'Nhà Phân Phối Linh Kiện Máy Tính SPC',
      taxCode: '0305566778',
      description: 'Nhập kho Laptop Dell theo PNK-002',
      vatRate: 10,
      taxableAmount: 200000000,
      vatAmount: 20000000,
      totalAmount: 220000000,
      vatType: 'input',
    },
  ]);

  const filteredRecords = records.filter((r) => r.vatType === vatType);

  const totalTaxable = filteredRecords.reduce((sum, r) => sum + r.taxableAmount, 0);
  const totalVat = filteredRecords.reduce((sum, r) => sum + r.vatAmount, 0);
  const totalAmount = filteredRecords.reduce((sum, r) => sum + r.totalAmount, 0);

  const vatOutputTotal = records.filter((r) => r.vatType === 'output').reduce((sum, r) => sum + r.vatAmount, 0);
  const vatInputTotal = records.filter((r) => r.vatType === 'input').reduce((sum, r) => sum + r.vatAmount, 0);
  const netVatPayable = vatOutputTotal - vatInputTotal;

  const columns: ColumnDef<VatRecordItem>[] = [
    {
      accessorKey: 'code',
      header: 'Mã Hóa Đơn / Chứng Từ',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-xs border border-amber-200 dark:border-amber-800">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Ngày Hóa Đơn',
    },
    {
      accessorKey: 'partnerName',
      header: 'Đối Tác (KH / NCC)',
      cell: (info) => (
        <div>
          <p className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</p>
          <p className="text-[11px] text-zinc-500">MST: {info.row.original.taxCode}</p>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Diễn Giải Hàng Hóa Dịch Vụ',
      cell: (info) => <span className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs truncate block">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'vatRate',
      header: 'Thuế Suất GTGT',
      cell: (info) => (
        <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
          {info.getValue() as number}%
        </span>
      ),
    },
    {
      accessorKey: 'taxableAmount',
      header: 'Doanh Số Chưa Thuế',
      cell: (info) => (
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'vatAmount',
      header: 'Tiền Thuế GTGT',
      cell: (info) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng Tiền Thanh Toán',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-amber-500" /> Kê Khai & Quản Lý Thuế GTGT (VAT)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Bảng kê hóa đơn GTGT hàng hóa bán ra (VAT đầu ra) & mua vào (VAT đầu vào), tính trừ nghĩa vụ thuếGTGT phải nộp (`/app/templates/vat`).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200">
            <Download className="h-4 w-4" /> Xuất Excel
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold">
            <FileSpreadsheet className="h-4 w-4" /> Bảng kê Thuế GTGT
          </button>
        </div>
      </div>

      {/* VAT Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <span className="flex items-center gap-1"><ArrowUpRight className="h-4 w-4" /> VAT Bán Ra (Đầu Ra)</span>
            <span>TK 3331</span>
          </div>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {vatOutputTotal.toLocaleString('vi-VN')} đ
          </p>
          <p className="text-[11px] text-zinc-500">Thuế GTGT phải nộp phát sinh từ hóa đơn bán ra</p>
        </div>

        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-bold">
            <span className="flex items-center gap-1"><ArrowDownLeft className="h-4 w-4" /> VAT Mua Vào (Khấu Trừ)</span>
            <span>TK 1331</span>
          </div>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
            {vatInputTotal.toLocaleString('vi-VN')} đ
          </p>
          <p className="text-[11px] text-zinc-500">Thuế GTGT được khấu trừ từ hóa đơn nhập kho mua vào</p>
        </div>

        <div className={`p-4 rounded-xl border space-y-1 ${
          netVatPayable >= 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-purple-500/10 border-purple-500/20'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1"><Calculator className="h-4 w-4" /> VAT Nghĩa Vụ Thuế Phải Nộp</span>
            <span>{netVatPayable >= 0 ? 'Phải Nộp' : 'Được Chuyển Kỳ Sau'}</span>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {Math.abs(netVatPayable).toLocaleString('vi-VN')} đ
          </p>
          <p className="text-[11px] text-zinc-500">
            {netVatPayable >= 0 ? 'Số tiền thuế GTGT phải nộp Ngân sách Nhà nước' : 'Số tiền thuế GTGT còn được khấu trừ chuyển kỳ sau'}
          </p>
        </div>
      </div>

      {/* Filter Period & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVatType('output')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              vatType === 'output' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" /> Bảng Kê VAT Bán Ra (Đầu Ra)
          </button>
          <button
            onClick={() => setVatType('input')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              vatType === 'input' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" /> Bảng Kê VAT Mua Vào (Đầu Vào)
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-4 w-4 text-zinc-400" />
          <span className="text-zinc-500 font-medium">Tháng:</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-bold"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>
          <span className="text-zinc-500 font-medium">Năm:</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-bold"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <DataTable columns={columns} data={filteredRecords} searchPlaceholder="Tìm mã hóa đơn, tên đối tác, mã số thuế..." />

      {/* Table Foot Summary */}
      <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-bold">
        <span className="text-zinc-700 dark:text-zinc-300">
          TỔNG CỘNG THÁNG {month}/{year} ({vatType === 'output' ? 'BÁN RA' : 'MUA VÀO'}):
        </span>
        <div className="flex items-center gap-6">
          <span>Doanh số: <strong className="text-zinc-900 dark:text-zinc-100">{totalTaxable.toLocaleString('vi-VN')} đ</strong></span>
          <span>Tiền VAT: <strong className="text-amber-600 dark:text-amber-400">{totalVat.toLocaleString('vi-VN')} đ</strong></span>
          <span>Tổng thanh toán: <strong className="text-emerald-600 dark:text-emerald-400">{totalAmount.toLocaleString('vi-VN')} đ</strong></span>
        </div>
      </div>
    </div>
  );
};
