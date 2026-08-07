import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  FileSpreadsheet,
  Plus,
  Search,
  ShoppingCart,
  Calendar,
  DollarSign,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Send,
  Eye,
  Check,
  PackageCheck,
  Layers,
  FileText,
  User,
  ArrowDownLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import {
  PurchaseRequest,
  RequestForQuotation,
  PurchaseOrder,
  getStoredPRs,
  savePRs,
  getStoredRFQs,
  saveRFQs,
  getStoredPOs,
  savePOs,
  PRItem,
  SupplierQuote,
} from '../../services/procurementStore';

export const SaaSPurchasingPage: React.FC = () => {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isEn = language === 'en';

  const [activeTab, setActiveTab] = useState<'PR' | 'RFQ' | 'PO' | 'STOCK_IN'>('PO');

  // Stores
  const [prs, setPRs] = useState<PurchaseRequest[]>([]);
  const [rfqs, setRFQs] = useState<RequestForQuotation[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);

  const [search, setSearch] = useState('');

  // Modals
  const [showCreatePRModal, setShowCreatePRModal] = useState(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [viewingPR, setViewingPR] = useState<PurchaseRequest | null>(null);
  const [viewingRFQ, setViewingRFQ] = useState<RequestForQuotation | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // Form states
  const [newPR, setNewPR] = useState({
    department: '',
    priority: 'THUONG' as 'THUONG' | 'CAO' | 'KHAN_CAP',
    reason: '',
    items: [],
  });

  const [newPO, setNewPO] = useState({
    supplier_name: '',
    supplier_phone: '',
    supplier_address: '',
    expected_delivery: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    payment_terms: '',
    items: [],
  });

  useEffect(() => {
    setPRs(getStoredPRs());
    setRFQs(getStoredRFQs());
    setPOs(getStoredPOs());
  }, []);

  const updatePRList = (newPRs: PurchaseRequest[]) => {
    setPRs(newPRs);
    savePRs(newPRs);
  };

  const updateRFQList = (newRFQs: RequestForQuotation[]) => {
    setRFQs(newRFQs);
    saveRFQs(newRFQs);
  };

  const updatePOList = (newPOs: PurchaseOrder[]) => {
    setPOs(newPOs);
    savePOs(newPOs);
  };

  // --- ACTIONS: PR ---
  const handleCreatePR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPR.reason || newPR.items.length === 0) {
      showToast(isEn ? 'Please provide reason and items' : 'Vui lòng điền lý do và danh mục vật tư', 'error');
      return;
    }

    const itemsCalculated: PRItem[] = newPR.items.map((it, idx) => ({
      id: String(idx + 1),
      ...it,
      subtotal: it.quantity * it.estimatedUnitPrice,
    }));

    const totalEst = itemsCalculated.reduce((acc, cur) => acc + cur.subtotal, 0);

    const created: PurchaseRequest = {
      id: Date.now(),
      code: `PR-2026-00${prs.length + 1}`,
      department: newPR.department,
      request_date: new Date().toISOString().slice(0, 10),
      required_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      priority: newPR.priority,
      reason: newPR.reason,
      status: 'CHO_DUYET',
      items: itemsCalculated,
      total_estimated_amount: totalEst,
      creator: 'Nguyễn Văn Khách (Nhân viên)',
    };

    updatePRList([created, ...prs]);
    setShowCreatePRModal(false);
    showToast(isEn ? 'Purchase Request (PR) created' : 'Tạo Yêu Cầu Mua Hàng (PR) thành công!', 'success');
  };

  const handleApprovePR = (prId: number) => {
    const updated = prs.map((p) =>
      p.id === prId
        ? {
            ...p,
            status: 'DA_DUYET' as const,
            approved_by: 'Giám Đốc Mua Hàng',
          }
        : p
    );
    updatePRList(updated);
    showToast(isEn ? 'Approved Purchase Request (PR)' : 'Đã duyệt Yêu Cầu Mua Hàng (PR)!', 'success');
  };

  const handleConvertPRToRFQ = (pr: PurchaseRequest) => {
    const rfqCreated: RequestForQuotation = {
      id: Date.now(),
      code: `RFQ-2026-00${rfqs.length + 1}`,
      pr_code: pr.code,
      created_date: new Date().toISOString().slice(0, 10),
      deadline_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      status: 'CHO_BAO_GIA',
      creator: 'Phạm Mua Hàng',
      items: pr.items,
      supplier_quotes: [
        {
          supplierId: 's1',
          supplierName: 'Tổng Công Ty Giấy & Bao Bì Double A Việt Nam',
          supplierPhone: '0912 345 678',
          quotedPriceTotal: pr.total_estimated_amount * 0.98,
          deliveryDays: 3,
          warrantyTerms: 'Đổi mới 100% nếu có lỗi từ nhà sản xuất',
          isSelected: false,
          notes: 'Chiết khấu 2% mua số lượng lớn',
        },
        {
          supplierId: 's2',
          supplierName: 'Nhà Phân Phối Linh Kiện Máy Tính SPC',
          supplierPhone: '0988 111 222',
          quotedPriceTotal: pr.total_estimated_amount * 1.02,
          deliveryDays: 2,
          warrantyTerms: 'Bảo hành chính hãng 12-36 tháng',
          isSelected: false,
          notes: 'Hỗ trợ giao hàng miễn phí trong ngày',
        },
      ],
    };

    updateRFQList([rfqCreated, ...rfqs]);

    const updatedPRs = prs.map((p) => (p.id === pr.id ? { ...p, status: 'DA_TAO_RFQ' as const } : p));
    updatePRList(updatedPRs);

    setActiveTab('RFQ');
    showToast(
      isEn
        ? `Generated RFQ (${rfqCreated.code}) from PR (${pr.code})`
        : `Đã tự động tạo Yêu Cầu Báo Giá (${rfqCreated.code}) từ PR (${pr.code})!`,
      'success'
    );
  };

  // --- ACTIONS: RFQ ---
  const handleSelectRFQSupplier = (rfqId: number, supplierId: string) => {
    const updatedRFQs = rfqs.map((r) => {
      if (r.id !== rfqId) return r;
      const updatedQuotes = r.supplier_quotes.map((q) => ({
        ...q,
        isSelected: q.supplierId === supplierId,
      }));
      return {
        ...r,
        selected_supplier_id: supplierId,
        status: 'DA_CHON_NCC' as const,
        supplier_quotes: updatedQuotes,
      };
    });
    updateRFQList(updatedRFQs);
    showToast(isEn ? 'Selected winning supplier for RFQ' : 'Đã chọn Nhà Cung Cấp thắng thầu cho RFQ!', 'success');
  };

  const handleConvertRFQToPO = (rfq: RequestForQuotation) => {
    const selectedQuote = rfq.supplier_quotes.find((q) => q.isSelected) || rfq.supplier_quotes[0];
    if (!selectedQuote) {
      showToast(isEn ? 'Please select a supplier quote first' : 'Vui lòng chọn báo giá Nhà Cung Cấp trước', 'error');
      return;
    }

    const subtotal = selectedQuote.quotedPriceTotal;
    const vat = subtotal * 0.1;
    const total = subtotal + vat;

    const poCreated: PurchaseOrder = {
      id: Date.now(),
      po_number: `PO-2026-00${pos.length + 1}`,
      pr_code: rfq.pr_code,
      rfq_code: rfq.code,
      supplier_id: selectedQuote.supplierId,
      supplier_name: selectedQuote.supplierName,
      supplier_phone: selectedQuote.supplierPhone,
      supplier_address: 'KCN Sài Đồng, Long Biên, Hà Nội',
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery: new Date(Date.now() + selectedQuote.deliveryDays * 86400000).toISOString().slice(0, 10),
      payment_terms: selectedQuote.warrantyTerms || 'Thanh toán 100% khi nhận đủ hàng',
      status: 'DA_DUYET',
      creator: 'Phạm Mua Hàng',
      subtotal,
      vat_amount: vat,
      total_amount: total,
      stock_in_vouchers: [],
      items: rfq.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.estimatedUnitPrice,
        vatRate: 10,
        subtotal: it.subtotal,
      })),
    };

    updatePOList([poCreated, ...pos]);
    setActiveTab('PO');
    showToast(
      isEn
        ? `Created PO (${poCreated.po_number}) from RFQ (${rfq.code})`
        : `Tạo Đơn Mua Hàng (${poCreated.po_number}) từ RFQ (${rfq.code}) thành công!`,
      'success'
    );
  };

  // --- ACTIONS: PO ---
  const handleApprovePO = (poId: number) => {
    const updated = pos.map((p) => (p.id === poId ? { ...p, status: 'DA_DUYET' as const } : p));
    updatePOList(updated);
    showToast(isEn ? 'Approved Purchase Order (PO)' : 'Đã duyệt Đơn Mua Hàng (PO)!', 'success');
  };

  const handleCreateStockInFromPO = (po: PurchaseOrder) => {
    // Navigate to stock-in with prefilled state in location state
    navigate('/saas/stock-in', {
      state: {
        fromPO: po,
      },
    });
    showToast(
      isEn
        ? `Transferring PO ${po.po_number} to Stock-In Receipt...`
        : `Chuyển đơn PO ${po.po_number} sang Phiếu Nhập Kho...`,
      'info'
    );
  };

  const handleCreateManualPO = (e: React.FormEvent) => {
    e.preventDefault();
    const item = newPO.items[0];
    const subtotal = item.quantity * item.unitPrice;
    const vat = subtotal * (item.vatRate / 100);
    const total = subtotal + vat;

    const poCreated: PurchaseOrder = {
      id: Date.now(),
      po_number: `PO-2026-00${pos.length + 1}`,
      supplier_id: 's1',
      supplier_name: newPO.supplier_name,
      supplier_phone: newPO.supplier_phone,
      supplier_address: newPO.supplier_address,
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery: newPO.expected_delivery,
      payment_terms: newPO.payment_terms,
      status: 'CHO_DUYET',
      creator: 'Phạm Mua Hàng',
      subtotal,
      vat_amount: vat,
      total_amount: total,
      stock_in_vouchers: [],
      items: [
        {
          id: '1',
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          subtotal,
        },
      ],
    };

    updatePOList([poCreated, ...pos]);
    setShowCreatePOModal(false);
    showToast(isEn ? 'Created PO successfully' : 'Lập Đơn Mua Hàng (PO) thành công!', 'success');
  };

  // Status badge styling
  const getPRStatusBadge = (status: PurchaseRequest['status']) => {
    switch (status) {
      case 'CHO_DUYET':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'DA_DUYET':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'DA_TAO_RFQ':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'DA_TAO_PO':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const getPOStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      case 'CHO_DUYET':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'DA_DUYET':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'DANG_GIAO':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'DA_NHAP_KHO':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Closed-Loop Procurement Process Stepper Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-amber-500/5 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Truck className="h-5 w-5 text-amber-400" />
              <span>
                {isEn ? 'Closed-Loop Procurement & Goods Receipt Lifecycle' : 'Quy Trình Mua Hàng & Nhập Kho Khép Kín (PR ➔ RFQ ➔ PO ➔ Stock-In)'}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isEn
                ? 'Seamless workflow: Purchase Request (PR) ➔ Supplier Quotation (RFQ) ➔ Purchase Order (PO) ➔ Goods Receipt (Stock-In).'
                : 'Quy trình hoàn chỉnh: Đề xuất mua hàng (PR) ➔ Yêu cầu báo giá (RFQ) ➔ Đơn mua hàng (PO) ➔ Nhập kho lưu kho tự động.'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/saas/stock-in')}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-zinc-700 transition-colors"
            >
              <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
              <span>{isEn ? 'View Goods Receipts' : 'Xem Sổ Nhập Kho'}</span>
            </button>
          </div>
        </div>

        {/* 4-Step Interactive Process Visual Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Step 1: PR */}
          <div
            onClick={() => setActiveTab('PR')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'PR'
                ? 'bg-amber-500/10 border-amber-500/40 shadow-xs'
                : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                BƯỚC 1
              </span>
              <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            </div>
            <div className="font-bold text-sm text-zinc-100 mt-2">1. Yêu Cầu Mua Hàng (PR)</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">{prs.length} Phiếu đề xuất đang quản lý</div>
          </div>

          {/* Step 2: RFQ */}
          <div
            onClick={() => setActiveTab('RFQ')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'RFQ'
                ? 'bg-amber-500/10 border-amber-500/40 shadow-xs'
                : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                BƯỚC 2
              </span>
              <Send className="h-4 w-4 text-purple-400" />
            </div>
            <div className="font-bold text-sm text-zinc-100 mt-2">2. Yêu Cầu Báo Giá (RFQ)</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">{rfqs.length} Báo giá NCC so sánh</div>
          </div>

          {/* Step 3: PO */}
          <div
            onClick={() => setActiveTab('PO')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'PO'
                ? 'bg-amber-500/10 border-amber-500/40 shadow-xs'
                : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                BƯỚC 3
              </span>
              <ShoppingCart className="h-4 w-4 text-blue-400" />
            </div>
            <div className="font-bold text-sm text-zinc-100 mt-2">3. Đơn Mua Hàng (PO)</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">{pos.length} Đơn hàng duyệt mua</div>
          </div>

          {/* Step 4: Stock In */}
          <div
            onClick={() => navigate('/saas/stock-in')}
            className="p-3 rounded-xl border bg-zinc-900/80 border-zinc-800 hover:border-emerald-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                BƯỚC 4
              </span>
              <PackageCheck className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-bold text-sm text-zinc-100 mt-2 flex items-center justify-between">
              <span>4. Nhập Kho (Stock-In)</span>
              <ChevronRight className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-[11px] text-emerald-400/90 mt-0.5">Tạo phiếu nhập từ PO (1-Click)</div>
          </div>
        </div>
      </div>

      {/* Main Tab Controls & Search */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b sm:border-b-0 border-zinc-200 dark:border-zinc-800 pb-2 sm:pb-0 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('PO')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'PO'
                ? 'bg-amber-500 text-zinc-950 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Đơn Mua Hàng (PO)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-900/20 dark:bg-zinc-950/40">
              {pos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PR')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'PR'
                ? 'bg-amber-500 text-zinc-950 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Yêu Cầu Mua Hàng (PR)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-900/20 dark:bg-zinc-950/40">
              {prs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('RFQ')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'RFQ'
                ? 'bg-amber-500 text-zinc-950 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Yêu Cầu Báo Giá (RFQ)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-900/20 dark:bg-zinc-950/40">
              {rfqs.length}
            </span>
          </button>
        </div>

        {/* Action Buttons & Search */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo mã, từ khóa..."
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {activeTab === 'PR' && (
            <button
              onClick={() => setShowCreatePRModal(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Lập Yêu Cầu PR</span>
            </button>
          )}

          {activeTab === 'PO' && (
            <button
              onClick={() => setShowCreatePOModal(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Lập Đơn Mua PO</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB CONTENT: 1. YÊU CẦU MUA HÀNG (PR) */}
      {activeTab === 'PR' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                <span>Danh Sách Yêu Cầu Mua Hàng (PR - Purchase Requests)</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Phiếu yêu cầu vật tư từ các phòng ban, chờ Ban Giám Đốc hoặc Trưởng Phòng Mua Hàng phê duyệt.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Mã PR</th>
                  <th className="px-4 py-3">Phòng Ban Đề Xuất</th>
                  <th className="px-4 py-3">Ngày Đề Xuất</th>
                  <th className="px-4 py-3">Mức Độ Ưu Tiên</th>
                  <th className="px-4 py-3">Lý Do / Mục Đích</th>
                  <th className="px-4 py-3">Dự Kiến Kinh Phí</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                  <th className="px-4 py-3 text-right">Thao Tác Quy Trình</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {prs
                  .filter(
                    (p) =>
                      p.code.toLowerCase().includes(search.toLowerCase()) ||
                      p.department.toLowerCase().includes(search.toLowerCase()) ||
                      p.reason.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((pr) => (
                    <tr key={pr.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">{pr.code}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{pr.department}</td>
                      <td className="px-4 py-3 text-zinc-500">{pr.request_date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pr.priority === 'KHAN_CAP'
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : pr.priority === 'CAO'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                          }`}
                        >
                          {pr.priority === 'KHAN_CAP' ? 'Khẩn cấp' : pr.priority === 'CAO' ? 'Cao' : 'Bình thường'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 max-w-xs truncate">{pr.reason}</td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                        {pr.total_estimated_amount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getPRStatusBadge(pr.status)}`}>
                          {pr.status === 'CHO_DUYET'
                            ? 'Chờ Duyệt'
                            : pr.status === 'DA_DUYET'
                            ? 'Đã Duyệt'
                            : pr.status === 'DA_TAO_RFQ'
                            ? 'Đã Tạo RFQ'
                            : 'Đã Tạo PO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingPR(pr)}
                            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                            title="Xem chi tiết phiếu PR"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {pr.status === 'CHO_DUYET' && (
                            <button
                              onClick={() => handleApprovePR(pr.id)}
                              className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-md text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              <span>Duyệt</span>
                            </button>
                          )}

                          {(pr.status === 'DA_DUYET' || pr.status === 'CHO_DUYET') && (
                            <button
                              onClick={() => handleConvertPRToRFQ(pr)}
                              className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              title="Chuyển PR thành Đơn Yêu Cầu Báo Giá (RFQ)"
                            >
                              <Send className="h-3 w-3" />
                              <span>Tạo RFQ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. ĐƠN YÊU CẦU BÁO GIÁ (RFQ) */}
      {activeTab === 'RFQ' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Send className="h-4 w-4 text-purple-400" />
              <span>Yêu Cầu Báo Giá Nhà Cung Cấp (RFQ - Request For Quotation)</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Gửi danh mục vật tư chào giá tới nhiều Nhà Cung Cấp, so sánh báo giá cạnh tranh để chọn Nhà Thầu tối ưu nhất.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rfqs.map((rfq) => (
              <div key={rfq.id} className="p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
                      {rfq.code}
                    </span>
                    {rfq.pr_code && (
                      <span className="text-xs text-zinc-400 font-mono">
                        Gốc PR: <span className="text-amber-400 font-bold">{rfq.pr_code}</span>
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      Hạn chót báo giá: <strong className="text-zinc-300">{rfq.deadline_date}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleConvertRFQToPO(rfq)}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span>Chuyển Thành Đơn Mua Hàng (PO)</span>
                    </button>
                  </div>
                </div>

                {/* Items in RFQ */}
                <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-800 text-xs">
                  <span className="font-bold text-zinc-300 block mb-1">Danh mục vật tư chào giá:</span>
                  <div className="flex flex-wrap gap-2">
                    {rfq.items.map((it) => (
                      <span key={it.id} className="bg-zinc-800 px-2 py-1 rounded text-zinc-200 font-mono">
                        {it.productName} (SKU: {it.sku}) - {it.quantity} {it.unit}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Supplier Quotes Comparison Matrix */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Bảng So Sánh Báo Giá Từ Các Nhà Cung Cấp:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rfq.supplier_quotes.map((quote) => (
                      <div
                        key={quote.supplierId}
                        className={`p-3.5 rounded-xl border transition-all ${
                          quote.isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-xs text-zinc-100">{quote.supplierName}</h4>
                            <p className="text-[11px] text-zinc-400">SĐT: {quote.supplierPhone}</p>
                          </div>

                          {quote.isSelected ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-zinc-950 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Đã Chọn
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSelectRFQSupplier(rfq.id, quote.supplierId)}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-300 transition-colors"
                            >
                              Chọn Báo Giá Này
                            </button>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-zinc-800/80 pt-2">
                          <div>
                            <span className="text-zinc-500 block text-[10px]">Tổng Giá Báo Chào:</span>
                            <span className="font-bold text-amber-400 text-sm">
                              {quote.quotedPriceTotal.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[10px]">Thời Gian Giao Hàng:</span>
                            <span className="font-semibold text-zinc-200">{quote.deliveryDays} ngày</span>
                          </div>
                        </div>

                        {quote.notes && (
                          <div className="mt-2 text-[11px] text-zinc-400 italic bg-zinc-950/30 p-1.5 rounded">
                            "{quote.notes}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 3. ĐƠN MUA HÀNG (PO) */}
      {activeTab === 'PO' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-400" />
                <span>Danh Sách Đơn Mua Hàng Khép Kín (PO - Purchase Orders)</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Đơn hàng chính thức ký kết với Nhà cung cấp. Cho phép 1-Click chuyển dữ liệu trực tiếp sang Sổ Nhập Kho (Stock-In).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Mã Đơn PO</th>
                  <th className="px-4 py-3">Liên Kết Chứng Từ</th>
                  <th className="px-4 py-3">Nhà Cung Cấp</th>
                  <th className="px-4 py-3">Ngày Đặt Hàng</th>
                  <th className="px-4 py-3">Hạn Giao Hàng</th>
                  <th className="px-4 py-3">Tổng Giá Trị (VAT)</th>
                  <th className="px-4 py-3">Trạng Thái PO</th>
                  <th className="px-4 py-3 text-right">Thao Tác Nhập Kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pos
                  .filter(
                    (p) =>
                      p.po_number.toLowerCase().includes(search.toLowerCase()) ||
                      p.supplier_name.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((po) => (
                    <tr key={po.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{po.po_number}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 font-mono text-[10px]">
                          {po.pr_code && <span className="text-amber-400">PR: {po.pr_code}</span>}
                          {po.rfq_code && <span className="text-purple-400">RFQ: {po.rfq_code}</span>}
                          {po.stock_in_vouchers && po.stock_in_vouchers.length > 0 && (
                            <span className="text-emerald-400 font-bold">
                              PN: {po.stock_in_vouchers.join(', ')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 max-w-xs truncate">
                        {po.supplier_name}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{po.order_date}</td>
                      <td className="px-4 py-3 text-zinc-500">{po.expected_delivery}</td>
                      <td className="px-4 py-3 font-bold text-amber-500">
                        {po.total_amount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getPOStatusBadge(po.status)}`}>
                          {po.status === 'DA_NHAP_KHO'
                            ? 'Đã Nhập Kho'
                            : po.status === 'DA_DUYET'
                            ? 'Đã Duyệt (Chờ Nhập)'
                            : po.status === 'DANG_GIAO'
                            ? 'Đang Vận Chuyển'
                            : 'Chờ Duyệt'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingPO(po)}
                            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                            title="Xem chi tiết đơn mua hàng"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {po.status === 'CHO_DUYET' && (
                            <button
                              onClick={() => handleApprovePO(po.id)}
                              className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 rounded-md text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              <span>Duyệt PO</span>
                            </button>
                          )}

                          {po.status !== 'DA_NHAP_KHO' && (
                            <button
                              onClick={() => handleCreateStockInFromPO(po)}
                              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-md text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                              title="Tự động điền dữ liệu PO vào Phiếu Nhập Kho"
                            >
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                              <span>Tạo Nhập Kho (1-Click)</span>
                            </button>
                          )}

                          {po.status === 'DA_NHAP_KHO' && (
                            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Hoàn Tất
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE PR MODAL */}
      {showCreatePRModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-500" />
              <span>Lập Yêu Cầu Mua Hàng Mới (PR)</span>
            </h3>

            <form onSubmit={handleCreatePR} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Phòng Ban Đề Xuất *
                </label>
                <select
                  value={newPR.department}
                  onChange={(e) => setNewPR({ ...newPR, department: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-semibold"
                >
                  <option value="Kế Toán & Hành Chính">Kế Toán & Hành Chính</option>
                  <option value="Kho Trung Tâm - Hà Nội">Kho Trung Tâm - Hà Nội</option>
                  <option value="Phòng Sản Xuất & Kỹ Thuật">Phòng Sản Xuất & Kỹ Thuật</option>
                  <option value="Phòng Kinh Doanh & Dự Án">Phòng Kinh Doanh & Dự Án</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Mức Độ Ưu Tiên
                  </label>
                  <select
                    value={newPR.priority}
                    onChange={(e: any) => setNewPR({ ...newPR, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="THUONG">Bình thường</option>
                    <option value="CAO">Ưu tiên cao</option>
                    <option value="KHAN_CAP">Khẩn cấp</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Số Lượng Đặt Mua
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newPR.items[0].quantity}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      const itemsUpdated = [...newPR.items];
                      itemsUpdated[0].quantity = qty;
                      setNewPR({ ...newPR, items: itemsUpdated });
                    }}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Lý Do / Mục Đích Mua Hàng *
                </label>
                <textarea
                  required
                  rows={2}
                  value={newPR.reason}
                  onChange={(e) => setNewPR({ ...newPR, reason: e.target.value })}
                  placeholder="Ví dụ: Bổ sung 100 ream giấy A4 phục vụ in ấn hóa đơn chứng từ Q3..."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreatePRModal(false)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg"
                >
                  Tạo Yêu Cầu PR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MANUAL PO MODAL */}
      {showCreatePOModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-500" />
              <span>Lập Đơn Mua Hàng Mới (PO)</span>
            </h3>

            <form onSubmit={handleCreateManualPO} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Tên Nhà Cung Cấp *
                </label>
                <input
                  type="text"
                  required
                  value={newPO.supplier_name}
                  onChange={(e) => setNewPO({ ...newPO, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Số Lượng Đặt Mua
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newPO.items[0].quantity}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      const itemsUpdated = [...newPO.items];
                      itemsUpdated[0].quantity = qty;
                      setNewPO({ ...newPO, items: itemsUpdated });
                    }}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Đơn Giá (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={newPO.items[0].unitPrice}
                    onChange={(e) => {
                      const prc = Number(e.target.value);
                      const itemsUpdated = [...newPO.items];
                      itemsUpdated[0].unitPrice = prc;
                      setNewPO({ ...newPO, items: itemsUpdated });
                    }}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Hạn Giao Hàng Dự Kiến
                </label>
                <input
                  type="date"
                  value={newPO.expected_delivery}
                  onChange={(e) => setNewPO({ ...newPO, expected_delivery: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreatePOModal(false)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg"
                >
                  Tạo Đơn PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS PR MODAL */}
      {viewingPR && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-xl w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                <span>Chi Tiết Yêu Cầu Mua Hàng ({viewingPR.code})</span>
              </h3>
              <button onClick={() => setViewingPR(null)} className="text-zinc-400 hover:text-zinc-100">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                <div>
                  <span className="text-zinc-500 block">Phòng ban:</span>
                  <span className="font-bold text-zinc-200">{viewingPR.department}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Người lập:</span>
                  <span className="font-bold text-zinc-200">{viewingPR.creator}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Ngày yêu cầu:</span>
                  <span className="text-zinc-300">{viewingPR.request_date}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Hạn cần hàng:</span>
                  <span className="text-zinc-300">{viewingPR.required_date}</span>
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-bold block mb-1">Lý do mua hàng:</span>
                <p className="text-zinc-200 bg-zinc-800/60 p-2 rounded">{viewingPR.reason}</p>
              </div>

              <div>
                <span className="text-zinc-400 font-bold block mb-1">Danh mục vật tư chi tiết:</span>
                <div className="space-y-1.5">
                  {viewingPR.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between p-2 rounded bg-zinc-800 text-zinc-200">
                      <div>
                        <span className="font-semibold block">{it.productName}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">SKU: {it.sku}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-400 block">
                          {it.quantity} {it.unit}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          ~ {it.estimatedUnitPrice.toLocaleString('vi-VN')} đ/{it.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                onClick={() => setViewingPR(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS PO MODAL */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-xl w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-400" />
                <span>Chi Tiết Đơn Mua Hàng ({viewingPO.po_number})</span>
              </h3>
              <button onClick={() => setViewingPO(null)} className="text-zinc-400 hover:text-zinc-100">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Nhà Cung Cấp:</span>
                  <span className="font-bold text-zinc-100">{viewingPO.supplier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">SĐT Liên hệ:</span>
                  <span className="text-zinc-300">{viewingPO.supplier_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Địa chỉ:</span>
                  <span className="text-zinc-300">{viewingPO.supplier_address}</span>
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-bold block mb-1">Chi tiết hàng hóa đặt mua:</span>
                <div className="space-y-1.5">
                  {viewingPO.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between p-2 rounded bg-zinc-800 text-zinc-200">
                      <div>
                        <span className="font-semibold block">{it.productName}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {it.quantity} {it.unit} x {it.unitPrice.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                      <span className="font-bold text-amber-400">
                        {it.subtotal.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-2 space-y-1 text-right">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tiền hàng trước thuế:</span>
                  <span className="font-semibold text-zinc-200">{viewingPO.subtotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Thuế GTGT (VAT):</span>
                  <span className="font-semibold text-zinc-200">{viewingPO.vat_amount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-zinc-800">
                  <span className="text-amber-400">TỔNG CỘNG THANH TOÁN:</span>
                  <span className="text-amber-400">{viewingPO.total_amount.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setViewingPO(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
              >
                Đóng
              </button>
              {viewingPO.status !== 'DA_NHAP_KHO' && (
                <button
                  onClick={() => {
                    const poToConvert = viewingPO;
                    setViewingPO(null);
                    handleCreateStockInFromPO(poToConvert);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1.5"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  <span>Chuyển Sang Nhập Kho</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSPurchasingPage;