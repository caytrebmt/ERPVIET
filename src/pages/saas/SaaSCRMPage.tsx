import React, { useState } from 'react';
import {
  Users,
  Target,
  PhoneCall,
  Mail,
  Building,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Briefcase,
  Calendar,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

interface Lead {
  id: number;
  lead_code: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
  source: string;
  estimated_value: number;
  created_at: string;
}

const MOCK_LEADS: Lead[] = [
  {
    id: 1,
    lead_code: 'LEAD-2026-001',
    contact_name: 'Nguyễn Văn Minh',
    company_name: 'Công ty TNHH Bách Hóa Xanh',
    email: 'minh.nguyen@bachhoa.vn',
    phone: '0901234567',
    status: 'PROPOSAL',
    source: 'Website Form',
    estimated_value: 250000000,
    created_at: '2026-07-28',
  },
  {
    id: 2,
    lead_code: 'LEAD-2026-002',
    contact_name: 'Trần Thị Thu Hà',
    company_name: 'Tập Đoàn Thương Mại An Phú',
    email: 'ha.tran@anphugroup.com',
    phone: '0918765432',
    status: 'QUALIFIED',
    source: 'Giới thiệu đối tác',
    estimated_value: 480000000,
    created_at: '2026-07-30',
  },
  {
    id: 3,
    lead_code: 'LEAD-2026-003',
    contact_name: 'Lê Hoàng Nam',
    company_name: 'Chuỗi Cửa Hàng Tiện Lợi MartPlus',
    email: 'nam.le@martplus.vn',
    phone: '0933112233',
    status: 'NEW',
    source: 'Sự kiện Triển lãm',
    estimated_value: 120000000,
    created_at: '2026-08-01',
  },
  {
    id: 4,
    lead_code: 'LEAD-2026-004',
    contact_name: 'Phạm Đức Anh',
    company_name: 'Công Ty Logistics Toàn Cầu',
    email: 'anh.pham@globallogistics.vn',
    phone: '0988990011',
    status: 'WON',
    source: 'Hotline Direct',
    estimated_value: 650000000,
    created_at: '2026-07-15',
  },
];

export const SaaSCRMPage: React.FC = () => {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isEn = language === 'en';

  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newLead, setNewLead] = useState({
    contact_name: '',
    company_name: '',
    email: '',
    phone: '',
    status: 'NEW' as const,
    source: 'Website',
    estimated_value: 0,
  });

  const filteredLeads = leads.filter((item) => {
    const matchesSearch =
      item.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      item.company_name.toLowerCase().includes(search.toLowerCase()) ||
      item.lead_code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.contact_name || !newLead.phone) {
      showToast(
        isEn ? 'Please fill contact name and phone number' : 'Vui lòng điền tên người liên hệ và SĐT',
        'error'
      );
      return;
    }

    const created: Lead = {
      id: Date.now(),
      lead_code: `LEAD-2026-00${leads.length + 1}`,
      ...newLead,
      created_at: new Date().toISOString().split('T')[0],
    };

    setLeads([created, ...leads]);
    setShowAddModal(false);
    setNewLead({
      contact_name: '',
      company_name: '',
      email: '',
      phone: '',
      status: 'NEW',
      source: 'Website',
      estimated_value: 0,
    });
    showToast(isEn ? 'Created CRM Lead successfully' : 'Tạo Lead CRM thành công!', 'success');
  };

  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'CONTACTED':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'QUALIFIED':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'PROPOSAL':
        return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'WON':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'LOST':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const totalPipelineValue = leads.reduce((acc, curr) => acc + curr.estimated_value, 0);

  return (
    <div className="space-y-6">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isEn ? 'Total Leads' : 'Tổng Cơ Hội Kinh Doanh'}
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{leads.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isEn ? 'Pipeline Value' : 'Giá Trị Tiềm Năng (Pipeline)'}
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalPipelineValue.toLocaleString('vi-VN')} đ
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isEn ? 'Won Deals' : 'Hợp Đồng Đã Chốt (WON)'}
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {leads.filter((l) => l.status === 'WON').length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isEn ? 'Conversion Rate' : 'Tỷ Lệ Chuyển Đổi'}
            </p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {leads.length ? Math.round((leads.filter((l) => l.status === 'WON').length / leads.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Control Actions Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEn ? 'Search leads, company, code...' : 'Tìm kiếm Lead, Công ty, Mã...'}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
          >
            <option value="ALL">{isEn ? 'All Statuses' : 'Tất cả Trạng thái'}</option>
            <option value="NEW">NEW (Mới tạo)</option>
            <option value="CONTACTED">CONTACTED (Đã liên hệ)</option>
            <option value="QUALIFIED">QUALIFIED (Đánh giá tiềm năng)</option>
            <option value="PROPOSAL">PROPOSAL (Đã gửi Báo giá)</option>
            <option value="WON">WON (Đã chốt HD)</option>
            <option value="LOST">LOST (Hủy/Thất bại)</option>
          </select>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>{isEn ? 'Add CRM Lead' : 'Thêm Lead Mới'}</span>
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Lead Code' : 'Mã Lead'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Contact / Company' : 'Liên Hệ / Công Ty'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Phone / Email' : 'SĐT / Email'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Estimated Value' : 'Giá Trị Dụ Kiến'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Source' : 'Nguồn Tiềm Năng'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Status' : 'Trạng Thái'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Date' : 'Ngày Tạo'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredLeads.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-amber-600 dark:text-amber-400">
                    {item.lead_code}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{item.contact_name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Building className="h-3 w-3" />
                      <span>{item.company_name || 'Khách hàng cá nhân'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                      <PhoneCall className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{item.phone}</span>
                    </div>
                    {item.email && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" />
                        <span>{item.email}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.estimated_value.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs">
                      {item.source}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">{item.created_at}</td>
                </tr>
              ))}

              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {isEn ? 'No CRM Leads match your query.' : 'Không tìm thấy dữ liệu Lead CRM.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              <span>{isEn ? 'Create CRM Lead' : 'Thêm Lead Khách Hàng CRM'}</span>
            </h3>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {isEn ? 'Contact Person Name *' : 'Tên Người Liên Hệ *'}
                </label>
                <input
                  type="text"
                  required
                  value={newLead.contact_name}
                  onChange={(e) => setNewLead({ ...newLead, contact_name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {isEn ? 'Company Name' : 'Tên Tên Công Ty / Doanh Nghiệp'}
                </label>
                <input
                  type="text"
                  value={newLead.company_name}
                  onChange={(e) => setNewLead({ ...newLead, company_name: e.target.value })}
                  placeholder="Ví dụ: Công ty TNHH Thương Mại ABC"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {isEn ? 'Phone *' : 'Số Điện Thoại *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="0912345678"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="example@domain.vn"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {isEn ? 'Estimated Value (VND)' : 'Giá Trị Dự Kiến (VNĐ)'}
                  </label>
                  <input
                    type="number"
                    value={newLead.estimated_value}
                    onChange={(e) => setNewLead({ ...newLead, estimated_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {isEn ? 'Source' : 'Nguồn Nguồn Tiềm Năng'}
                  </label>
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="Website">Website Form</option>
                    <option value="Hotline">Hotline / Zalo</option>
                    <option value="Event">Triển Lãm / Event</option>
                    <option value="Referral">Người quen Giới thiệu</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm"
                >
                  {isEn ? 'Cancel' : 'Hủy bỏ'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium rounded-lg text-sm"
                >
                  {isEn ? 'Save Lead' : 'Lưu Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSCRMPage;
