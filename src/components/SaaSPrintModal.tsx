import React from 'react';
import { Printer, X, Building2, CheckCircle2 } from 'lucide-react';
import { readVietnameseNumber } from '../utils/format';

export type PrintDocType = 'stock_out' | 'stock_in' | 'quotation' | 'receipt' | 'payment';

interface PrintItem {
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface SaaSPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: PrintDocType;
  docCode: string;
  docDate: string;
  partnerName: string;
  partnerAddress: string;
  partnerPhone: string;
  items: PrintItem[];
  totalAmount: number;
  taxAmount?: number;
  grandTotal?: number;
  notes?: string;
}

export const SaaSPrintModal: React.FC<SaaSPrintModalProps> = ({
  isOpen,
  onClose,
  docType,
  docCode,
  docDate,
  partnerName,
  partnerAddress,
  partnerPhone,
  items,
  totalAmount,
  taxAmount = 0,
  grandTotal = totalAmount,
  notes,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const getDocTitle = () => {
    switch (docType) {
      case 'stock_out':
        return 'PHIẾU XUẤT KHO KÈM BÀN GIAO HÀNG HÓA';
      case 'stock_in':
        return 'PHIẾU NHẬP KHO VẬT TƯ HÀNG HÓA';
      case 'quotation':
        return 'BÁO GIÁ THƯƠNG MẠI & ĐIỀU KHOẢN CUNG CẤP';
      case 'receipt':
        return 'PHIẾU THU TIỀN CÔNG NỢ';
      case 'payment':
        return 'PHIẾU CHI TIỀN THANH TOÁN';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-zinc-900 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden print:p-0 print:shadow-none print:max-w-none print:rounded-none print:max-h-none">
        {/* Action Header - Hidden during actual browser printing */}
        <div className="flex items-center justify-between border-b border-zinc-200 p-3 sm:p-4 print:hidden shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-zinc-800">Xem Trước Mẫu In Chuẩn ERP Doanh Nghiệp</span>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
              /app/templates/print/
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs"
            >
              <Printer className="h-4 w-4" /> In / Tải PDF (Ctrl + P)
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY */}
        <div id="printable-area" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 font-sans print:p-0 print:overflow-visible print:max-h-none">
          {/* Company Letterhead */}
          <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-zinc-900 text-amber-400 font-bold flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <h1 className="text-base font-extrabold text-zinc-900 uppercase tracking-tight">
                  CÔNG TY TNHH ERP-VIỆT ENTERPRISE
                </h1>
              </div>
              <p className="text-xs text-zinc-600">Địa chỉ: Lô CN2, KCN Sài Đồng, Q. Long Biên, Hà Nội</p>
              <p className="text-xs text-zinc-600">Điện thoại: 024.3888.9999 | MST: 0108889999</p>
            </div>

            <div className="text-right">
              <p className="font-mono text-xs font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-block">
                Số: {docCode}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Ngày lập: {docDate}</p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-wide">{getDocTitle()}</h2>
            <p className="text-xs italic text-zinc-500">Mẫu chứng từ ban hành theo Thông tư Kế toán 200/2014/TT-BTC</p>
          </div>

          {/* Partner & Order Info */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            <div className="space-y-1">
              <p>
                <strong className="text-zinc-700">Đơn vị / Đối tác:</strong> {partnerName}
              </p>
              <p>
                <strong className="text-zinc-700">Địa chỉ giao nhận:</strong> {partnerAddress}
              </p>
            </div>
            <div className="space-y-1">
              <p>
                <strong className="text-zinc-700">Điện thoại liên hệ:</strong> {partnerPhone}
              </p>
              <p>
                <strong className="text-zinc-700">Ghi chú / Lý do:</strong> {notes || 'Không có ghi chú thêm'}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-zinc-300 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-zinc-100 border-b border-zinc-300 font-bold text-zinc-800">
                <tr>
                  <th className="p-2.5 text-center w-10">STT</th>
                  <th className="p-2.5">Mã Hàng (SKU)</th>
                  <th className="p-2.5">Tên Hàng Hóa / Vật Tư</th>
                  <th className="p-2.5 text-center">ĐVT</th>
                  <th className="p-2.5 text-center">Số Lượng</th>
                  <th className="p-2.5 text-right">Đơn Giá</th>
                  <th className="p-2.5 text-right">Thành Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 text-center text-zinc-500 font-semibold">{idx + 1}</td>
                    <td className="p-2.5 font-mono font-bold text-amber-700">{item.sku}</td>
                    <td className="p-2.5 font-semibold text-zinc-900">{item.name}</td>
                    <td className="p-2.5 text-center">{item.unit}</td>
                    <td className="p-2.5 text-center font-bold text-zinc-800">{item.quantity}</td>
                    <td className="p-2.5 text-right">{item.unitPrice.toLocaleString('vi-VN')} đ</td>
                    <td className="p-2.5 text-right font-bold text-zinc-900">
                      {item.amount.toLocaleString('vi-VN')} đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="flex flex-col items-end gap-2 text-xs">
            <div className="w-64 space-y-1.5 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <div className="flex justify-between text-zinc-600">
                <span>Cộng tiền hàng:</span>
                <span className="font-semibold">{totalAmount.toLocaleString('vi-VN')} đ</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Thuế GTGT (VAT):</span>
                  <span className="font-semibold">{taxAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-zinc-900 border-t pt-1.5 border-zinc-300">
                <span>TỔNG CỘNG:</span>
                <span className="text-amber-700">{grandTotal.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <div className="w-full text-right text-xs italic bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-zinc-800 font-medium">
              <strong>Số tiền bằng chữ:</strong> {readVietnameseNumber(grandTotal)}
            </div>
          </div>

          {/* Signatures Block */}
          <div className="grid grid-cols-4 gap-4 text-center text-xs pt-6">
            <div>
              <p className="font-bold text-zinc-800">Người Lập Phiếu</p>
              <p className="text-[10px] text-zinc-500 italic">(Ký, họ tên)</p>
              <div className="h-16"></div>
              <p className="font-semibold">Nguyễn Văn Khoa</p>
            </div>
            <div>
              <p className="font-bold text-zinc-800">Người Giao Hàng</p>
              <p className="text-[10px] text-zinc-500 italic">(Ký, họ tên)</p>
              <div className="h-16"></div>
              <p className="font-semibold">Trần Văn Nam</p>
            </div>
            <div>
              <p className="font-bold text-zinc-800">Thủ Kho Phụ Trách</p>
              <p className="text-[10px] text-zinc-500 italic">(Ký, họ tên)</p>
              <div className="h-16"></div>
              <p className="font-semibold">Lê Minh Tuấn</p>
            </div>
            <div>
              <p className="font-bold text-zinc-800">Kế Toán / Thủ Trưởng</p>
              <p className="text-[10px] text-zinc-500 italic">(Ký, đóng dấu)</p>
              <div className="h-16"></div>
              <p className="font-semibold">Đã xác nhận</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
