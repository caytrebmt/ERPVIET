import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, User, Phone, MapPin, Loader2, Coins, Receipt, XCircle, RefreshCw, ShoppingCart, Info, CheckCircle } from "lucide-react";
import client from "../api/client";
import { Order } from "../types";
import { formatPrice, formatDate } from "../utils/format";
import { useToast } from "../contexts/ToastContext";
import { useCart } from "../contexts/CartContext";

const OrderDetailPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { fetchCart } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadOrderDetails = async () => {
    if (!code) return;
    try {
      setLoading(true);
      const res = await client.get(`/api/shop/orders/code/${code}`);
      if (res.data && res.data.ok) {
        setOrder(res.data.data);
      } else {
        showToast("Không tìm thấy thông tin đơn hàng này.", "error");
        navigate("/orders");
      }
    } catch (err) {
      console.error("Error loading order detail page", err);
      showToast("Có lỗi xảy ra khi tải thông tin đơn hàng.", "error");
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderDetails();
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const interval = setInterval(() => {
      loadOrderDetails();
    }, 30000);
    return () => clearInterval(interval);
  }, [code]);

  const handleCancelOrder = async () => {
    if (!order) return;
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này không?")) return;

    try {
      setSubmittingAction(true);
      const res = await client.post(`/api/shop/orders/${order.id}/cancel`);
      if (res.data && res.data.ok) {
        showToast("Hủy đơn hàng thành công!", "success");
        setOrder(res.data.data); // Update status locally
      } else {
        showToast(res.data.message || "Không thể hủy đơn hàng", "error");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Lỗi khi hủy đơn hàng.";
      showToast(msg, "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    try {
      setSubmittingAction(true);
      const res = await client.post(`/api/shop/orders/${order.id}/reorder`);
      if (res.data && res.data.ok) {
        showToast("Sản phẩm đã được thêm vào giỏ hàng thành công!", "success");
        await fetchCart(); // Force update cart badge count
        navigate("/cart");
      } else {
        showToast(res.data.message || "Không thể mua lại", "error");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Lỗi khi thực hiện mua lại.";
      showToast(msg, "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-300";
      case "pending":
        return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300";
      case "confirmed":
        return "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-300";
      case "cancelled":
        return "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-850 dark:border-gray-800 dark:text-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return "Đơn mới nhận";
      case "pending":
        return "Chờ thanh toán";
      case "confirmed":
        return "Đã xác nhận";
      case "cancelled":
        return "Đã hủy bỏ";
      default:
        return status;
    }
  };

  const isErpApproved = (): boolean => {
    if (!order?.erp_status) return false;
    const s = order.erp_status.toLowerCase();
    return s.includes("pxk") || s.includes("duyệt") || s.includes("xuất kho") || s.includes("đóng gói") || s.includes("shipper") || s.includes("vận chuyển") || s.includes("giao") || s.includes("hoàn thành");
  };

  const isPackingOrShipped = (): boolean => {
    if (!order?.erp_status) return false;
    const s = order.erp_status.toLowerCase();
    return s.includes("đóng gói") || s.includes("shipper") || s.includes("vận chuyển") || s.includes("giao") || s.includes("hoàn thành") || order.status === "completed";
  };

  const isDelivered = (): boolean => {
    if (!order?.erp_status) return false;
    const s = order.erp_status.toLowerCase();
    return s.includes("đã giao") || s.includes("hoàn thành") || order.status === "completed";
  };

  const getErpStatusLabel = (): string => {
    if (!order?.erp_status) return "Đang chờ duyệt kho";
    return order.erp_status;
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-gray-500 dark:text-gray-400">Đang truy xuất thông tin chi tiết đơn hàng...</p>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  // VietQR parameters integration
  const showVietQr = order.paymentMethod === "VIETQR" && (order.status === "new" || order.status === "pending");
  const vietQrUrl = `https://img.vietqr.io/image/vcb-0071000123456-compact2.png?amount=${order.total_amount}&addInfo=${encodeURIComponent(order.code)}&accountName=CONG%20TY%20CONG%20NGHE%20ERP%20VIET`;

  return (
    <div className="flex flex-col gap-6">
      {/* Header breadcrumb link */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <Link to="/orders" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-450 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-850 dark:text-white m-0 uppercase flex items-center gap-2">
              CHI TIẾT ĐƠN HÀNG <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black text-sm select-all">{order.code}</span>
            </h1>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 m-0 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 shrink-0" /> Ngày tạo: <strong className="dark:text-gray-300">{formatDate(order.createdAt)}</strong>
            </p>
          </div>
        </div>

        {/* Status badges header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold border px-3 py-1 rounded-full uppercase ${getStatusBadgeClass(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
          {order.erp_status && (
            <span className={`text-xs font-bold border px-3 py-1 rounded-full uppercase ${
              order.erp_status === "Đã xuất kho"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300"
                : order.erp_status === "Đã hủy"
                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300"
                : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300"
            }`}>
              {order.erp_status}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main core content col-8 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Order Items Table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs flex flex-col transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs bg-gray-50/70 dark:bg-gray-850/30 p-4 border-b border-gray-100 dark:border-gray-800 uppercase tracking-wider">
              DANH SÁCH SẢN PHẨM ĐÃ ĐẶT MUA
            </h3>

            {/* Headers Desktop */}
            <div className="hidden md:grid grid-cols-12 gap-2 bg-gray-50/30 dark:bg-gray-850/10 px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase border-b border-gray-50 dark:border-gray-800">
              <div className="col-span-6">Sản phẩm</div>
              <div className="col-span-2 text-center">Đơn giá</div>
              <div className="col-span-2 text-center">Số lượng</div>
              <div className="col-span-2 text-right">Thành tiền</div>
            </div>

            {/* List */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {order.items.map((item) => (
                <div key={item.id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center relative text-xs">
                  <div className="col-span-1 md:col-span-6 flex flex-col">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 m-0 leading-tight">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1 font-mono m-0">SKU: {item.sku}</p>
                  </div>
                  <div className="col-span-1 md:col-span-2 md:text-center flex justify-between md:block">
                    <span className="text-gray-400 md:hidden font-medium">Đơn giá:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{formatPrice(item.unit_price)}</span>
                  </div>
                  <div className="col-span-1 md:col-span-2 md:text-center flex justify-between md:block">
                    <span className="text-gray-400 md:hidden font-medium">Số lượng:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{item.quantity}</span>
                  </div>
                  <div className="col-span-1 md:col-span-2 flex justify-between md:block text-right">
                    <span className="text-gray-400 md:hidden font-medium">Tổng tiền:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formatPrice(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logistics Tracking Timeline Information */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col gap-4 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-2.5 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> LỘ TRÌNH ĐƠN HÀNG (ERPACC SYNC)
            </h3>

            <div className="flex flex-col gap-4 text-xs pl-3 relative border-l border-gray-100 dark:border-gray-800">
              {/* Point 1 */}
              <div className="relative">
                <span className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ring-4 ${order.status === "cancelled" ? "bg-red-500 ring-red-100 dark:ring-red-950" : "bg-indigo-600 ring-indigo-50 dark:ring-indigo-950"}`}></span>
                <p className="font-bold text-gray-850 dark:text-white m-0 leading-tight">Ghi nhận đơn hàng trên WebShop</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 m-0">Thời gian: {formatDate(order.createdAt)}</p>
              </div>

              {/* Point 2 */}
              {order.status !== "cancelled" ? (
                <>
                  <div className="relative">
                    <span className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ring-4 ${isErpApproved() ? "bg-indigo-600 ring-indigo-50 dark:ring-indigo-950" : "bg-amber-400 ring-amber-50 dark:ring-amber-950"}`}></span>
                    <p className={`font-bold m-0 leading-tight ${isErpApproved() ? "text-gray-800 dark:text-gray-200" : "text-amber-600 dark:text-amber-400"}`}>Đồng bộ ERPACC & Duyệt Kho Hàng</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 m-0">Trạng thái ERP: <strong className="text-gray-800 dark:text-gray-200">{getErpStatusLabel()}</strong></p>
                    {order.erp_note && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 m-0 italic bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                        💬 "{order.erp_note}"
                      </p>
                    )}
                  </div>

                  {/* Point 3 */}
                  <div className="relative">
                    <span className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ring-4 ${isPackingOrShipped() ? "bg-emerald-600 ring-emerald-50 dark:ring-emerald-950" : isErpApproved() ? "bg-amber-400 ring-amber-50 dark:ring-amber-950" : "bg-gray-300 dark:bg-gray-800 ring-gray-100 dark:ring-gray-900"}`}></span>
                    <p className={`font-bold m-0 leading-tight ${isPackingOrShipped() ? "text-emerald-700 dark:text-emerald-400" : isErpApproved() ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-550"}`}>
                      Đóng gói & Bàn giao Shipper
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 m-0">
                      {isPackingOrShipped() ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Đã đóng gói hoàn tất & Đã bàn giao đơn vị vận chuyển</span>
                      ) : isErpApproved() ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">📦 Đang đóng gói kho & chuẩn bị bàn giao Shipper</span>
                      ) : (
                        "Chờ duyệt ERP"
                      )}
                    </p>
                  </div>

                  {/* Point 4 */}
                  <div className="relative">
                    <span className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ring-4 ${isDelivered() ? "bg-emerald-600 ring-emerald-50 dark:ring-emerald-950" : "bg-gray-300 dark:bg-gray-800 ring-gray-100 dark:ring-gray-900"}`}></span>
                    <p className={`font-bold m-0 leading-tight ${isDelivered() ? "text-emerald-700 dark:text-emerald-400" : "text-gray-400 dark:text-gray-550"}`}>
                      Giao hàng & Hoàn tất đơn hàng
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 m-0">
                      {isDelivered() ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">🎉 Đã giao hàng thành công đến địa chỉ người nhận</span>
                      ) : (
                        "Chờ đơn vị vận chuyển phát hàng"
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <div className="relative">
                  <span className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ring-4 bg-red-500 ring-red-100 dark:ring-red-950"></span>
                  <p className="font-bold text-red-600 dark:text-red-400 m-0 leading-tight">Đơn hàng đã hủy bỏ</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 m-0">Tồn kho đã được hoàn trả lại hệ thống ERP.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info panel col-4 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Shipping & Payment details */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col gap-3.5 text-xs text-gray-600 dark:text-gray-400 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-2 uppercase tracking-wider">
              THÔNG TIN GIAO NHẬN
            </h3>

            <div className="flex flex-col gap-2.5">
              <p className="m-0 flex items-center gap-1.5">
                <User className="w-4 h-4 text-gray-400 dark:text-gray-550 shrink-0" /> Họ tên: <strong className="text-gray-800 dark:text-gray-200">{order.customerName}</strong>
              </p>
              <p className="m-0 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-gray-400 dark:text-gray-550 shrink-0" /> Điện thoại: <strong className="text-gray-800 dark:text-gray-200">{order.customerPhone}</strong>
              </p>
              <p className="m-0 flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-550 shrink-0 mt-0.5" /> Địa chỉ: <span className="text-gray-700 dark:text-gray-300 leading-normal">{order.shippingAddress}</span>
              </p>
              {order.note && (
                <div className="bg-gray-50 dark:bg-gray-850 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 italic">
                  Ghi chú: "{order.note}"
                </div>
              )}
            </div>
          </div>

          {/* Totals panel calculations */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col gap-3 text-xs text-gray-600 dark:text-gray-400 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-2 uppercase tracking-wider">
              TÍNH TOÁN THANH TOÁN
            </h3>

            <div className="flex flex-col gap-2.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Tạm tính (Subtotal):</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{formatPrice(order.subtotal_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển:</span>
                <span className="text-green-600 font-semibold">Miễn phí</span>
              </div>
              {order.promo_code && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Mã giảm giá ({order.promo_code}):</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Tổng thanh toán:</span>
                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                  {formatPrice(order.total_amount)}
                </span>
              </div>
            </div>

            {/* Action buttons CTAs */}
            <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              {/* Cancel button if new */}
              {order.status === "new" && (
                <button
                  onClick={handleCancelOrder}
                  disabled={submittingAction}
                  className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/45 text-red-700 dark:text-red-400 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-red-200 dark:border-red-900/40"
                >
                  <XCircle className="w-4 h-4" /> Hủy bỏ đơn hàng
                </button>
              )}

              {/* Reorder button */}
              {(order.status === "cancelled" || order.status === "confirmed") && (
                <button
                  onClick={handleReorder}
                  disabled={submittingAction}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-4 h-4" /> Mua lại đơn hàng này
                </button>
              )}
            </div>
          </div>

          {/* Quick VietQR scanner display block if needed */}
          {showVietQr && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-xs rounded-xl flex flex-col items-center text-center gap-3 transition-colors duration-200">
              <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-2 w-full uppercase tracking-wider">
                MÃ QUÉT CHUYỂN KHOẢN
              </h3>
              <div className="relative aspect-square w-full max-w-[160px] border border-gray-150 dark:border-gray-800 p-1.5 rounded-lg bg-white">
                <img src={vietQrUrl} alt="VietQR Vietcombank" className="w-full h-full object-contain" />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-normal max-w-[200px]">
                <p className="m-0 font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">Mã chuyển khoản nhanh VietQR</p>
                <p className="m-0">Vui lòng quét bằng điện thoại ngân hàng để thanh toán hỏa tốc đơn hàng <strong className="text-gray-800 dark:text-gray-200">{order.code}</strong> số tiền <strong className="text-gray-800 dark:text-gray-200">{formatPrice(order.total_amount)}</strong>.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
export {};
