import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Search,
  Save,
  RefreshCw,
  FileJson,
  Edit3,
  Languages,
  Layers,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  ArrowLeftRight,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import client from '../api/client';

interface TranslationEntry {
  key: string;
  vi: string;
  en: string;
  group: string;
}

export const SaaSTranslationsJsonTab: React.FC = () => {
  const { language, t } = useLanguage();
  const { addToast } = useToast();
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ vi: '', en: '' });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVi, setNewVi] = useState('');
  const [newEn, setNewEn] = useState('');
  const [newCategory, setNewCategory] = useState('common');

  const loadTranslations = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/saas/translations/json');
      if (res.data?.ok) {
        const viData = res.data.data.vi || {};
        const enData = res.data.data.en || {};
        const groups = res.data.data.groups || {};
        
        const entries: TranslationEntry[] = [];
        const groupMap: Record<string, string> = {};
        
        // Build reverse mapping from key to group
        for (const [groupName, keys] of Object.entries(groups)) {
          for (const key of keys as string[]) {
            groupMap[key] = groupName;
          }
        }
        
        // Get all unique keys from both vi and en
        const allKeys = new Set([...Object.keys(viData), ...Object.keys(enData)]);
        
        for (const key of allKeys) {
          if (key.startsWith('_')) continue; // Skip metadata keys
          entries.push({
            key,
            vi: viData[key] || '',
            en: enData[key] || '',
            group: groupMap[key] || (language === 'en' ? 'Other' : 'Khác'),
          });
        }
        
        // Sort by group then by key
        entries.sort((a, b) => {
          if (a.group !== b.group) return a.group.localeCompare(b.group);
          return a.key.localeCompare(b.key);
        });
        
        setTranslations(entries);
        
        // Auto-expand first group
        const uniqueGroups = [...new Set(entries.map(e => e.group))];
        if (uniqueGroups.length > 0) {
          setExpandedGroups({ [uniqueGroups[0]]: true });
        }
      }
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to load translations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTranslations();
  }, []);

  const groups = useMemo(() => {
    const groupMap = new Map<string, TranslationEntry[]>();
    for (const entry of translations) {
      if (!groupMap.has(entry.group)) groupMap.set(entry.group, []);
      groupMap.get(entry.group)!.push(entry);
    }
    return groupMap;
  }, [translations]);

  const filteredGroups = useMemo(() => {
    if (selectedGroup === 'all') return groups;
    const filtered = new Map<string, TranslationEntry[]>();
    if (groups.has(selectedGroup)) {
      filtered.set(selectedGroup, groups.get(selectedGroup)!);
    }
    return filtered;
  }, [groups, selectedGroup]);

  const searchFilteredEntries = useMemo(() => {
    if (!searchTerm) return filteredGroups;
    const filtered = new Map<string, TranslationEntry[]>();
    const lowerSearch = searchTerm.toLowerCase();
    for (const [group, entries] of filteredGroups) {
      const matched = entries.filter(e => 
        e.key.toLowerCase().includes(lowerSearch) ||
        e.vi.toLowerCase().includes(lowerSearch) ||
        e.en.toLowerCase().includes(lowerSearch)
      );
      if (matched.length > 0) filtered.set(group, matched);
    }
    return filtered;
  }, [filteredGroups, searchTerm]);

  const handleStartEdit = (entry: TranslationEntry) => {
    setEditingKey(entry.key);
    setEditValue({ vi: entry.vi, en: entry.en });
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue({ vi: '', en: '' });
  };

  const handleSaveEdit = async (entry: TranslationEntry) => {
    setSaving(entry.key);
    try {
      await client.put('/api/saas/translations/json', {
        key: entry.key,
        lang: 'vi',
        value: editValue.vi,
      });
      await client.put('/api/saas/translations/json', {
        key: entry.key,
        lang: 'en',
        value: editValue.en,
      });
      
      setTranslations(prev => prev.map(t => 
        t.key === entry.key ? { ...t, vi: editValue.vi, en: editValue.en } : t
      ));
      addToast(language === 'en' ? 'Translation saved!' : 'Đã lưu bản dịch!', 'success');
      handleCancelEdit();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAllToJSON = async () => {
    const translationsMap: Record<string, any> = {};
    translations.forEach((entry) => {
      translationsMap[entry.key] = { vi: entry.vi, en: entry.en };
    });

    setSaving('__all__');
    try {
      const res = await client.post('/api/saas/translations/json/bulk', {
        translations: translationsMap,
      });
      if (res.data?.ok) {
        addToast(language === 'en' ? `Saved ${translations.length} keys to JSON files!` : `Đã lưu ${translations.length} từ khóa vào file JSON!`, 'success');
        loadTranslations();
      } else {
        addToast(res.data?.error || 'Failed to save all translations', 'error');
      }
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to save all translations', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleAddNewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedKey = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!formattedKey) {
      addToast(language === 'en' ? 'Please enter a valid key code' : 'Vui lòng nhập mã từ khóa', 'error');
      return;
    }

    setSaving(formattedKey);
    try {
      await client.post('/api/saas/translations/json/bulk', {
        translations: {
          [formattedKey]: {
            vi: newVi || newEn,
            en: newEn || newVi,
          },
        },
      });

      setTranslations(prev => [
        ...prev.filter(t => t.key !== formattedKey),
        { key: formattedKey, vi: newVi || newEn, en: newEn || newVi, group: newCategory },
      ].sort((a, b) => {
        if (a.group !== b.group) return a.group.localeCompare(b.group);
        return a.key.localeCompare(b.key);
      }));

      setExpandedGroups(prev => ({ ...prev, [newCategory]: true }));
      addToast(language === 'en' ? `Added key '${formattedKey}' to JSON files!` : `Đã thêm từ khóa '${formattedKey}' vào file JSON!`, 'success');
      setIsAddModalOpen(false);
      setNewKey('');
      setNewVi('');
      setNewEn('');
      setNewCategory('common');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to add new key', 'error');
    } finally {
      setSaving(null);
    }
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast(language === 'en' ? 'Copied!' : 'Đã sao chép!', 'success');
  };

  const totalKeys = translations.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileJson className="w-4 h-4 text-emerald-500" />
            {language === 'en' ? 'JSON Translation Editor' : 'Trình Dịch Thuật JSON'}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {language === 'en' 
              ? `${totalKeys} keys loaded from vi.json & en.json` 
              : `Đã tải ${totalKeys} từ khóa từ vi.json & en.json`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {language === 'en' ? 'Add Key' : 'Thêm Từ Khóa'}
          </button>
          <button
            onClick={handleSaveAllToJSON}
            disabled={saving === '__all__' || translations.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving === '__all__' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {language === 'en' ? 'Save All to JSON' : 'Lưu Tất Cả ra JSON'}
          </button>
          <button
            onClick={loadTranslations}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {language === 'en' ? 'Refresh' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'en' ? 'Search keys or translations...' : 'Tìm kiếm từ khóa hoặc nội dung...'}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">{language === 'en' ? 'All Groups' : 'Tất cả nhóm'}</option>
          {[...groups.keys()].sort().map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
      </div>

      {/* Translations List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : searchFilteredEntries.size === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-xs">
          {language === 'en' ? 'No translations found.' : 'Không tìm thấy bản dịch nào.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...searchFilteredEntries.entries()].map(([groupName, entries]) => (
            <div key={groupName} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {expandedGroups[groupName] ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <Layers className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{groupName}</span>
                <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                  {entries.length}
                </span>
              </button>

              {/* Group Entries */}
              {expandedGroups[groupName] && (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {entries.map((entry) => (
                    <div key={entry.key} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-850/50 transition-colors">
                      {editingKey === entry.key ? (
                        /* Edit Mode */
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {entry.key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(entry.key)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              title={language === 'en' ? 'Copy key' : 'Sao chép từ khóa'}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-1 block">
                                {language === 'en' ? 'Vietnamese' : 'Tiếng Việt'}
                              </label>
                              <textarea
                                value={editValue.vi}
                                onChange={(e) => setEditValue(prev => ({ ...prev, vi: e.target.value }))}
                                rows={2}
                                className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-1 block">
                                {language === 'en' ? 'English' : 'Tiếng Anh'}
                              </label>
                              <textarea
                                value={editValue.en}
                                onChange={(e) => setEditValue(prev => ({ ...prev, en: e.target.value }))}
                                rows={2}
                                className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(entry)}
                              disabled={saving === entry.key}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {saving === entry.key ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              {language === 'en' ? 'Save' : 'Lưu'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving === entry.key}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {language === 'en' ? 'Cancel' : 'Hủy'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {entry.key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(entry.key)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              title={language === 'en' ? 'Copy key' : 'Sao chép từ khóa'}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <div className="flex-1" />
                            <button
                              onClick={() => handleStartEdit(entry)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              {language === 'en' ? 'Edit' : 'Sửa'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="bg-red-50/50 dark:bg-red-950/10 rounded-lg px-2.5 py-1.5 border border-red-100 dark:border-red-900/30">
                              <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold block mb-0.5">
                                {language === 'en' ? 'VI' : 'Tiếng Việt'}
                              </span>
                              <span className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">
                                {entry.vi || <span className="text-gray-400 italic">{language === 'en' ? '(empty)' : '(trống)'}</span>}
                              </span>
                            </div>
                            <div className="bg-blue-50/50 dark:bg-blue-950/10 rounded-lg px-2.5 py-1.5 border border-blue-100 dark:border-blue-900/30">
                              <span className="text-[10px] text-blue-500 dark:text-blue-400 font-semibold block mb-0.5">
                                {language === 'en' ? 'EN' : 'Tiếng Anh'}
                              </span>
                              <span className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">
                                {entry.en || <span className="text-gray-400 italic">{language === 'en' ? '(empty)' : '(trống)'}</span>}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Key Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <Plus className="w-5 h-5" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {language === 'en' ? 'Add New Key to JSON Files' : 'Thêm Từ Khóa Mới Vào File JSON'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewKey} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === 'en' ? 'Key Code (auto-formatted to snake_case)' : 'Mã từ khóa (tự động chuyển thành snake_case)'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'en' ? 'e.g.: report_monthly_vat' : 'ví dụ: bao_cao_vat_hang_thang'}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  {language === 'en' ? 'Key will be lowercased and spaces converted to underscores.' : 'Tự động chuyển chữ thường, khoảng trắng thành dấu gạch dưới.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === 'en' ? 'Group / Category' : 'Nhóm phân loại'}
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value.trim() || 'common')}
                  placeholder={language === 'en' ? 'e.g.: common, menu, products' : 'ví dụ: common, menu, products'}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === 'en' ? 'Vietnamese Value' : 'Giá trị Tiếng Việt'} *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder={language === 'en' ? 'Enter Vietnamese translation...' : 'Nhập nội dung tiếng Việt...'}
                  value={newVi}
                  onChange={(e) => setNewVi(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === 'en' ? 'English Value' : 'Giá trị Tiếng Anh'}
                </label>
                <textarea
                  rows={2}
                  placeholder={language === 'en' ? 'Enter English translation (optional - will copy from VI if empty)' : 'Nhập nội dung tiếng Anh (tự động sao chép từ VI nếu để trống)'}
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {language === 'en'
                    ? 'This will write directly to public/locales/vi.json and en.json on disk.'
                    : 'Thao tác này sẽ ghi trực tiếp vào public/locales/vi.json và en.json trên đĩa.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  {language === 'en' ? 'Cancel' : 'Hủy bỏ'}
                </button>
                <button
                  type="submit"
                  disabled={saving === newKey.trim().toLowerCase().replace(/\s+/g, '_')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {saving === newKey.trim().toLowerCase().replace(/\s+/g, '_') ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" />
                  ) : (
                    language === 'en' ? 'Add to JSON' : 'Thêm vào JSON'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
