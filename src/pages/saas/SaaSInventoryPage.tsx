import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Boxes, PackageCheck, AlertTriangle } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import client from '../../api/client';

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  warehouse: string;
  stock: number;
  reserved: number;
  available: number;
  unitCost: number;
  totalValue: number;
}

interface MovementItem { id: number; code: string; movement_type: string; movement_date: string; sku: string; name_vi?: string; name_en?: string; quantity: number; warehouse_vi?: string; warehouse_en?: string; }
interface XntRow { product_id: number; sku: string; name_vi?: string; unit_vi?: string; cost_price: number; opening_qty: number; in_qty: number; out_qty: number; closing_qty: number; closing_value: number; min_stock: number; }

export const SaaSInventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [xntRows, setXntRows] = useState<XntRow[]>([]);
  const [kpi, setKpi] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const [res, movementRes] = await Promise.all([client.get('/api/saas/inventory/balances'), client.get(`/api/saas/inventory/movements?${params}`)]);
      if (res.data?.ok) setItems(res.data.data.map((row: any) => ({
        id: Number(row.product_id), sku: row.sku, name: row.name_vi || row.name_en,
        warehouse: row.warehouse_vi || row.warehouse_en, stock: Number(row.stock),
        reserved: Number(row.reserved), available: Number(row.available),
        unitCost: Number(row.unit_cost), totalValue: Number(row.total_value),
      })));
      if (movementRes.data?.ok) setMovements(movementRes.data.data);
      const xntRes = await client.get(`/api/saas/inventory/xnt?from=${fromDate || '1900-01-01'}&to=${toDate || new Date().toISOString().slice(0, 10)}`);
      if (xntRes.data?.ok) { setXntRows(xntRes.data.data.rows); setKpi(xntRes.data.data.kpi); }
    };
    load().catch((error) => setLoadError(error?.response?.data?.message || error.message || 'Không tải được tồn kho từ cơ sở dữ liệu.'));
    const interval = window.setInterval(() => load().catch(console.error), 10000);
    return () => window.clearInterval(interval);
  }, [fromDate, toDate]);

  const setPreset = (preset: 'today' | 'week' | 'month' | 'year' | 'all') => {
    const now = new Date(); const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'all') { setFromDate(''); setToDate(''); return; }
    if (preset === 'today') { setFromDate(iso(now)); setToDate(iso(now)); return; }
    if (preset === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); setFromDate(iso(d)); setToDate(iso(now)); return; }
    if (preset === 'month') { setFromDate(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setToDate(iso(now)); return; }
    setFromDate(`${now.getFullYear()}-01-01`); setToDate(iso(now));
  };
  const exportCsv = () => { const lines = [['SKU','Tên hàng','ĐVT','Đơn giá vốn','Tồn đầu','Nhập','Xuất','Tồn cuối','Giá trị tồn'], ...xntRows.map(r => [r.sku, r.name_vi || '', r.unit_vi || '', r.cost_price, r.opening_qty, r.in_qty, r.out_qty, r.closing_qty, r.closing_value])]; const url = URL.createObjectURL(new Blob(['\ufeff' + lines.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'bao-cao-xnt.csv'; a.click(); URL.revokeObjectURL(url); };

  const columns: ColumnDef<InventoryItem>[] = [
    {
      accessorKey: 'sku',
      header: 'Mã SKU',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Tên Hàng Hóa',
      cell: (info) => <span className="font-semibold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'warehouse',
      header: 'Kho Hàng',
    },
    {
      accessorKey: 'stock',
      header: 'Tồn Kho Thực Tế',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as number}</span>,
    },
    {
      accessorKey: 'available',
      header: 'Khả Dụng Bán',
      cell: (info) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{info.getValue() as number}</span>,
    },
    {
      accessorKey: 'unitCost',
      header: 'Giá Vốn Bình Quân',
      cell: (info) => `${(info.getValue() as number).toLocaleString('vi-VN')} đ`,
    },
    {
      accessorKey: 'totalValue',
      header: 'Tổng Giá Trị Tồn Kho',
      cell: (info) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-amber-500" /> Báo Cáo Kiểm Kê & Định Giá Tồn Kho
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Số liệu tổng hợp tồn kho thực tế, tồn kho tạm giữ và tổng giá trị tài sản lưu kho theo phương pháp bình quân.
          </p>
        </div>
      </div>

      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      <DataTable columns={columns} data={items} searchPlaceholder="Tìm mã SKU, tên hàng hóa..." />

      <section className="space-y-4 print:space-y-2">
        <div className="flex flex-wrap gap-2 items-center"><b className="mr-2">Báo cáo Xuất Nhập Tồn</b>{[['today','Hôm nay'],['week','7 ngày qua'],['month','Tháng này'],['year','Năm nay'],['all','Tất cả']].map(([key,label]) => <button key={key} onClick={() => setPreset(key as any)} className="px-3 py-1 rounded border border-zinc-300 text-sm">{label}</button>)}<button onClick={exportCsv} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Xuất CSV</button><button onClick={() => window.print()} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">In báo cáo</button></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Tồn đầu kỳ','opening_value'],['Nhập trong kỳ','in_value'],['Xuất trong kỳ','out_value'],['Tồn cuối kỳ','closing_value']].map(([label,key]) => <div key={key} className="p-3 rounded border border-zinc-200 dark:border-zinc-800"><div className="text-xs text-zinc-500">{label}</div><div className="font-bold">{Number(kpi?.[key] || 0).toLocaleString('vi-VN')} đ</div></div>)}</div>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800"><table className="w-full text-sm"><thead className="bg-zinc-50 dark:bg-zinc-900"><tr>{['SKU','Tên hàng','ĐVT','Đơn giá vốn','Tồn đầu','Nhập','Xuất','Tồn cuối','Cảnh báo'].map(h => <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{xntRows.map(r => <tr key={r.product_id} className="border-t border-zinc-100 dark:border-zinc-800"><td className="p-3 font-mono">{r.sku}</td><td className="p-3">{r.name_vi}</td><td className="p-3">{r.unit_vi}</td><td className="p-3">{Number(r.cost_price).toLocaleString('vi-VN')}</td><td className="p-3">{r.opening_qty}</td><td className="p-3 text-emerald-600">+{r.in_qty}</td><td className="p-3 text-rose-600">-{r.out_qty}</td><td className="p-3 font-bold">{r.closing_qty}</td><td className="p-3">{r.closing_qty <= 0 ? 'Hết hàng' : r.closing_qty <= r.min_stock ? 'Dưới định mức' : 'An toàn'}</td></tr>)}</tbody></table></div>
      </section>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"><div className="font-bold text-zinc-900 dark:text-zinc-100">Nhật ký nhập xuất tồn theo thời gian</div><div className="flex items-center gap-2 text-sm"><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-zinc-300 px-2 py-1 dark:bg-zinc-900" /><span>đến</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-zinc-300 px-2 py-1 dark:bg-zinc-900" /><button onClick={() => { setFromDate(''); setToDate(''); }} className="rounded border border-zinc-300 px-2 py-1">Tất cả</button></div></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-zinc-50 dark:bg-zinc-900"><tr><th className="p-3 text-left">Thời gian</th><th className="p-3 text-left">Phiếu</th><th className="p-3 text-left">Nghiệp vụ</th><th className="p-3 text-left">Sản phẩm</th><th className="p-3 text-right">SL</th><th className="p-3 text-left">Kho</th></tr></thead><tbody>{movements.map((m) => <tr key={`${m.id}-${m.sku}`} className="border-t border-zinc-100 dark:border-zinc-800"><td className="p-3">{new Date(m.movement_date).toLocaleDateString('vi-VN')}</td><td className="p-3 font-mono">{m.code}</td><td className="p-3">{m.movement_type === 'NHAP_KHO' ? 'Nhập kho' : m.movement_type === 'XUAT_KHO' ? 'Xuất kho' : 'Điều chỉnh'}</td><td className="p-3">{m.sku} — {m.name_vi || m.name_en}</td><td className={`p-3 text-right font-bold ${m.movement_type === 'XUAT_KHO' ? 'text-rose-600' : 'text-emerald-600'}`}>{m.movement_type === 'XUAT_KHO' ? '-' : '+'}{m.quantity}</td><td className="p-3">{m.warehouse_vi || m.warehouse_en}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
};
