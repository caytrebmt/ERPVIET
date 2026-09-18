import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Receipt, FileSpreadsheet, Download, Filter, CheckCircle2, ArrowDownLeft, ArrowUpRight, Calculator } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import client from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [vatType, setVatType] = useState<'output' | 'input'>('output');
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [records, setRecords] = useState<VatRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client.get(`/api/saas/vat/summary?month=${month}&year=${year}`)
      .then((response) => {
        if (cancelled) return;
        if (!response.data?.ok) throw new Error(response.data?.message || 'Không tải được VAT.');
        setRecords((response.data.data?.records || []).map((row: any, index: number) => ({
          id: Number(row.id) || index, code: row.code, date: row.date, partnerName: row.partner_name || '',
          taxCode: row.tax_code || '', description: row.description || '', vatRate: Number(row.vatRate) || 0,
          taxableAmount: Number(row.taxableAmount) || 0, vatAmount: Number(row.vatAmount) || 0,
          totalAmount: Number(row.totalAmount) || 0, vatType: row.vat_type,
        })));
        setLoadError(null);
      })
      .catch((error: any) => { if (!cancelled) setLoadError(error?.response?.data?.message || error.message || 'Không tải được dữ liệu VAT từ cơ sở dữ liệu.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, year]);

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
      header: t('saas_v_a_t_ma_hoa_d_n_chung_t', 'Mã Hóa Đơn / Chứng Từ'),
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-xs border border-amber-200 dark:border-amber-800">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'date',
      header: t('saas_v_a_t_ngay_hoa_d_n', 'Ngày Hóa Đơn'),
    },
    {
      accessorKey: 'partnerName',
      header: t('doi_tac_kh_ncc', 'Đối Tác (KH / NCC)'),
      cell: (info) => (
        <div>
          <p className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</p>
          <p className="text-[11px] text-zinc-500">{t('mst', 'MST:')}{info.row.original.taxCode}</p>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: t('saas_v_a_t_dien_giai_hang_hoa_dich_vu', 'Diễn Giải Hàng Hóa Dịch Vụ'),
      cell: (info) => <span className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs truncate block">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'vatRate',
      header: t('saas_v_a_t_thue_suat_gtgt', 'Thuế Suất GTGT'),
      cell: (info) => (
        <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
          {info.getValue() as number}%
        </span>
      ),
    },
    {
      accessorKey: 'taxableAmount',
      header: t('saas_v_a_t_doanh_so_ch_a_thue', 'Doanh Số Chưa Thuế'),
      cell: (info) => (
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'vatAmount',
      header: t('vat_amount', 'Tiền Thuế GTGT'),
      cell: (info) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: t('saas_v_a_t_tong_tien_thanh_toan', 'Tổng Tiền Thanh Toán'),
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
            <Receipt className="h-6 w-6 text-amber-500" /> {t('ke_khai_quan_ly_thue', 'Kê Khai & Quản Lý Thuế GTGT (VAT)')}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t('bang_ke_hoa_don_gtgt', 'Bảng kê hóa đơn GTGT hàng hóa bán ra (VAT đầu ra) & mua vào (VAT đầu vào), tính trừ nghĩa vụ thuếGTGT phải nộp (`/app/templates/vat`).')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200">
            <Download className="h-4 w-4" /> {t('export_excel', 'Xuất Excel')}</button>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold">
            <FileSpreadsheet className="h-4 w-4" /> {t('bang_ke_thue_gtgt', 'Bảng kê Thuế GTGT')}</button>
        </div>
      </div>

      {/* VAT Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <span className="flex items-center gap-1"><ArrowUpRight className="h-4 w-4" /> {t('vat_ban_ra_dau_ra', 'VAT Bán Ra (Đầu Ra)')}</span>
            <span>TK 3331</span>
          </div>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {vatOutputTotal.toLocaleString('vi-VN')} đ
          </p>
          <p className="text-[11px] text-zinc-500">{t('thue_gtgt_phai_nop_phat', 'Thuế GTGT phải nộp phát sinh từ hóa đơn bán ra')}</p>
        </div>

        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-bold">
            <span className="flex items-center gap-1"><ArrowDownLeft className="h-4 w-4" /> {t('vat_mua_vao_khau_tru', 'VAT Mua Vào (Khấu Trừ)')}</span>
            <span>TK 1331</span>
          </div>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
            {vatInputTotal.toLocaleString('vi-VN')} đ
          </p>
          <p className="text-[11px] text-zinc-500">{t('thue_gtgt_duoc_khau_tru', 'Thuế GTGT được khấu trừ từ hóa đơn nhập kho mua vào')}</p>
        </div>

        <div className={`p-4 rounded-xl border space-y-1 ${
          netVatPayable >= 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-purple-500/10 border-purple-500/20'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1"><Calculator className="h-4 w-4" /> {t('saas_v_a_t_vat_nghia_vu_thue_phai_nop', 'VAT Nghĩa Vụ Thuế Phải Nộp')}</span>
            <span>{netVatPayable >= 0 ? t('saas_v_a_t_phai_nop', 'Phải Nộp') : t('saas_v_a_t_d_oc_chuyen_ky_sau', 'Được Chuyển Kỳ Sau')}</span>
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
            <ArrowUpRight className="h-4 w-4" /> {t('bang_ke_vat_ban_ra', 'Bảng Kê VAT Bán Ra (Đầu Ra)')}</button>
          <button
            onClick={() => setVatType('input')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              vatType === 'input' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" /> {t('bang_ke_vat_mua_vao', 'Bảng Kê VAT Mua Vào (Đầu Vào)')}</button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-4 w-4 text-zinc-400" />
          <span className="text-zinc-500 font-medium">{t('saas_v_a_t_thang', 'Tháng:')}</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-bold"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {t('thang', 'Tháng')}{m}
              </option>
            ))}
          </select>
          <span className="text-zinc-500 font-medium">{t('saas_v_a_t_n_m', 'Năm:')}</span>
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

      {loading && <p className="text-xs text-zinc-500">{t('dang_tai_vat_tu_postgresql', 'Đang tải VAT từ PostgreSQL...')}</p>}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {/* Main Table */}
      <DataTable columns={columns} data={filteredRecords} searchPlaceholder={t('tim_ma_hoa_don_ten', 'Tìm mã hóa đơn, tên đối tác, mã số thuế...')} />

      {/* Table Foot Summary */}
      <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-bold">
        <span className="text-zinc-700 dark:text-zinc-300">
          {t('tong_cong_thang', 'TỔNG CỘNG THÁNG')}{month}/{year} ({vatType === 'output' ? 'BÁN RA' : 'MUA VÀO'}):
        </span>
        <div className="flex items-center gap-6">
          <span>{t('doanh_so', 'Doanh số:')}<strong className="text-zinc-900 dark:text-zinc-100">{totalTaxable.toLocaleString('vi-VN')} đ</strong></span>
          <span>{t('tien_vat_2', 'Tiền VAT:')}<strong className="text-amber-600 dark:text-amber-400">{totalVat.toLocaleString('vi-VN')} đ</strong></span>
          <span>{t('saas_stock_out_tong_thanh_toan', 'Tổng thanh toán:')}<strong className="text-emerald-600 dark:text-emerald-400">{totalAmount.toLocaleString('vi-VN')} đ</strong></span>
        </div>
      </div>
    </div>
  );
};
