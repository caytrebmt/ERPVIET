import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, Calendar, Coins, Loader2, FileText, ChevronRight } from "lucide-react";
import client from "../api/client";
import { Order } from "../types";
import { formatPrice, formatDate } from "../utils/format";

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true);
        const res = await client.get("/api/shop/orders");
        if (res.data && res.data.ok) {
          setOrders(res.data.data.items || []);
        }
      } catch (err) {
        console.error("Error loading customer orders history", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      client.get("/api/shop/orders").then((res) => {
        if (res.data && res.data.ok) {
          setOrders(res.data.data.items || []);
        }
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
        return "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-750 dark:text-gray-300";
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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-gray-500 dark:text-gray-400">Đang tải lịch sử đơn hàng của bạn...</p>
      </div>
    );
  }

  const isEmpty = orders.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-gray-150 dark:border-gray-800 pb-3 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-850 dark:text-white flex items-center gap-2 uppercase">
          LỊCH SỬ ĐƠN HÀNG
          {!isEmpty && (
            <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-850 dark:text-indigo-300 px-2.5 py-0.5 rounded-full">
              {orders.length} đơn hàng
            </span>
          )}
        </h1>
      </div>

      {isEmpty ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 py-16 px-4 text-center shadow-xs transition-colors duration-200">
          <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h4 className="font-semibold text-gray-750 dark:text-gray-200 text-base">Bạn chưa mua đơn hàng nào</h4>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
            Hãy lựa chọn sản phẩm từ hệ thống WebShop và tạo đơn hàng đầu tiên của bạn ngay!
          </p>
          <Link
            to="/"
            className="mt-6 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold px-6 py-2.5 rounded-full transition-all inline-block cursor-pointer shadow-xs"
          >
            Bắt đầu mua sắm ngay
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xs transition-all duration-200"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0 shadow-xs">
                  <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-950 dark:text-white">
                      {order.code}
                    </span>
                    <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full uppercase ${getStatusBadgeClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 mt-2.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 shrink-0" /> Ngày mua: <strong className="text-gray-700 dark:text-gray-200">{formatDate(order.createdAt)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 shrink-0" /> Thanh toán: <strong className="text-gray-700 dark:text-gray-200 uppercase">{order.paymentMethod}</strong>
                    </span>
                    <span className="md:col-span-2 truncate">
                      Sản phẩm: <span className="font-semibold text-gray-700 dark:text-gray-200">{order.items.map(item => `${item.name} (x${item.quantity})`).join(", ")}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-gray-50 dark:border-gray-800 pt-3 md:pt-0 gap-3">
                <div className="text-left md:text-right">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase leading-none m-0">Tổng thanh toán</p>
                  <p className="text-base font-extrabold text-indigo-600 dark:text-indigo-450 mt-1 mb-0">{formatPrice(order.total_amount)}</p>
                </div>
                
                <Link
                  to={`/orders/${order.code}`}
                  className="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-900 dark:text-indigo-300 hover:text-white dark:hover:text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  Chi tiết <ChevronRight className="w-4.5 h-4.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
export {};
