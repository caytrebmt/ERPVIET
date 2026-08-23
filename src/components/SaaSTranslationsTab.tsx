import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  Search,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  AlertCircle,
  Edit3,
  Languages,
  Filter,
  Layers,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { useLanguage, TranslationItem } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  filterTranslationsLocally,
  paginateItems,
  computeCategoryFacets,
  computeTranslationStats,
  normalizeImportedTranslations,
  TRANSLATIONS_DEFAULT_PAGE_SIZE,
  type TranslationStats,
  type CategoryFacet,
  type TranslationStatusFilter,
} from '../services/translationsService';

type DataMode = 'loading' | 'server' | 'local';

interface ServerPageState {
  sig: string;
  items: TranslationItem[];
  total: number;
  totalPages: number;
  categories: CategoryFacet[];
  stats: TranslationStats;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const IMPORT_CHUNK_SIZE = 25;

// Known category ids (DB `sys_translations.category`) with bilingual labels.
const KNOWN_CATEGORY_LABELS: Record<string, { vi: string; en: string }> = {
  common: { vi: 'Chung & Nút bấm', en: 'Common & Buttons' },
  menu: { vi: 'Menu & Điều hướng', en: 'Sidebar & Menus' },
  navigation: { vi: 'Menu & Điều hướng', en: 'Sidebar & Menus' },
  dashboard: { vi: 'Tổng quan & Thống kê', en: 'Dashboard & Metrics' },
  products: { vi: 'Sản phẩm & Hàng hóa', en: 'Products & Items' },
  categories: { vi: 'Danh mục WebShop', en: 'Store Categories' },
  footer: { vi: 'Chân trang WebShop', en: 'WebShop Footer' },
  inventory: { vi: 'Kho & Xuất nhập', en: 'Warehouse & Stock' },
  finance: { vi: 'Tài chính & Hóa đơn', en: 'Finance & Invoices' },
  accounting: { vi: 'Sổ Kế toán TT200', en: 'Accounting TT200' },
  saas: { vi: 'Cấu hình System SaaS', en: 'SaaS System Config' },
};

export const SaaSTranslationsTab: React.FC = () => {
  const {
    language,
    toggleLanguage,
    translationsList,
    updateTranslation,
    createTranslation,
    deleteTranslation,
    resetToDefaults,
    loadLocaleTranslations,
    publishToJSON,
  } = useLanguage();

  const { addToast } = useToast();

  // ── Filters & paging state ────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [committedSearch, setCommittedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<TranslationStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TRANSLATIONS_DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setCommittedSearch(debouncedSearch);
  }, [debouncedSearch]);

  // Any filter change sends the user back to page 1.
  useEffect(() => {
    setPage(1);
  }, [committedSearch, selectedCategory, statusFilter, pageSize]);

  // ── Data source: server (paginated API) with local i18n fallback ─────────
  const [mode, setMode] = useState<DataMode>('loading');
  const [serverPage, setServerPage] = useState<ServerPageState | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const requestSig = `${page}|${pageSize}|${committedSearch}|${selectedCategory}|${statusFilter}|${reloadToken}`;

  const fetchServerPage = useCallback(
    async (targetSig: string): Promise<ServerPageState> => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (committedSearch) params.set('search', committedSearch);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/saas/translations?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      const data = json.data || {};
      return {
        sig: targetSig,
        items: (data.items || []).map((row: any) => ({
          key: String(row.key),
          category: String(row.category || 'common'),
          vi: String(row.vi ?? ''),
          en: String(row.en ?? ''),
        })),
        total: Number(data.total) || 0,
        totalPages: Number(data.totalPages) || 1,
        categories: data.categories || [],
        stats: data.stats || { total: 0, viCompleted: 0, enCompleted: 0 },
      };
    },
    [page, pageSize, committedSearch, selectedCategory, statusFilter],
  );

  useEffect(() => {
    if (mode === 'local') return;
    if (serverPage?.sig === requestSig) return; // already showing this exact page

    let cancelled = false;
    setIsFetching(true);
    (async () => {
      try {
        const next = await fetchServerPage(requestSig);
        if (cancelled) return;
        setServerPage(next);
        setMode(next.total > 0 ? 'server' : 'local'); // empty DB → bundled dictionary
        setFetchError(null);
      } catch (e: any) {
        if (cancelled) return;
        if (mode === 'loading') setMode('local'); // offline / no DB → local mode
        else setFetchError(e?.message || 'Request failed');
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, requestSig, serverPage?.sig, fetchServerPage]);

  const refreshServerList = () => setReloadToken((n) => n + 1);
  const isServer = mode === 'server';

  // ── Local (fallback) view: filter + paginate the bundled dictionary ───────
  const localFiltered = useMemo(
    () =>
      filterTranslationsLocally(translationsList, {
        search: committedSearch,
        category: selectedCategory,
        status: statusFilter,
      }),
    [translationsList, committedSearch, selectedCategory, statusFilter],
  );
  const localPaged = useMemo(
    () => paginateItems(localFiltered, page, pageSize),
    [localFiltered, page, pageSize],
  );
  const localFacets = useMemo(() => computeCategoryFacets(translationsList), [translationsList]);
  const localStats = useMemo(() => computeTranslationStats(translationsList), [translationsList]);

  // Keep the page number inside the local-mode bounds after deletions/imports.
  useEffect(() => {
    if (mode === 'local' && page > localPaged.totalPages) setPage(localPaged.totalPages);
  }, [mode, page, localPaged.totalPages]);

  // Server mode: deleting the last row of a page must not strand on an empty page.
  useEffect(() => {
    if (isServer && serverPage && serverPage.items.length === 0 && serverPage.total > 0 && page > serverPage.totalPages) {
      setPage(serverPage.totalPages);
    }
  }, [isServer, serverPage, page]);

  // ── Unified view model ────────────────────────────────────────────────────
  const rows: TranslationItem[] = isServer ? serverPage?.items ?? [] : localPaged.items;
  const totalItems = isServer ? serverPage?.total ?? 0 : localPaged.total;
  const totalPages = isServer ? serverPage?.totalPages ?? 1 : localPaged.totalPages;
  const fromRow = isServer
    ? totalItems === 0
      ? 0
      : (page - 1) * pageSize + 1
    : localPaged.from;
  const toRow = isServer ? Math.min(page * pageSize, totalItems) : localPaged.to;
  const stats: TranslationStats = isServer
    ? serverPage?.stats ?? { total: 0, viCompleted: 0, enCompleted: 0 }
    : localStats;
  const facets: CategoryFacet[] = isServer ? serverPage?.categories ?? [] : localFacets;

  const dynamicCategories = useMemo(() => {
    const catIds = new Set<string>(['common', ...facets.map((f) => f.id)]);
    Object.keys(KNOWN_CATEGORY_LABELS).forEach((k) => catIds.add(k));
    const countsById = new Map(facets.map((f) => [f.id, f.count]));
    return [
      { id: 'all', label: language === 'en' ? 'All Categories' : 'Tất cả danh mục', count: stats.total },
      ...Array.from(catIds).map((catId) => {
        const labelObj = KNOWN_CATEGORY_LABELS[catId];
        const labelText = labelObj ? (language === 'en' ? labelObj.en : labelObj.vi) : catId;
        return { id: catId, label: labelText, count: countsById.get(catId) || 0 };
      }),
    ];
  }, [facets, language, stats.total]);

  // ── Row editing ───────────────────────────────────────────────────────────
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editVi, setEditVi] = useState('');
  const [editEn, setEditEn] = useState('');
  const [editCategory, setEditCategory] = useState('common');

  const handleStartEdit = (item: TranslationItem) => {
    setEditingRowKey(item.key);
    setEditVi(item.vi);
    setEditEn(item.en);
    setEditCategory(item.category);
  };

  const handleSaveEdit = async (key: string) => {
    await updateTranslation(key, editVi, editEn, editCategory);
    setEditingRowKey(null);
    addToast(language === 'en' ? `Translation '${key}' updated!` : `Đã cập nhật dịch thuật cho từ khóa '${key}'!`, 'success');
    if (isServer) refreshServerList();
  };

  const handleDelete = async (key: string) => {
    if (window.confirm(language === 'en' ? `Are you sure to delete key '${key}'?` : `Bạn có chắc muốn xóa từ khóa dịch '${key}'?`)) {
      await deleteTranslation(key);
      addToast(language === 'en' ? 'Translation deleted' : 'Đã xóa từ khóa dịch', 'info');
      if (isServer) refreshServerList();
    }
  };

  // ── Add-key modal ─────────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newCategory, setNewCategory] = useState('common');
  const [newVi, setNewVi] = useState('');
  const [newEn, setNewEn] = useState('');

  const handleAddNewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedKey = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!formattedKey) {
      addToast(language === 'en' ? 'Please enter a valid key code' : 'Vui lòng nhập mã từ khóa dịch', 'error');
      return;
    }
    if (!newVi && !newEn) {
      addToast(language === 'en' ? 'Please enter at least VI or EN translation' : 'Vui lòng nhập bản dịch tiếng Việt hoặc Tiếng Anh', 'error');
      return;
    }

    await createTranslation(formattedKey, newVi || newEn, newEn || newVi, newCategory);
    addToast(language === 'en' ? `Added new key '${formattedKey}' successfully!` : `Đã thêm mới từ khóa dịch '${formattedKey}' thành công!`, 'success');
    setIsAddModalOpen(false);
    setNewKey('');
    setNewVi('');
    setNewEn('');
    if (isServer) refreshServerList();
  };

  // ── Export / Import / Reset / Publish ─────────────────────────────────────
  const handleExportJSON = async () => {
    // Server mode only holds one page in memory — pull the full dictionary
    // from the API on demand; fall back to the bundled list if offline.
    let source: TranslationItem[] = translationsList;
    if (isServer) {
      try {
        const res = await fetch('/api/saas/translations/all');
        const json = await res.json();
        if (res.ok && json.ok && Array.isArray(json.data) && json.data.length > 0) {
          source = json.data;
        }
      } catch {
        // keep bundled list
      }
    }
    const flat: Record<string, string> = {};
    source.forEach((item) => {
      if (item.key && !item.key.startsWith('_')) {
        flat[item.key] = language === 'en' ? (item.en || item.vi) : (item.vi || item.en);
      }
    });
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(flat, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `erpacc_translations_${language}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast(language === 'en' ? 'Exported translation dictionary to JSON' : 'Đã xuất file từ điển dịch thuật JSON thành công', 'success');
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.target?.result as string);
      } catch {
        addToast(language === 'en' ? 'Invalid JSON file format' : 'File JSON không đúng định dạng', 'error');
        return;
      }

      const { items, skipped } = normalizeImportedTranslations(parsed);
      if (items.length === 0) {
        addToast(
          language === 'en'
            ? `No valid translation entries found${skipped ? ` (${skipped} skipped)` : ''}`
            : `Không tìm thấy bản dịch hợp lệ${skipped ? ` (bỏ qua ${skipped} dòng)` : ''}`,
          'error',
        );
        return;
      }

      setIsImporting(true);
      try {
        // Chunked upserts — far faster than one-by-one awaits for large files.
        for (let i = 0; i < items.length; i += IMPORT_CHUNK_SIZE) {
          const chunk = items.slice(i, i + IMPORT_CHUNK_SIZE);
          await Promise.all(
            chunk.map((it) => updateTranslation(it.key, it.vi || '', it.en || '', it.category || 'common')),
          );
        }
        addToast(
          language === 'en'
            ? `Imported ${items.length} translations${skipped ? `, skipped ${skipped}` : ''}!`
            : `Đã nhập ${items.length} bản dịch${skipped ? `, bỏ qua ${skipped} dòng` : ''} thành công!`,
          'success',
        );
        if (isServer) refreshServerList();
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    // Allow re-selecting the same file for a second import.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetDefaults = () => {
    if (window.confirm(language === 'en' ? 'Reset all translations to original system defaults?' : 'Khôi phục toàn bộ từ điển dịch về mặc định của hệ thống?')) {
      resetToDefaults();
      addToast(language === 'en' ? 'Reset to default dictionary' : 'Đã khôi phục từ điển mặc định', 'info');
      if (isServer) refreshServerList();
    }
  };

  const handleSaveAllToJSON = async () => {
    const result = await publishToJSON();
    if (result.ok) {
      addToast(
        language === 'en'
          ? `Published ${result.data?.published || 0} translations from DB to JSON files!`
          : `Đã xuất bản ${result.data?.published || 0} bản dịch từ DB ra JSON!`,
        'success',
      );
    } else {
      addToast(language === 'en' ? `Failed to publish: ${result.message}` : `Lỗi xuất bản: ${result.message}`, 'error');
    }
  };

  const handleSyncJson = async () => {
    await loadLocaleTranslations();
    addToast(language === 'en' ? 'Synced from JSON locale files' : 'Đã đồng bộ từ file JSON locale', 'info');
    if (isServer) refreshServerList();
  };

  const formatNumber = (n: number) => n.toLocaleString(language === 'en' ? 'en-US' : 'vi-VN');

  return (
    <div className="space-y-6">
      {/* Top Banner & Overview */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-blue-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <Languages className="w-4 h-4 text-blue-400" />
              <span>{language === 'en' ? 'System Translation Engine' : 'Hệ Thống Dịch Thuật Đa Ngôn Ngữ ERP'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {language === 'en' ? 'Multilingual Dictionary & Language Management' : 'Quản Lý Từ Điển & Ngôn Ngữ Hệ Thống'}
            </h2>
            <p className="text-slate-300 text-sm max-w-2xl">
              {language === 'en'
                ? 'Manage all system terms, navigation titles, buttons, and invoices dynamically in real time. Switch seamlessly between Vietnamese and English.'
                : 'Thao tác trực tiếp từ điển dịch toàn bộ giao diện ERP, danh mục menu, chứng từ, hóa đơn và thông báo. Tự động áp dụng tức thì không cần khởi động lại.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/15 transition cursor-pointer"
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>{language === 'en' ? 'Switch to 🇻🇳 VI' : 'Switch to 🇬🇧 EN'}</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'en' ? 'Add Translation Key' : 'Thêm Từ Khóa Dịch Mới'}</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'Total Keys' : 'Tổng số từ khóa'}</span>
            <span className="text-xl font-bold text-white">{formatNumber(stats.total)}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'Vietnamese 🇻🇳' : 'Hoàn thành Tiếng Việt 🇻🇳'}</span>
            <span className="text-xl font-bold text-emerald-400">{formatNumber(stats.viCompleted)} / {formatNumber(stats.total)}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'English 🇬🇧' : 'Hoàn thành Tiếng Anh 🇬🇧'}</span>
            <span className="text-xl font-bold text-blue-400">{formatNumber(stats.enCompleted)} / {formatNumber(stats.total)}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'Active Languages' : 'Ngôn ngữ đang bật'}</span>
            <span className="text-xl font-bold text-amber-300">2 (🇻🇳 VI / 🇬🇧 EN)</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Tools */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box (debounced, applied on Enter too) */}
          <form
            className="relative flex-1 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              setCommittedSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={language === 'en' ? 'Search key code, Vietnamese or English text... (Enter)' : 'Tìm theo mã từ khóa, bản dịch Việt/Anh... (Enter)'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </form>

          {/* Completion Status Filter */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TranslationStatusFilter)}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none"
              title={language === 'en' ? 'Filter by completion status' : 'Lọc theo trạng thái hoàn thành bản dịch'}
            >
              <option value="all">{language === 'en' ? 'All statuses' : 'Mọi trạng thái'}</option>
              <option value="missing_vi">{language === 'en' ? '⛔ Missing Vietnamese' : '⛔ Thiếu tiếng Việt'}</option>
              <option value="missing_en">{language === 'en' ? '⛔ Missing English' : '⛔ Thiếu tiếng Anh'}</option>
            </select>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncJson}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition cursor-pointer border border-emerald-200 dark:border-emerald-800"
              title="Sync translations from JSON locale files"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
              <span>{language === 'en' ? 'Sync JSON' : 'Đồng bộ JSON'}</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              title={language === 'en' ? 'Export dictionary JSON' : 'Xuất file JSON dịch thuật'}
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>JSON Export</span>
            </button>

            <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer ${isImporting ? 'opacity-60 pointer-events-none' : ''}`}>
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <Upload className="w-3.5 h-3.5 text-emerald-500" />}
              <span>{isImporting ? (language === 'en' ? 'Importing...' : 'Đang nhập...') : 'JSON Import'}</span>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition cursor-pointer border border-amber-200 dark:border-amber-800"
              title={language === 'en' ? 'Reset dictionary to defaults' : 'Khôi phục từ điển mặc định'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Reset Defaults' : 'Khôi phục mặc định'}</span>
            </button>

            <button
              onClick={handleSaveAllToJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition cursor-pointer border border-emerald-200 dark:border-emerald-800"
              title={language === 'en' ? 'Save all translations to JSON locale files' : 'Lưu tất cả dịch thuật vào file JSON'}
            >
              <Save className="w-3.5 h-3.5 text-emerald-500" />
              <span>{language === 'en' ? 'Publish to JSON' : 'Xuất bản ra JSON'}</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Filter className="w-3.5 h-3.5 text-zinc-400 mr-1 flex-shrink-0" />
          {dynamicCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}>
                {formatNumber(cat.count)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Translations Main Table (paginated — only one page is rendered) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {language === 'en' ? 'Dictionary Term List' : 'Danh sách Từ khóa Dịch thuật Giao diện'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {formatNumber(totalItems)} {language === 'en' ? 'items' : 'từ khóa'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            <span
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full font-semibold ${
                isServer
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
              }`}
              title={
                isServer
                  ? language === 'en'
                    ? 'Paging straight from sys_translations (Supabase)'
                    : 'Phân trang trực tiếp từ bảng sys_translations (Supabase)'
                  : language === 'en'
                    ? 'API unavailable — showing the bundled i18n dictionary'
                  : 'Không kết nối được API — hiển thị từ điển i18n đóng gói'
              }
            >
              {isServer ? <Database className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
              {mode === 'loading'
                ? language === 'en'
                  ? 'Loading...'
                  : 'Đang tải...'
                : isServer
                  ? language === 'en'
                    ? 'Source: Database (live)'
                    : 'Nguồn: Database (thời gian thực)'
                  : language === 'en'
                    ? 'Source: Local i18n bundle'
                    : 'Nguồn: Cục bộ (i18n bundle)'}
            </span>
          </div>
        </div>

        {fetchError && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {language === 'en'
                ? `Could not refresh from server (${fetchError}) — showing the last loaded page.`
                : `Không làm mới được từ máy chủ (${fetchError}) — đang hiển thị trang vừa tải.`}
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-100/80 dark:bg-zinc-800/80 uppercase text-[10px] tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 w-1/4">{language === 'en' ? 'Key Code & Category' : 'Mã từ khóa & Danh mục'}</th>
                <th className="py-3 px-4 w-1/3">Tiếng Việt 🇻🇳</th>
                <th className="py-3 px-4 w-1/3">English 🇬🇧</th>
                <th className="py-3 px-4 text-right w-24">{language === 'en' ? 'Action' : 'Thao tác'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {mode === 'loading' ? (
                // First load skeleton
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-10 ml-auto rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-zinc-400" />
                      <span>{language === 'en' ? 'No translation key matched the filters' : 'Không tìm thấy từ khóa dịch thỏa mãn điều kiện lọc'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((item) => {
                  const isEditing = editingRowKey === item.key;
                  return (
                    <tr key={item.key} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${isEditing ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      {/* Key Code & Category */}
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="space-y-1">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px] text-blue-600 dark:text-blue-400 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                            {item.key}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value.toLowerCase().trim())}
                                placeholder="category"
                                className="px-1.5 py-0.5 rounded border border-blue-400 dark:border-blue-600 bg-white dark:bg-zinc-800 text-[10px] font-mono font-bold text-zinc-900 dark:text-zinc-100"
                              />
                            ) : (
                              <span className="uppercase font-semibold text-zinc-500 dark:text-zinc-400">{item.category}</span>
                            )}
                            {item.isCustom && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-sans">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Vietnamese Translation */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <textarea
                            rows={2}
                            value={editVi}
                            onChange={(e) => setEditVi(e.target.value)}
                            className="w-full p-2 rounded-lg border border-blue-400 dark:border-blue-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 break-words">{item.vi || <span className="text-zinc-400 italic">(Chưa dịch)</span>}</span>
                        )}
                      </td>

                      {/* English Translation */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <textarea
                            rows={2}
                            value={editEn}
                            onChange={(e) => setEditEn(e.target.value)}
                            className="w-full p-2 rounded-lg border border-blue-400 dark:border-blue-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 break-words">{item.en || <span className="text-zinc-400 italic">(Untranslated)</span>}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSaveEdit(item.key)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
                              title={language === 'en' ? 'Save' : 'Lưu'}
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingRowKey(null)}
                              className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 transition cursor-pointer"
                              title={language === 'en' ? 'Cancel' : 'Hủy'}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition cursor-pointer"
                              title={language === 'en' ? 'Edit translation' : 'Sửa bản dịch'}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.key)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                              title={language === 'en' ? 'Delete key' : 'Xóa từ khóa'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {language === 'en' ? 'Showing' : 'Hiển thị'}{' '}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {formatNumber(fromRow)}–{formatNumber(toRow)}
            </span>{' '}
            {language === 'en' ? 'of' : '/'} <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatNumber(totalItems)}</span>{' '}
            {language === 'en' ? 'items' : 'từ khóa'}
          </span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <label htmlFor="translations-page-size">{language === 'en' ? 'Rows/page' : 'Số dòng/trang'}</label>
              <select
                id="translations-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || isFetching}
                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title={language === 'en' ? 'First page' : 'Trang đầu'}
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title={language === 'en' ? 'Previous page' : 'Trang trước'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-600 text-white">
                {formatNumber(page)} / {formatNumber(totalPages)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title={language === 'en' ? 'Next page' : 'Trang sau'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || isFetching}
                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title={language === 'en' ? 'Last page' : 'Trang cuối'}
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Languages Configuration Box */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {language === 'en' ? 'System Languages & Locale Settings' : 'Cấu hình Ngôn ngữ Hệ thống & Quốc gia'}
            </h3>
          </div>
          <span className="text-xs text-zinc-500">Default: 🇻🇳 Tiếng Việt (vi)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lang 1: Tiếng Việt */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇻🇳</span>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Tiếng Việt (Vietnamese)</h4>
                <p className="text-xs text-zinc-500">Mã: <code className="font-mono text-blue-600">vi</code> | {language === 'en' ? 'System source language' : 'Ngôn ngữ gốc hệ thống'}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
              {language === 'en' ? 'Default (Active)' : 'Mặc định (Active)'}
            </span>
          </div>

          {/* Lang 2: English */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇬🇧</span>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">English (Tiếng Anh)</h4>
                <p className="text-xs text-zinc-500">Mã: <code className="font-mono text-blue-600">en</code> | {language === 'en' ? 'Commercial International' : 'Thương mại quốc tế'}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {language === 'en' ? 'Enabled (Active)' : 'Kích hoạt (Active)'}
            </span>
          </div>
        </div>
      </div>

      {/* Add New Key Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-blue-600">
                <Plus className="w-5 h-5" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {language === 'en' ? 'Add New Translation Key' : 'Thêm Từ Khóa Dịch Mới Cho Hệ Thống'}
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
                  {language === 'en' ? 'Key Code Identifier' : 'Mã từ khóa (Key Code Identifier)'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: report_monthly_vat, button_approve_po"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === 'en' ? 'Category' : 'Danh mục phân loại (Category)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={KNOWN_CATEGORY_LABELS[newCategory] ? newCategory : ''}
                    onChange={(e) => setNewCategory(e.target.value || 'common')}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {!KNOWN_CATEGORY_LABELS[newCategory] && <option value="">{newCategory}</option>}
                    {dynamicCategories
                      .filter((c) => c.id !== 'all' && (KNOWN_CATEGORY_LABELS[c.id] || facets.some((f) => f.id === c.id)))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} ({c.label})
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    placeholder={language === 'en' ? 'Or type a new category...' : 'Hoặc nhập danh mục mới...'}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value.toLowerCase().trim())}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === 'en' ? 'Vietnamese Translation 🇻🇳' : 'Bản dịch Tiếng Việt 🇻🇳'}
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Nhập nghĩa Tiếng Việt..."
                  value={newVi}
                  onChange={(e) => setNewVi(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === 'en' ? 'English Translation 🇬🇧' : 'Bản dịch Tiếng Anh 🇬🇧'}
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter English translation..."
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {language === 'en' ? 'Save Key' : 'Lưu từ khóa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSTranslationsTab;
