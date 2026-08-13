import React, { useState } from 'react';
import { Calendar, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // Thêm import hook dịch thuật

export type DateFilterPreset = 'all' | 'today' | '7days' | 'thisMonth' | 'thisQuarter' | 'custom';

export interface DateFilterValue {
  preset: DateFilterPreset;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
}

interface SaaSDateFilterBarProps {
  onFilterChange: (filter: DateFilterValue) => void;
  className?: string;
}

export const SaaSDateFilterBar: React.FC<SaaSDateFilterBarProps> = ({ onFilterChange, className = '' }) => {
  const { t } = useTranslation(); // Khởi tạo hàm dịch t()
  const [preset, setPreset] = useState<DateFilterPreset>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const handlePresetChange = (newPreset: DateFilterPreset) => {
    setPreset(newPreset);
    let fDate = '';
    let tDate = '';

    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    if (newPreset === 'today') {
      fDate = formatDateStr(today);
      tDate = formatDateStr(today);
    } else if (newPreset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      fDate = formatDateStr(past);
      tDate = formatDateStr(today);
    } else if (newPreset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      fDate = formatDateStr(firstDay);
      tDate = formatDateStr(today);
    } else if (newPreset === 'thisQuarter') {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const firstDayQuarter = new Date(today.getFullYear(), currentQuarter * 3, 1);
      fDate = formatDateStr(firstDayQuarter);
      tDate = formatDateStr(today);
    }

    if (newPreset !== 'custom') {
      setFromDate(fDate);
      setToDate(tDate);
    }

    onFilterChange({
      preset: newPreset,
      fromDate: newPreset === 'custom' ? fromDate : fDate,
      toDate: newPreset === 'custom' ? toDate : tDate,
    });
  };

  const handleCustomDateChange = (f: string, t: string) => {
    setFromDate(f);
    setToDate(t);
    onFilterChange({
      preset: 'custom',
      fromDate: f,
      toDate: t,
    });
  };

  const handleReset = () => {
    setPreset('all');
    setFromDate('');
    setToDate('');
    onFilterChange({ preset: 'all', fromDate: '', toDate: '' });
  };

  return (
    <div className={`bg-zinc-50 dark:bg-zinc-900/70 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mr-1">
          <Calendar className="h-4 w-4 text-amber-500" />
          {t('date_filter.label')}
        </span>

        <button
          onClick={() => handlePresetChange('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            preset === 'all'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {t('date_filter.presets.all')}
        </button>

        <button
          onClick={() => handlePresetChange('today')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            preset === 'today'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {t('date_filter.presets.today')}
        </button>

        <button
          onClick={() => handlePresetChange('7days')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            preset === '7days'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {t('date_filter.presets.seven_days')}
        </button>

        <button
          onClick={() => handlePresetChange('thisMonth')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            preset === 'thisMonth'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {t('date_filter.presets.this_month')}
        </button>

        <button
          onClick={() => handlePresetChange('thisQuarter')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            preset === 'thisQuarter'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {t('date_filter.presets.this_quarter')}
        </button>

        <button
          onClick={() => handlePresetChange('custom')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            preset === 'custom'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {t('date_filter.presets.custom')}
        </button>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 font-medium">{t('date_filter.custom_range.from')}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => handleCustomDateChange(e.target.value, toDate)}
              className="px-2 py-1 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 font-medium">{t('date_filter.custom_range.to')}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => handleCustomDateChange(fromDate, e.target.value)}
              className="px-2 py-1 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      )}

      {preset !== 'all' && (
        <button
          onClick={handleReset}
          className="p-1.5 text-zinc-500 hover:text-amber-500 transition-colors flex items-center gap-1 font-semibold"
          title={t('date_filter.actions.reset_tooltip')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('date_filter.actions.reset')}
        </button>
      )}
    </div>
  );
};

export function filterByDateRange<T extends { date?: string; createdAt?: string }>(
  items: T[],
  filter: DateFilterValue
): T[] {
  if (filter.preset === 'all') return items;
  if (!filter.fromDate && !filter.toDate) return items;

  return items.filter((item) => {
    const rawDate = item.date || item.createdAt || '';
    if (!rawDate) return true;
    const itemDate = rawDate.split('T')[0].split(' ')[0]; // YYYY-MM-DD
    if (filter.fromDate && itemDate < filter.fromDate) return false;
    if (filter.toDate && itemDate > filter.toDate) return false;
    return true;
  });
}
