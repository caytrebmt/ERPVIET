import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, ShoppingBag, ArrowRight, Loader2, Minus, Plus } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { formatPrice } from "../utils/format";

const CartPage: React.FC = () => {
  const { cart, loading, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);

  const handleQtyChange = async (itemId: number, currentQty: number, change: number) => {
    const newQty = currentQty + change;
    if (newQty <= 0) {
      // Remove item if quantity goes to 0 or negative
      setUpdatingItemId(itemId);
      await removeFromCart(itemId);
      setUpdatingItemId(null);
      return;
    }

    setUpdatingItemId(itemId);
    await updateQuantity(itemId, newQty);
    setUpdatingItemId(null);
  };

  const handleRemove = async (itemId: number) => {
    setUpdatingItemId(itemId);
    await removeFromCart(itemId);
    setUpdatingItemId(null);
  };

  if (loading && !cart) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-gray-500 dark:text-gray-400">Đang tải giỏ hàng của bạn...</p>
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  if (isEmpty) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-xs">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Giỏ hàng của bạn đang trống</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
          Có vẻ như bạn chưa thêm sản phẩm nào vào giỏ hàng. Hãy quay lại trang sản phẩm để chọn những sản phẩm ưng ý nhé!
        </p>
        <Link
          to="/"
          className="mt-6 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-sm px-6 py-2.5 rounded-full transition-colors inline-block cursor-pointer shadow-xs"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-gray-150 dark:border-gray-800 pb-3">
        <h1 className="text-xl md:text-2xl font-bold text-gray-850 dark:text-white flex items-center gap-2">
          GIỎ HÀNG CỦA BẠN
          <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-850 dark:text-indigo-300 px-2.5 py-0.5 rounded-full">
            {cart.item_count} sản phẩm
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items Table List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs transition-colors duration-200">
            {/* Header row desktop only */}
            <div className="hidden md:grid grid-cols-12 gap-2 bg-gray-50/70 dark:bg-gray-850/30 p-4 text-xs font-bold text-gray-500 border-b border-gray-100 dark:border-gray-800 uppercase tracking-wider">
              <div className="col-span-6">Sản phẩm</div>
              <div className="col-span-2 text-center">Đơn giá</div>
              <div className="col-span-2 text-center">Số lượng</div>
              <div className="col-span-2 text-right">Tổng tiền</div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {cart.items.map((item) => (
                <div key={item.id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative">
                  {updatingItemId === item.id && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  )}

                  {/* Info: Image + Title */}
                  <div className="col-span-1 md:col-span-6 flex gap-3">
                    <div className="w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-gray-950 shrink-0">
                       <img
                         src={item.imageUrl}
                         alt={item.name}
                         referrerPolicy="no-referrer"
                         onError={(e) => {
                           const target = e.target as HTMLImageElement;
                           if (target.src !== '/placeholder.svg') {
                             target.src = '/placeholder.svg';
                           }
                         }}
                         className="w-full h-full object-cover"
                       />
                    </div>
                    <div className="flex flex-col min-w-0 justify-center">
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate">
                        <Link to={`/product/${item.slug || item.sku}`}>{item.name}</Link>
                      </h4>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5 uppercase">SKU: {item.sku}</p>
                      {/* mobile only remove */}
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-[10px] font-semibold text-red-600 hover:underline flex items-center gap-1 mt-1 md:hidden text-left"
                      >
                        <Trash2 className="w-3 h-3" /> Xóa
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-1 md:col-span-2 md:text-center flex justify-between md:block text-xs">
                    <span className="text-gray-400 font-medium md:hidden">Đơn giá:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{formatPrice(item.unit_price || 0)}</span>
                  </div>

                  {/* Quantity Counter */}
                  <div className="col-span-1 md:col-span-2 flex justify-between md:justify-center items-center gap-2 text-xs">
                    <span className="text-gray-400 font-medium md:hidden">Số lượng:</span>
                    <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950">
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                        className="px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-gray-800 dark:text-gray-100 text-xs">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                        className="px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Total amount */}
                  <div className="col-span-1 md:col-span-2 flex justify-between md:block text-right text-xs">
                    <span className="text-gray-400 font-medium md:hidden">Thành tiền:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formatPrice(item.amount || 0)}</span>
                  </div>

                  {/* Desktop remove button */}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    title="Xóa sản phẩm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Clear buttons */}
          <div className="flex justify-between items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-xs transition-colors duration-200">
            <Link to="/" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              ← Tiếp tục mua sắm
            </Link>
            <button
              onClick={clearCart}
              className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
            >
              Xóa toàn bộ giỏ hàng
            </button>
          </div>
        </div>

        {/* Order Summary Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs sticky top-20 flex flex-col gap-4 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-3 uppercase tracking-wider">
              TỔNG CỘNG ĐƠN HÀNG
            </h3>

            <div className="flex flex-col gap-2.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Số lượng mặt hàng:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{cart.item_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Tạm tính (Subtotal):</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển:</span>
                <span className="text-green-600 font-semibold">Miễn phí</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Tổng thanh toán:</span>
                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {formatPrice(cart.total)}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate("/checkout")}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-all shadow-xs mt-2 cursor-pointer"
            >
              Tiến hành thanh toán
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
export {};
