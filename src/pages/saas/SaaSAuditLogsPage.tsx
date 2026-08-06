import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  User,
  Clock,
  Activity,
  Key,
  Globe,
  Database,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AuditLog {
  id: number;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address: string;
  created_at: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

const MOCK_LOGS: AuditLog[] = [
  {
    id: 1,
    user_name: 'Quản Trị Viên (admin)',
    action: 'CREATE_PROMOTION',
    entity_type: 'web_promotions',
    entity_id: 'PRM-2026-001',
    ip_address: '14.226.12.98',
    created_at: '2026-08-03 07:45:12',
    status: 'SUCCESS',
  },
  {
    id: 2,
    user_name: 'Trần Kế Toán (accountant1)',
    action: 'POST_VAT_DECLARATION',
    entity_type: 'vat_declarations',
    entity_id: 'VAT-Q2-2026',
    ip_address: '113.161.42.10',
    created_at: '2026-08-03 06:30:00',
    status: 'SUCCESS',
  },
  {
    id: 3,
    user_name: 'Lê Thủ Kho (warehouse1)',
    action: 'APPROVE_STOCK_IN',
    entity_type: 'stock_transfers',
    entity_id: 'STK-IN-009',
    ip_address: '27.72.100.15',
    created_at: '2026-08-02 16:20:44',
    status: 'SUCCESS',
  },
  {
    id: 4,
    user_name: 'Unidentified IP',
    action: 'FAILED_LOGIN_ATTEMPT',
    entity_type: 'sys_users',
    entity_id: 'admin',
    ip_address: '103.142.11.5',
    created_at: '2026-08-02 03:12:09',
    status: 'FAILED',
  },
];

export const SaaSAuditLogsPage: React.FC = () => {
  const { language, t } = useLanguage();

  const [logs] = useState<AuditLog[]>(MOCK_LOGS);
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.user_name.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      l.ip_address.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
               {t('audit_recorded_events')}
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{logs.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
               {t('audit_active_status')}
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
               {t('audit_protected')}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
               {t('audit_retention')}
            </p>
             <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">365 {t('audit_days')}</p>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
             placeholder={t('audit_search_placeholder')}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase text-xs">
              <tr>
                 <th className="px-4 py-3 font-semibold">{t('audit_user')}</th>
                 <th className="px-4 py-3 font-semibold">{t('audit_action')}</th>
                 <th className="px-4 py-3 font-semibold">{t('audit_target')}</th>
                 <th className="px-4 py-3 font-semibold">{t('audit_ip')}</th>
                 <th className="px-4 py-3 font-semibold">{t('audit_status')}</th>
                 <th className="px-4 py-3 font-semibold">{t('audit_timestamp')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredLogs.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <User className="h-4 w-4 text-zinc-400" />
                    <span>{item.user_name}</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {item.action}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs">
                    <span className="font-semibold">{item.entity_type}</span> ({item.entity_id})
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs font-mono">
                    {item.ip_address}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        item.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">{item.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SaaSAuditLogsPage;
