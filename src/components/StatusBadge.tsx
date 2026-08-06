import React from 'react';

export type StatusType =
  | 'Draft'
  | 'Paid'
  | 'Overdue'
  | 'Partially paid'
  | 'Pending'
  | 'Completed'
  | 'Active'
  | 'Inactive'
  | 'Cancelled'
  | 'Đã thanh toán'
  | 'Còn nợ'
  | 'Thanh toán một phần'
  | 'Đã hoàn thành'
  | 'Đang kiểm kê'
  | 'Đã điều chỉnh kho'
  | 'Trong hạn'
  | 'Trễ nợ <30 ngày'
  | 'Nợ xấu >60 ngày'
  | 'Đã gửi'
  | 'Chấp nhận'
  | 'Đã xuất hóa đơn'
  | 'Nháp'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  customText?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, customText, size = 'sm' }) => {
  const normalized = (status || '').toString().toLowerCase().trim();

  let textColor = 'text-zinc-600 dark:text-zinc-400';
  let dotClass = 'bg-zinc-400';

  // Green / Emerald: Paid, Completed, Active, Completed, Khớp, Đã thanh toán, Trong hạn
  if (
    normalized.includes('paid') ||
    normalized.includes('đã thanh toán') ||
    normalized.includes('hoàn thành') ||
    normalized.includes('completed') ||
    normalized.includes('active') ||
    normalized.includes('trong hạn') ||
    normalized.includes('chấp nhận') ||
    normalized.includes('đã xuất hóa đơn') ||
    normalized.includes('đã điều chỉnh')
  ) {
    textColor = 'text-emerald-600 dark:text-emerald-400';
    dotClass = 'bg-emerald-500';
  }
  // Red / Rose: Overdue, Cancelled, Trễ nợ, Nợ xấu, Còn nợ, Đã hủy
  else if (
    normalized.includes('overdue') ||
    normalized.includes('trễ nợ') ||
    normalized.includes('nợ xấu') ||
    normalized.includes('còn nợ') ||
    normalized.includes('cancelled') ||
    normalized.includes('đã hủy') ||
    normalized.includes('thiếu')
  ) {
    textColor = 'text-rose-600 dark:text-rose-400';
    dotClass = 'bg-rose-500';
  }
  // Amber / Yellow: Partially paid, Draft, Nháp, Chờ, Đang kiểm kê
  else if (
    normalized.includes('partially') ||
    normalized.includes('thanh toán một phần') ||
    normalized.includes('draft') ||
    normalized.includes('nháp') ||
    normalized.includes('đang kiểm kê') ||
    normalized.includes('thừa')
  ) {
    textColor = 'text-amber-600 dark:text-amber-400';
    dotClass = 'bg-amber-500';
  }
  // Blue / Indigo: Pending, Processing, Đã gửi
  else if (
    normalized.includes('pending') ||
    normalized.includes('processing') ||
    normalized.includes('đã gửi') ||
    normalized.includes('đang xử lý')
  ) {
    textColor = 'text-blue-600 dark:text-blue-400';
    dotClass = 'bg-blue-500';
  }

  const textSize = size === 'md' ? 'text-xs' : 'text-[12px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold whitespace-nowrap p-0 bg-transparent ${textSize} ${textColor}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
      {customText || status}
    </span>
  );
};
