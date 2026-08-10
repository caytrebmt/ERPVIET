import React, { useState, useMemo } from 'react';
import {
  Globe,
  Search,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Edit3,
  Languages,
  Filter,
  Layers,
  Sparkles,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { useLanguage, TranslationItem } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { matchesVietnameseSearch } from '../utils/vietnamese';

export const SaaSTranslationsTab: React.FC = () => {
  const {
    language,
    toggleLanguage,
     translationsList,
    updateTranslation,
    createTranslation,
    deleteTranslation,
    resetToDefaults,
    refreshTranslations,
    loadLocaleTranslations,
    saveAllToJSON,
    t,
  } = useLanguage();

  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);

  // Edit State for in-table editing
  const [editVi, setEditVi] = useState('');
  const [editEn, setEditEn] = useState('');
  const [editCategory, setEditCategory] = useState('common');

  // Modal State for Add New Key
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newCategory, setNewCategory] = useState('common');
  const [newVi, setNewVi] = useState('');
  const [newEn, setNewEn] = useState('');

  // Dynamic Categories list computed from translationsList
  const dynamicCategories = useMemo(() => {
    const knownLabels: Record<string, { vi: string; en: string }> = {
      common: { vi: 'Chung & Nút bấm', en: 'Common & Buttons' },
      menu: { vi: 'Menu & Điều hướng', en: 'Sidebar & Menus' },
      dashboard: { vi: 'Tổng quan & Thống kê', en: 'Dashboard & Metrics' },
      products: { vi: 'Sản phẩm & Hàng hóa', en: 'Products & Items' },
      categories: { vi: 'Danh mục WebShop', en: 'Store Categories' },
      footer: { vi: 'Chân trang WebShop', en: 'WebShop Footer' },
      inventory: { vi: 'Kho & Xuất nhập', en: 'Warehouse & Stock' },
      finance: { vi: 'Tài chính & Hóa đơn', en: 'Finance & Invoices' },
      accounting: { vi: 'Sổ Kế toán TT200', en: 'Accounting TT200' },
      saas: { vi: 'Cấu hình System SaaS', en: 'SaaS System Config' },
    };

    const uniqueCats = Array.from(new Set(translationsList.map((i) => i.category || 'common')));
    
    // Ensure all known categories exist in list even if 0 items initially
    Object.keys(knownLabels).forEach((k) => {
      if (!uniqueCats.includes(k)) uniqueCats.push(k);
    });

    return [
      { id: 'all', label: language === 'en' ? 'All Categories' : 'Tất cả danh mục', count: translationsList.length },
      ...uniqueCats.map((catId) => {
        const count = translationsList.filter((i) => (i.category || 'common') === catId).length;
        const labelObj = knownLabels[catId];
        const labelText = labelObj ? (language === 'en' ? labelObj.en : labelObj.vi) : catId;
        return { id: catId, label: labelText, count };
      }),
    ];
  }, [translationsList, language]);

  // Filtered list
  const filteredTranslations = useMemo(() => {
    return translationsList.filter((item) => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch =
        matchesVietnameseSearch(item.key, searchTerm) ||
        matchesVietnameseSearch(item.vi, searchTerm) ||
        matchesVietnameseSearch(item.en, searchTerm);
      return matchCategory && matchSearch;
    });
  }, [translationsList, selectedCategory, searchTerm]);

  // Statistics
  const totalKeys = translationsList.length;
  const viCompleted = translationsList.filter((i) => i.vi.trim().length > 0).length;
  const enCompleted = translationsList.filter((i) => i.en.trim().length > 0).length;

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
  };

  const handleDelete = async (key: string) => {
    if (window.confirm(language === 'en' ? `Are you sure to delete key '${key}'?` : `Bạn có chắc muốn xóa từ khóa dịch '${key}'?`)) {
      await deleteTranslation(key);
      addToast(language === 'en' ? 'Translation deleted' : 'Đã xóa từ khóa dịch', 'info');
    }
  };

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
  };

  const handleExportJSON = () => {
  const flat: Record<string, string> = {};
  translationsList.forEach((item) => {
    flat[item.key] = language === 'en' ? (item.en || item.vi) : (item.vi || item.en);
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

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.key && (item.vi || item.en)) {
              updateTranslation(item.key, item.vi || '', item.en || '', item.category || 'common');
            }
          });
          addToast(language === 'en' ? 'Imported translation JSON file successfully!' : 'Đã nhập dữ liệu dịch thuật từ file JSON thành công!', 'success');
        }
      } catch (err) {
        addToast(language === 'en' ? 'Invalid JSON file format' : 'File JSON không đúng định dạng', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (window.confirm(language === 'en' ? 'Reset all translations to original system defaults?' : 'Khôi phục toàn bộ từ điển dịch về mặc định của hệ thống?')) {
      resetToDefaults();
      addToast(language === 'en' ? 'Reset to default dictionary' : 'Đã khôi phục từ điển mặc định', 'info');
    }
  };

  const handleSaveAllToJSON = async () => {
    const result = await saveAllToJSON();
    if (result.ok) {
      addToast(language === 'en' ? `Saved ${totalKeys} keys to JSON files!` : `Đã lưu ${totalKeys} từ khóa vào file JSON!`, 'success');
    } else {
      addToast(language === 'en' ? `Failed to save to JSON: ${result.message}` : `Lỗi lưu JSON: ${result.message}`, 'error');
    }
  };

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
            <span className="text-xl font-bold text-white">{totalKeys}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'Vietnamese 🇻🇳' : 'Hoàn thành Tiếng Việt 🇻🇳'}</span>
            <span className="text-xl font-bold text-emerald-400">{viCompleted} / {totalKeys}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'English 🇬🇧' : 'Hoàn thành Tiếng Anh 🇬🇧'}</span>
            <span className="text-xl font-bold text-blue-400">{enCompleted} / {totalKeys}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'Active Languages' : 'Ngôn ngữ đang bật'}</span>
            <span className="text-xl font-bold text-amber-300">2 (🇻🇳 VI / 🇬🇧 EN)</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category & Tools */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'en' ? 'Search translation keys or values...' : 'Tìm kiếm theo mã từ khóa, từ dịch tiếng Việt, tiếng Anh...'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                loadLocaleTranslations();
                addToast(language === 'en' ? 'Synced from JSON locale files' : 'Đồng bộ từ file JSON locale', 'info');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition cursor-pointer border border-emerald-200 dark:border-emerald-800"
              title="Sync translations from JSON locale files"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
              <span>{language === 'en' ? 'Sync JSON' : 'Đồng bộ JSON'}</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              title="Xuất file JSON dịch thuật"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>JSON Export</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-500" />
              <span>JSON Import</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition cursor-pointer border border-amber-200 dark:border-amber-800"
              title="Khôi phục từ điển mặc định"
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
              <span>{language === 'en' ? 'Save to JSON' : 'Lưu ra JSON'}</span>
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
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Translations Main Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {language === 'en' ? 'Dictionary Term List' : 'Danh sách Từ khóa Dịch thuật Giao diện'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {filteredTranslations.length} {language === 'en' ? 'items' : 'từ khóa'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-100/80 dark:bg-zinc-800/80 uppercase text-[10px] tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 w-1/4">Key Code & Category</th>
                <th className="py-3 px-4 w-1/3">Tiếng Việt 🇻🇳</th>
                <th className="py-3 px-4 w-1/3">English 🇬🇧</th>
                <th className="py-3 px-4 text-right w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredTranslations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-zinc-400" />
                      <span>{language === 'en' ? 'No translation key matched search' : 'Không tìm thấy từ khóa dịch thỏa mãn điều kiện'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTranslations.map((item) => {
                  const isEditing = editingRowKey === item.key;
                  return (
                    <tr key={item.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      {/* Key Code & Category */}
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="space-y-1">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px] text-blue-600 dark:text-blue-400 font-semibold border border-zinc-200 dark:border-zinc-700">
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
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{item.vi || <span className="text-zinc-400 italic">(Chưa dịch)</span>}</span>
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
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{item.en || <span className="text-zinc-400 italic">(Untranslated)</span>}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSaveEdit(item.key)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
                              title="Lưu"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingRowKey(null)}
                              className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 transition cursor-pointer"
                              title="Hủy"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition cursor-pointer"
                              title="Sửa bản dịch"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.key)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                              title="Xóa từ khóa"
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
                <p className="text-xs text-zinc-500">Mã: <code className="font-mono text-blue-600">vi</code> | Ngôn ngữ gốc hệ thống</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
              Mặc định (Active)
            </span>
          </div>

          {/* Lang 2: English */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇬🇧</span>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">English (Tiếng Anh)</h4>
                <p className="text-xs text-zinc-500">Mã: <code className="font-mono text-blue-600">en</code> | Commercial International</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Kích hoạt (Active)
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
                  Mã từ khóa (Key Code Identifier) *
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
                  Danh mục phân loại (Category)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {dynamicCategories.filter(c => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} ({c.label})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Hoặc nhập danh mục mới..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value.toLowerCase().trim())}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Bản dịch Tiếng Việt 🇻🇳
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
                  English Translation 🇬🇧
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
