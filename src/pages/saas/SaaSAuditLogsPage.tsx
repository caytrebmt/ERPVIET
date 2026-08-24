import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, User, Clock, Activity, Database, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import client from '../../api/client';

interface AuditLog {
  id: number;
  user_name: string;
  username?: string;
  action: string;
  entity_name: string;
  entity_id: string;
  ip_address: string;
  created_at: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

export const SaaSAuditLogsPage: React.FC = () => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client.get('/api/saas/audit-logs')
      .then((response) => {
        if (cancelled) return;
        if (!response.data?.ok) throw new Error(response.data?.message || 'Không tải được nhật ký.');
        setLogs((response.data.data || []).map((row: any) => ({
          id: Number(row.id),
          user_name: row.user_name || row.username || 'Hệ thống',
          username: row.username,
          action: row.action || '',
          entity_name: row.entity_name || '',
          entity_id: row.entity_id || '',
          ip_address: row.ip_address || '',
          created_at: row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : '',
          status: 'SUCCESS',
        })));
      })
      .catch((requestError: any) => {
        if (!cancelled) setError(requestError?.response?.data?.message || requestError.message || 'Không tải được nhật ký từ cơ sở dữ liệu.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const term = search.toLowerCase();
  const filteredLogs = logs.filter((log) => [log.user_name, log.action, log.entity_name, log.entity_id, log.ip_address].some((value) => value.toLowerCase().includes(term)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4"><Activity className="h-6 w-6 text-amber-500" /><div><p className="text-xs text-zinc-500">{t('audit_recorded_events')}</p><p className="text-2xl font-bold">{loading ? '—' : logs.length}</p></div></div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4"><ShieldAlert className="h-6 w-6 text-emerald-500" /><div><p className="text-xs text-zinc-500">{t('audit_active_status')}</p><p className="text-2xl font-bold text-emerald-600">{t('audit_protected')}</p></div></div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4"><Database className="h-6 w-6 text-blue-500" /><div><p className="text-xs text-zinc-500">{t('audit_retention')}</p><p className="text-2xl font-bold">365 {t('audit_days')}</p></div></div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"><div className="relative w-full sm:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('audit_search_placeholder')} className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm" /></div></div>
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
      {loading && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải nhật ký thật từ PostgreSQL...</div>}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase text-xs"><tr><th className="px-4 py-3">{t('audit_user')}</th><th className="px-4 py-3">{t('audit_action')}</th><th className="px-4 py-3">{t('audit_target')}</th><th className="px-4 py-3">{t('audit_ip')}</th><th className="px-4 py-3">{t('audit_status')}</th><th className="px-4 py-3">{t('audit_timestamp')}</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {filteredLogs.map((item) => <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"><td className="px-4 py-3.5 font-medium"><span className="inline-flex items-center gap-2"><User className="h-4 w-4 text-zinc-400" />{item.user_name}</span></td><td className="px-4 py-3.5 font-mono text-xs font-semibold text-amber-600">{t(`audit_action_${item.action}`, item.action)}</td><td className="px-4 py-3.5 text-xs"><span className="font-semibold">{t(`audit_entity_${item.entity_name}`, item.entity_name)}</span>{item.entity_id ? ` (${item.entity_id})` : ''}</td><td className="px-4 py-3.5 text-xs font-mono text-zinc-500">{item.ip_address || '—'}</td><td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{item.status}</span></td><td className="px-4 py-3.5 text-xs text-zinc-500"><Clock className="inline h-3.5 w-3.5 mr-1" />{item.created_at}</td></tr>)}
        </tbody></table></div>
        {!loading && filteredLogs.length === 0 && <p className="px-4 py-10 text-center text-xs text-zinc-500">Chưa có nhật ký phù hợp.</p>}
      </div>
    </div>
  );
};

export default SaaSAuditLogsPage;
