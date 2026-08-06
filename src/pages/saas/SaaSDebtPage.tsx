import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Receipt, DollarSign, Clock, Plus, ArrowDownLeft, ArrowUpRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';

interface DebtItem {
  id: number;
  partnerName: string;
  type: 'Phải thu KH' | 'Phải trả NCC';
  initialBalance: number;
  increment: number;
  decrement: number;
  closingBalance: number;
  dueDate: string;
  agingDays: number; // Số ngày quá hạn
  status: 'Trong hạn' | 'Trễ nợ <30 ngày' | 'Nợ xấu >60 ngày';
}

export const SaaSDebtPage: React.FC = () => {
  const [partnerTypeTab, setPartnerTypeTab] = useState<'customer' | 'supplier' | 'aging'>('customer');

  const [debts, setDebts] = useState<DebtItem[]>([
    {
      id: 1,
      partnerName: 'Công ty TNHH Giải Pháp Công Nghệ Việt',
      type: 'Phải thu KH',
      initialBalance: 25000000,
      increment: 38000000,
      decrement: 18000000,
      closingBalance: 45000000,
      dueDate: '2026-08-15',
      agingDays: 0,
      status: 'Trong hạn',
    },
    {
      id: 2,
      partnerName: 'Nguyễn Văn Minh (Cửa hàng Tin Học)',
      type: 'Phải thu KH',
      initialBalance: 10000000,
      increment: 12500000,
      decrement: 10000000,
      closingBalance: 12500000,
      dueDate: '2026-07-20',
      agingDays: 9,
      status: 'Trễ nợ <30 ngày',
    },
    {
      id: 3,
      partnerName: 'Tổng Công Ty Giấy & Bao Bì Double A Việt Nam',
      type: 'Phải trả NCC',
      initialBalance: 80000000,
      increment: 45000000,
      decrement: 5000000,
      closingBalance: 120000000,
      dueDate: '2026-08-10',
      agingDays: 0,
      status: 'Trong hạn',
    },
    {
      id: 4,
      partnerName: 'Nhà Phân Phối Linh Kiện Máy Tính SPC',
      type: 'Phải trả NCC',
      initialBalance: 20000000,
      increment: 60000000,
      decrement: 20000000,
      closingBalance: 60000000,
      dueDate: '2026-08-05',
      agingDays: 0,
      status: 'Trong hạn',
    },
  ]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('bank');
  const [paymentNote, setPaymentNote] = useState('');

  const handleOpenPayment = (debt: DebtItem) => {
    setSelectedDebt(debt);
    setPaymentAmount(debt.closingBalance);
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || paymentAmount <= 0) return;

    const updated = debts.map((d) => {
      if (d.id === selectedDebt.id) {
        const newClosing = Math.max(0, d.closingBalance - paymentAmount);
        return {
          ...d,
          decrement: d.decrement + paymentAmount,
          closingBalance: newClosing,
        };
      }
      return d;
    });

    setDebts(updated);
    setShowPaymentModal(false);
  };

  const filteredDebts = debts.filter((d) => {
    if (partnerTypeTab === 'customer') return d.type === 'Phải thu KH';
    if (partnerTypeTab === 'supplier') return d.type === 'Phải trả NCC';
    return true;
  });

  const totalClosing = filteredDebts.reduce((sum, d) => sum + d.closingBalance, 0);

  const columns: ColumnDef<DebtItem>[] = [
    {
      accessorKey: 'partnerName',
      header: 'Đối Tác / Đơn Vị',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Phân Loại',
      cell: (info) => {
        const isRec = info.getValue() === 'Phải thu KH';
        return (
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isRec
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
            }`}
          >
            {info.getValue() as string}
          </span>
        );
      },
    },
    {
      accessorKey: 'initialBalance',
      header: 'Dư Đầu Kỳ',
      cell: (info) => `${(info.getValue() as number).toLocaleString('vi-VN')} đ`,
    },
    {
      accessorKey: 'increment',
      header: 'Phát Sinh Tăng',
      cell: (info) => <span className="text-emerald-600 font-medium">+{(info.getValue() as number).toLocaleString('vi-VN')} đ</span>,
    },
    {
      accessorKey: 'decrement',
      header: 'Đã Thu / Đã Trả',
      cell: (info) => <span className="text-red-600 font-medium">-{(info.getValue() as number).toLocaleString('vi-VN')} đ</span>,
    },
    {
      accessorKey: 'closingBalance',
      header: 'Còn Dư Cuối Kỳ',
      cell: (info) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái Tuổi Nợ',
      cell: (info) => <StatusBadge status={info.getValue() as string} />,
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: (info) => (
        <button
          onClick={() => handleOpenPayment(info.row.original)}
          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1"
        >
          <DollarSign className="h-3.5 w-3.5" /> {info.row.original.type === 'Phải thu KH' ? 'Thu Nợ' : 'Chi Trả Nợ'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-amber-500" /> Sổ Quản Lý Công Nợ & Thu Chi Nợ
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Theo dõi nợ phải thu KH, nợ phải trả NCC, lập phiếu thu / phiếu chi nợ và phân tích tuổi nợ (`/app/templates/debt`).
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setPartnerTypeTab('customer')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            partnerTypeTab === 'customer'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4" /> Công Nợ Phải Thu Khách Hàng (TK 131)
        </button>
        <button
          onClick={() => setPartnerTypeTab('supplier')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            partnerTypeTab === 'supplier'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" /> Công Nợ Phải Trả Nhà Cung Cấp (TK 331)
        </button>
        <button
          onClick={() => setPartnerTypeTab('aging')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            partnerTypeTab === 'aging'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Clock className="h-4 w-4" /> Phân Tích Tuổi Nợ & Hạn Thanh Toán
        </button>
      </div>

      {/* Content depending on tab */}
      {partnerTypeTab !== 'aging' ? (
        <DataTable columns={columns} data={filteredDebts} searchPlaceholder="Tìm tên đối tác công nợ..." />
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> Báo Cáo Phân Tích Tuổi Nợ Khách Hàng & NCC
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
              <span className="font-bold text-emerald-700 dark:text-emerald-300">TRONG HẠN THANH TOÁN</span>
              <p className="text-lg font-extrabold text-emerald-800 dark:text-emerald-200">165,000,000 đ</p>
              <p className="text-[10px] text-zinc-500">Chưa đến hạn hợp đồng</p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
              <span className="font-bold text-amber-700 dark:text-amber-300">TRỄ NỢ DƯỚI 30 NGÀY</span>
              <p className="text-lg font-extrabold text-amber-800 dark:text-amber-200">12,500,000 đ</p>
              <p className="text-[10px] text-zinc-500">Cần nhắc thanh toán đợt 1</p>
            </div>

            <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 space-y-1">
              <span className="font-bold text-orange-700 dark:text-orange-300">TRỄ NỢ 30 - 60 NGÀY</span>
              <p className="text-lg font-extrabold text-orange-800 dark:text-orange-200">0 đ</p>
              <p className="text-[10px] text-zinc-500">Cần gửi biên bản đối soát nợ</p>
            </div>

            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-1">
              <span className="font-bold text-red-700 dark:text-red-300">NỢ QUÁ HẠN TRÊN 60 NGÀY</span>
              <p className="text-lg font-extrabold text-red-800 dark:text-red-200">0 đ</p>
              <p className="text-[10px] text-zinc-500">Cảnh báo nợ khó đòi</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Total */}
      <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex justify-between items-center text-xs font-bold">
        <span className="text-zinc-700 dark:text-zinc-300">TỔNG DƯ NỢ HIỆN TẠI:</span>
        <span className="text-amber-600 dark:text-amber-400 text-base">{totalClosing.toLocaleString('vi-VN')} đ</span>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedDebt && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-500" />
              {selectedDebt.type === 'Phải thu KH' ? 'Lập Phiếu Thu Tiền Nợ' : 'Lập Phiếu Chi Trả Nợ'}
            </h3>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-1 text-xs">
              <p>
                <strong>Đối tác:</strong> {selectedDebt.partnerName}
              </p>
              <p>
                <strong>Số dư nợ còn lại:</strong>{' '}
                <span className="font-bold text-amber-600">{selectedDebt.closingBalance.toLocaleString('vi-VN')} đ</span>
              </p>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Số Tiền Thanh Toán (VNĐ) *
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  max={selectedDebt.closingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Hình Thức Thanh Toán
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'bank')}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-semibold"
                >
                  <option value="bank">Chuyển khoản Ngân hàng (TK 112)</option>
                  <option value="cash">Tiền mặt tại quỹ (TK 111)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Ghi Chú / Mã Chứng Từ Chuyển Khoản</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="VD: Thu nợ chuyển khoản VCB-1123..."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs"
                >
                  Xác Nhận Thu / Chi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
