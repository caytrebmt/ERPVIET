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

const STATUS_SUCCESS_KEYWORDS = ['đã thanh toán', 'hoàn thành', 'trong hạn', 'chấp nhận', 'đã xuất hóa đơn', 'đã điều chỉnh'] as const;
const STATUS_DANGER_KEYWORDS = ['trễ nợ', 'nợ xấu', 'còn nợ', 'đã hủy', 'thiếu'] as const;
const STATUS_WARNING_KEYWORDS = ['thanh toán một phần', 'nháp', 'đang kiểm kê', 'thừa'] as const;
const STATUS_INFO_KEYWORDS = ['đã gửi', 'đang xử lý'] as const;
const hasBadgeKeyword = (status: string, keywords: readonly string[]) => keywords.some((keyword) => status.includes(keyword));

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, customText, size = 'sm' }) => {
  const normalized = (status || '').toString().toLowerCase().trim();

  let textColor = 'text-zinc-600 dark:text-zinc-400';
  let dotClass = 'bg-zinc-400';

  // Green / Emerald: Paid, Completed, Active, Completed, Khớp, Đã thanh toán, Trong hạn
  if (
    normalized.includes('paid') ||
    hasBadgeKeyword(normalized, STATUS_SUCCESS_KEYWORDS) ||
    normalized.includes('completed') ||
    normalized.includes('active')
  ) {
    textColor = 'text-emerald-600 dark:text-emerald-400';
    dotClass = 'bg-emerald-500';
  }
  // Red / Rose: Overdue, Cancelled, Trễ nợ, Nợ xấu, Còn nợ, Đã hủy
  else if (
    normalized.includes('overdue') ||
    hasBadgeKeyword(normalized, STATUS_DANGER_KEYWORDS) ||
    normalized.includes('cancelled')
  ) {
    textColor = 'text-rose-600 dark:text-rose-400';
    dotClass = 'bg-rose-500';
  }
  // Amber / Yellow: Partially paid, Draft, Nháp, Chờ, Đang kiểm kê
  else if (
    normalized.includes('partially') ||
    hasBadgeKeyword(normalized, STATUS_WARNING_KEYWORDS) ||
    normalized.includes('draft')
  ) {
    textColor = 'text-amber-600 dark:text-amber-400';
    dotClass = 'bg-amber-500';
  }
  // Blue / Indigo: Pending, Processing, Đã gửi
  else if (
    normalized.includes('pending') ||
    normalized.includes('processing') ||
    hasBadgeKeyword(normalized, STATUS_INFO_KEYWORDS)
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
