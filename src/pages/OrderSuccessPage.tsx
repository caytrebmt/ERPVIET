import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, Calendar, CreditCard, Landmark, Loader2, ClipboardCheck, ArrowRight, PackageOpen } from "lucide-react";
import client from "../api/client";
import { Order } from "../types";
import { formatPrice, formatDate } from "../utils/format";
import { useToast } from "../contexts/ToastContext";

const OrderSuccessPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadOrderDetails() {
      if (!code) return;
      try {
        setLoading(true);
        const res = await client.get(`/api/shop/orders/${code}`);
        if (res.data && res.data.ok) {
          setOrder(res.data.data);
        }
      } catch (err) {
        console.error("Error loading order in success page", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrderDetails();
  }, [code]);

  const copyCodeToClipboard = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.code);
    setCopied(true);
    showToast("Đã sao chép mã đơn hàng!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-gray-500 dark:text-gray-400">Đang chuẩn bị xác nhận đơn hàng...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-4">
        <PackageOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
        <h3 className="font-semibold text-gray-750 dark:text-gray-200">Không tìm thấy đơn hàng</h3>
        <p className="text-xs text-gray-500 dark:text-gray-450 mt-1">
          Mã đơn hàng <strong className="text-indigo-600 dark:text-indigo-400">"{code}"</strong> không hợp lệ hoặc không có quyền truy cập.
        </p>
        <Link to="/" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-4">
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  // Generate real dynamic VietQR Code url using open bank imaging API (compact2 layout)
  const vietQrUrl = `https://img.vietqr.io/image/vcb-0071000123456-compact2.png?amount=${
    order.total_amount
  }&addInfo=${encodeURIComponent(order.code)}&accountName=CONG%20TY%20CONG%20NGHE%20ERP%20VIET`;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Visual Success Header Banner */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center shadow-xs flex flex-col items-center gap-3 transition-colors duration-200">
        <div className="w-12 h-12 bg-green-50 dark:bg-green-950/20 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-1">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h1 className="text-lg md:text-xl font-bold text-gray-850 dark:text-white">ĐẶT HÀNG THÀNH CÔNG!</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md leading-relaxed m-0">
          Cảm ơn bạn <strong className="text-gray-850 dark:text-gray-200">{order.customerName}</strong> đã đặt mua hàng. Đơn hàng của bạn đã được ghi nhận trên hệ thống ERPACC và đang được bộ phận vận hành xử lý.
        </p>

        {/* Copyable Order Code badge */}
        <div className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 mt-2 flex items-center gap-3 select-all">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase">Mã đơn hàng:</span>
          <span className="font-mono text-sm font-bold text-gray-950 dark:text-white">{order.code}</span>
          <button
            onClick={copyCodeToClipboard}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer hover:underline border-l border-gray-200 dark:border-gray-850 pl-3"
          >
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            {copied ? "Đã chép" : "Sao chép"}
          </button>
        </div>
      </div>

      {/* Primary details or VietQR scanner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left column details summary */}
        <div className={`flex flex-col gap-4 ${order.paymentMethod === "VIETQR" ? "md:col-span-7" : "md:col-span-12"}`}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col gap-3.5 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b border-gray-100 dark:border-gray-800 pb-2.5 uppercase tracking-wider">
              CHI TIẾT ĐƠN HÀNG
            </h3>

            <div className="flex flex-col gap-2.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Ngày lập đơn:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-250">{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Thanh toán:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  {order.paymentMethod === "COD"
                    ? "Thanh toán khi nhận (COD)"
                    : order.paymentMethod === "VIETQR"
                    ? "VietQR Chuyển khoản hỏa tốc"
                    : "Chuyển khoản Ngân hàng"}
                </span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex flex-col gap-1 text-[11px] leading-relaxed">
                <span className="font-bold text-gray-700 dark:text-gray-300">Thông tin nhận hàng:</span>
                <p className="m-0 text-gray-600 dark:text-gray-400">Họ tên: <strong className="text-gray-800 dark:text-gray-200">{order.customerName}</strong></p>
                <p className="m-0 text-gray-600 dark:text-gray-400">Điện thoại: {order.customerPhone}</p>
                <p className="m-0 text-gray-600 dark:text-gray-400">Địa chỉ giao: {order.shippingAddress}</p>
                {order.note && <p className="m-0 text-gray-500 dark:text-gray-450 italic">Ghi chú: "{order.note}"</p>}
              </div>

              {/* Items checklist summary */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
                <span className="font-bold text-gray-700 dark:text-gray-300 block mb-2">Sản phẩm đã mua:</span>
                <div className="divide-y divide-gray-50 dark:divide-gray-850 max-h-32 overflow-y-auto">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 text-[11px] text-gray-600 dark:text-gray-450">
                      <span className="truncate max-w-[70%]">{item.name} <strong className="text-gray-400 dark:text-gray-500">x{item.quantity}</strong></span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 shrink-0">{formatPrice(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-baseline font-bold">
                <span className="text-gray-900 dark:text-white text-sm">Tổng cộng thanh toán:</span>
                <span className="text-base text-indigo-600 dark:text-indigo-400">{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column VietQR dynamic scanner */}
        {order.paymentMethod === "VIETQR" && (
          <div className="md:col-span-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col items-center text-center gap-3 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b border-gray-100 dark:border-gray-800 pb-2 w-full uppercase tracking-wider">
              QUÉT MÃ VIETQR
            </h3>
            <div className="relative aspect-square w-full max-w-[200px] border border-gray-150 dark:border-gray-800 p-2 rounded-lg bg-white shadow-xs">
              <img src={vietQrUrl} alt="VietQR Vietcombank" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-gray-500 dark:text-gray-450 leading-normal max-w-[220px]">
              <p className="m-0 font-bold text-indigo-600 dark:text-indigo-400">Quét mã bằng ứng dụng Ngân hàng (Mobile Banking)</p>
              <p className="m-0">Mã QR đã chứa chính xác số tiền <strong className="text-gray-800 dark:text-gray-200">{formatPrice(order.total_amount)}</strong> và nội dung chuyển tiền <strong className="text-gray-800 dark:text-gray-200">{order.code}</strong> để tự động duyệt đơn hỏa tốc.</p>
            </div>
          </div>
        )}
      </div>

      {/* Secondary CTAs */}
      <div className="flex justify-center gap-4 border-t border-gray-200 dark:border-gray-800 pt-6">
        <Link
          to="/"
          className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold px-6 py-2.5 rounded-full shadow-xs transition-colors cursor-pointer"
        >
          Tiếp tục mua sắm
        </Link>
        <Link
          to="/orders"
          className="border border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-xs font-bold px-6 py-2.5 rounded-full transition-all cursor-pointer flex items-center gap-1 shadow-xs"
        >
          Quản lý đơn hàng
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
export {};
