import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, CreditCard, Landmark, Check, Tag } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { formatPrice } from "../utils/format";
import client from "../api/client";
import { useTranslation } from "react-i18next";

const CheckoutPage: React.FC = () => {
  const { t } = useTranslation();
  const { cart, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD"); // COD, VIETQR, BANK

  // Promotion states
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number; desc: string } | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill form on mount if user is authenticated
  useEffect(() => {
    if (user) {
      setCustomerName(user.name || "");
      setCustomerPhone(user.phone || "");
      setCustomerEmail(user.email || "");
    }
  }, [user]);

  // Protect empty cart
  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-4">
        <h3 className="font-bold text-gray-700 dark:text-gray-350">Giỏ hàng rỗng</h3>
        <p className="text-xs text-gray-400 mt-1">Không có sản phẩm nào để thanh toán.</p>
        <Link to="/" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-4">
          Quay lại mua sắm
        </Link>
      </div>
    );
  }

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;

    try {
      setValidatingPromo(true);
      const res = await client.post("/api/shop/promotions/validate", {
        code: promoCodeInput.trim(),
        amount: cart.subtotal,
      });

      if (res.data && res.data.ok) {
        setAppliedPromo({
          code: promoCodeInput.trim().toUpperCase(),
          discount: res.data.data.discount_amount,
          desc: res.data.data.description,
        });
        showToast(t("page_checkout_promo_applied"), "success");
      } else {
        showToast(t("page_checkout_promo_invalid"), "error");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || t("page_checkout_promo_incorrect");
      showToast(msg, "error");
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput("");
  };

  const finalTotal = Math.max(0, cart.subtotal - (appliedPromo?.discount || 0));

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim() || !shippingAddress.trim()) {
      showToast(t("page_checkout_shipping_required"), "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await client.post("/api/shop/orders", {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        shippingAddress: shippingAddress.trim(),
        paymentMethod,
        note: note.trim(),
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        webCustomerId: user?.id,
        discount_amount: appliedPromo?.discount || 0,
        items: cart.items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        })),
      });

      if (res.data && res.data.ok) {
        const orderCode = (res.data.data.order || res.data.data).code;
        showToast(t("page_checkout_order_success"), "success");
        await clearCart();
        navigate(`/order-success/${orderCode}`);
      } else {
        showToast(res.data.message || t("page_checkout_order_failed"), "error");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || t("page_checkout_order_error");
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
        <Link to="/cart" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-450 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-gray-850 dark:text-white uppercase">THANH TOÁN ĐƠN HÀNG</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Customer profile address form */}
          <form onSubmit={handlePlaceOrder} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl shadow-xs flex flex-col gap-4 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-3 uppercase tracking-wider">
              1. THÔNG TIN GIAO HÀNG
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Họ tên người nhận <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ví dụ: 0909123456"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Địa chỉ Email</label>
              <input
                type="email"
                placeholder="Ví dụ: customer@example.com (không bắt buộc)"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Địa chỉ giao nhận hàng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Số nhà, tên đường, phường/xã, quận/huyện, thành phố..."
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Ghi chú giao hàng</label>
              <textarea
                placeholder="Ghi chú thêm về thời gian giao nhận, lời nhắn cho shipper..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              />
            </div>
          </form>

          {/* Payment Method Selector */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col gap-4 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-3 uppercase tracking-wider">
              2. PHƯƠNG THỨC THANH TOÁN
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* COD */}
              <button
                type="button"
                onClick={() => setPaymentMethod("COD")}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                  paymentMethod === "COD"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "border-gray-200 dark:border-gray-850 hover:border-gray-300 dark:hover:border-gray-750 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-950"
                }`}
              >
                <CreditCard className="w-6 h-6 text-indigo-600" />
                <span className="text-xs">COD (Thanh toán khi nhận)</span>
              </button>

              {/* VietQR */}
              <button
                type="button"
                onClick={() => setPaymentMethod("VIETQR")}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                  paymentMethod === "VIETQR"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "border-gray-200 dark:border-gray-850 hover:border-gray-300 dark:hover:border-gray-750 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-950"
                }`}
              >
                <div className="w-6 h-6 bg-indigo-600 text-white rounded-md flex items-center justify-center font-bold text-[10px]">QR</div>
                <span className="text-xs">Chuyển khoản VietQR hỏa tốc</span>
              </button>

              {/* Bank Transfer */}
              <button
                type="button"
                onClick={() => setPaymentMethod("BANK")}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                  paymentMethod === "BANK"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "border-gray-200 dark:border-gray-850 hover:border-gray-300 dark:hover:border-gray-750 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-950"
                }`}
              >
                <Landmark className="w-6 h-6 text-indigo-600" />
                <span className="text-xs">Chuyển khoản Ngân hàng</span>
              </button>
            </div>

            {/* Sub-note for payment method */}
            {paymentMethod === "COD" && (
              <p className="text-[11px] text-gray-400 bg-gray-50 dark:bg-gray-850 rounded-lg p-3">
                Quý khách sẽ thanh toán bằng tiền mặt trực tiếp cho nhân viên giao hàng sau khi kiểm tra nhận đủ sản phẩm.
              </p>
            )}

            {paymentMethod === "VIETQR" && (
              <div className="text-[11px] text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg p-3 leading-relaxed flex flex-col gap-1 border border-indigo-100 dark:border-indigo-900/40">
                <span className="font-bold">Chuyển khoản thông minh qua VietQR:</span>
                Mã QR chuyển khoản cá nhân hóa chứa chính xác số tiền cần trả và nội dung chuyển khoản sẽ được hiển thị ngay sau khi đặt hàng thành công để bạn quét thanh toán cực nhanh.
              </div>
            )}

            {paymentMethod === "BANK" && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-850 rounded-lg p-3 flex flex-col gap-1.5 border border-gray-150 dark:border-gray-800">
                <span className="font-bold text-gray-700 dark:text-gray-300">Thông tin tài khoản thụ hưởng:</span>
                <p className="m-0">Ngân hàng: <strong className="text-gray-800 dark:text-gray-200">Vietcombank (VCB)</strong></p>
                <p className="m-0">Số tài khoản: <strong className="text-gray-800 dark:text-gray-200">0071 000 123456</strong></p>
                <p className="m-0">Chủ tài khoản: <strong className="text-gray-800 dark:text-gray-200">CONG TY CONG NGHE ERP VIET</strong></p>
                <p className="m-0">Nội dung chuyển khoản: <strong className="text-indigo-600 dark:text-indigo-400">Mã đơn hàng của bạn (ví dụ: WEB-260716-0001)</strong></p>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary & Coupon verification side panel */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col gap-4 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-3 uppercase tracking-wider">
              TÓM TẮT ĐƠN HÀNG
            </h3>

            {/* Items list summary */}
            <div className="max-h-56 overflow-y-auto pr-1 flex flex-col gap-3 border-b border-gray-200 dark:border-gray-850 pb-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex gap-3 text-xs items-center">
                  <div className="w-10 h-10 rounded-sm border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-gray-950 shrink-0">
                    <img src={item.imageUrl} alt={item.name} onError={(e) => { const t = e.target as HTMLImageElement; if (t.src !== '/placeholder.svg') t.src = '/placeholder.svg'; }} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-gray-800 dark:text-gray-200 truncate">{item.name}</h5>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Số lượng: <strong className="text-gray-700 dark:text-gray-300">{item.quantity}</strong> × {formatPrice(item.unit_price || 0)}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white shrink-0">{formatPrice(item.amount || 0)}</span>
                </div>
              ))}
            </div>

            {/* Coupon Code Verification Form */}
            {!appliedPromo ? (
              <form onSubmit={handleApplyPromo} className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
                <input
                  type="text"
                  placeholder="Nhập mã ưu đãi (KM10, FREESHIP...)"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none flex-1 font-mono uppercase text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={validatingPromo || !promoCodeInput.trim()}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {validatingPromo ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : "Áp dụng"}
                </button>
              </form>
            ) : (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 p-3 rounded-lg flex items-center justify-between text-xs border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex gap-2 items-center">
                  <Tag className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <p className="font-bold text-green-800 dark:text-green-300 font-mono">{appliedPromo.code}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-450 leading-none mt-0.5">{appliedPromo.desc}</p>
                  </div>
                </div>
                <button
                  onClick={handleRemovePromo}
                  className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Gỡ bỏ
                </button>
              </div>
            )}

            {/* Total panel calculations */}
            <div className="flex flex-col gap-2.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Cộng tạm tính (Subtotal):</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Vận chuyển (Shipping):</span>
                <span className="text-green-600 font-semibold">Miễn phí</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Khuyến mãi ({appliedPromo.code}):</span>
                  <span>-{formatPrice(appliedPromo.discount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Tổng tiền phải trả:</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  {formatPrice(finalTotal)}
                </span>
              </div>
            </div>

            {/* Place Order submit button */}
            <button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-150 disabled:text-gray-400 font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-all shadow-xs mt-3 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang lập đơn hàng...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Xác nhận Đặt hàng (ERPACC)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
export {};
