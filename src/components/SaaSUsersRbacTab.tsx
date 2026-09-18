import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Key,
  Check,
  X,
  Search,
  Filter,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  Shield,
  UserCheck,
  Building,
  Mail,
  Phone,
  Plus,
  Save,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSaaSAuth } from '../contexts/SaaSAuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import client from '../api/client';
import { pickLocalized } from '../utils/localized';

export interface Department {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
}

export interface SaasUserItem {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  departmentId?: string;
  roleId: string;
  roleName: string;
  status: 'active' | 'locked';
  createdAt: string;
  password?: string;
  companyId?: string;
  companyName?: string;
  customPermissions?: Record<string, boolean>; // Overrides
}

export interface ModulePermission {
  code: string;
  nameVi: string;
  nameEn: string;
  category: string;
}

export interface SystemRole {
  id: string;
  nameVi: string;
  nameEn: string;
  description: string;
  isSystem: boolean; // system default role cannot be deleted
  permissions: Record<string, boolean>; // key format: `${moduleCode}:${actionCode}` e.g. "products:create"
}

// Default Modules List
const SYSTEM_MODULES: ModulePermission[] = [
  { code: 'dashboard', nameVi: '1. Dashboard Tổng Quan & Thống Kê', nameEn: '1. Dashboard & Metrics', category: 'General' },
  { code: 'products', nameVi: '2. Danh Mục Hàng Hóa & Báo Giá', nameEn: '2. Products & Quotations', category: 'Commercial' },
  { code: 'stock_in_out', nameVi: '3. Nhập Kho & Xuất Kho', nameEn: '3. Stock In & Stock Out', category: 'Warehouse' },
  { code: 'stocktaking', nameVi: '4. Kiểm Kê & Cân Bằng Kho', nameEn: '4. Stocktaking & Discrepancies', category: 'Warehouse' },
  { code: 'debt_finance', nameVi: '5. Sổ Công Nợ & Thu Chi', nameEn: '5. Debt & Cashbook Finance', category: 'Finance' },
  { code: 'vat_accounting', nameVi: '6. Thuế GTGT & Sổ Kế Toán TT200', nameEn: '6. VAT Tax & TT200 Accounting', category: 'Finance' },
  { code: 'web_orders', nameVi: '7. Đơn Hàng WebShop Synchronized', nameEn: '7. WebShop Orders Sync', category: 'Sales' },
  { code: 'system_settings', nameVi: '8. Cài Đặt Hệ Thống & Doanh Nghiệp', nameEn: '8. System Settings & Enterprise', category: 'System' },
  { code: 'translations', nameVi: '9. Dịch Thuật 多語言 Multi-Language', nameEn: '9. Multi-Language Translations', category: 'System' },
  { code: 'users_rbac', nameVi: '10. Quản Trị Người Dùng & Matrix RBAC', nameEn: '10. User Management & Matrix RBAC', category: 'System' },
];

// Matrix Permission Action Codes
const ACTION_CODES = [
  { code: 'view', viCopy: 'Xem / Đọc', labelEn: 'View / Read', icon: '👁️' },
  { code: 'create', viCopy: 'Thêm mới', labelEn: 'Create', icon: '➕' },
  { code: 'edit', viCopy: 'Chỉnh sửa', labelEn: 'Edit', icon: '✏️' },
  { code: 'delete', viCopy: 'Xóa bớt', labelEn: 'Delete', icon: '🗑️' },
  { code: 'export', viCopy: 'Xuất PDF/Excel', labelEn: 'Export Data', icon: '📥' },
  { code: 'approve', viCopy: 'Phê duyệt / Khóa', labelEn: 'Approve / Lock', icon: '🛡️' },
];

export const SaaSUsersRbacTab: React.FC = () => {
  const { addToast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { erpUser } = useSaaSAuth();
  // The platform owner sees (and filters) users PER TENANT; a tenant admin
  // only ever manages the accounts inside his own company.
  const isSuperAdmin = !!erpUser?.is_super_admin;
  const [tenantOptions, setTenantOptions] = useState<Array<{ id: number; name: string }>>([]);
  // '' = chưa chọn; 'all' = mọi tenant (chỉ super admin); otherwise company id
  const [tenantFilter, setTenantFilter] = useState<string>('all');

  // Active view tab: 'users_list' | 'webshop_users' | 'roles_matrix'
  const [subTab, setSubTab] = useState<'users_list' | 'webshop_users' | 'roles_matrix'>('users_list');

  // WebShop customers are read from the current tenant API.
  const [webshopUsers, setWebshopUsers] = useState<any[]>([]);

  const persistWebshopUsers = (newList: any[]) => {
    setWebshopUsers(newList);
  };

  useEffect(() => {
    client.get('/api/shop/admin/customers')
      .then((res) => {
        if (!res.data?.ok) throw new Error(res.data?.message || 'Không tải được khách hàng WebShop.');
        const items = res.data?.data?.items || [];
        setWebshopUsers(items.map((it: any, idx: number) => ({
          id: it.id,
          code: `KH${String(it.id || idx + 1).padStart(3, '0')}`,
          name: it.name || it.email?.split('@')[0] || 'Khách hàng',
          phone: it.phone || '', email: it.email || '', taxCode: it.tax_code || '-',
          type: 'Khách lẻ', creditLimit: Number(it.credit_limit) || 0,
          currentDebt: Number(it.current_debt) || 0, password: '',
        })));
      })
      .catch((err) => console.warn('Failed to fetch webshop customers in RBAC tab:', err));
  }, []);

  // Passwords are never cached in localStorage; the API does not expose them.
  const [usersList, setUsersList] = useState<SaasUserItem[]>([]);

  // Load ERP user accounts. Tenant admins are scoped server-side to their own
  // company; the platform owner picks a tenant (or views all, grouped by
  // tenant) via the ?company_id= filter so businesses never get mixed up.
  const loadUsers = (companyFilter?: string) => {
    const query = isSuperAdmin && companyFilter && companyFilter !== 'all'
      ? `?company_id=${encodeURIComponent(companyFilter)}`
      : '';
    client.get(`/api/saas/users${query}`)
      .then((res) => {
        if (!res.data?.ok) throw new Error(res.data?.message || 'Không tải được ngường dùng.');
        const items = res.data?.data || [];
        setUsersList(items.map((u: any) => ({
          id: String(u.id), username: u.username, fullName: u.full_name || u.username,
          email: u.email || '', phone: u.phone || '',
          department: (pickLocalized(language === 'en', u.dept_name_en, u.dept_name_vi)) || u.department_id || 'Chưa phân bổ',
          departmentId: u.dept_id ? String(u.dept_id) : '', roleId: String(u.role_id || 5),
          roleName: u.role_name_vi || u.role_name_en || 'Nhân Viên',
          status: u.status === 'locked' ? 'locked' : 'active',
          createdAt: u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : '', password: '',
          companyId: u.company_id != null ? String(u.company_id) : '',
          companyName: u.company_name || '',
        })));
      })
      .catch((err) => console.warn('Failed to fetch ERP users from backend:', err));
  };

  useEffect(() => {
    loadUsers(tenantFilter);
  }, [language, tenantFilter, isSuperAdmin]);

  // Super admin: load the tenant list once for the filter + create-user form.
  useEffect(() => {
    if (!isSuperAdmin) return;
    client.get('/api/saas/tenants/list')
      .then((res) => {
        if (!res.data?.ok) return;
        setTenantOptions((res.data.data || []).map((c: any) => ({ id: Number(c.id), name: c.name_vi || c.code || `Tenant #${c.id}` })));
      })
      .catch((err) => console.warn('Failed to fetch tenant list for user management:', err));
  }, [isSuperAdmin]);

  // Departments belong to ONE tenant. When the super admin picks a company in
  // the user form, departments reload for exactly that company — assigning a
  // department of tenant A to a user of tenant B is rejected by the API too.
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const loadDepartments = (companyId?: string) => {
    const query = isSuperAdmin && companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    client.get(`/api/saas/departments${query}`)
      .then((res) => {
        if (!res.data?.ok) throw new Error(res.data?.message || 'Không tải được phòng ban.');
        setAllDepartments((res.data.data || []).map((d: any) => ({ id: String(d.id), code: d.code || '', nameVi: d.name_vi || '', nameEn: d.name_en || d.name_vi || '' })));
      })
      .catch((err) => console.warn('Failed to fetch departments:', err));
  };
  useEffect(() => {
    if (!isSuperAdmin) loadDepartments();
  }, [isSuperAdmin]);

  // Load role names and permissions from the database.
  const [rolesList, setRolesList] = useState<SystemRole[]>([]);
  useEffect(() => {
    client.get('/api/saas/roles')
      .then((res) => {
        if (!res.data?.ok) throw new Error(res.data?.message || 'Không tải được vai trò.');
        const roleIdMap: Record<string, string> = { ADMIN: 'admin', MANAGER: 'manager', ACCOUNTANT: 'accountant', WAREHOUSE: 'warehouse_keeper', SALES: 'sales_rep' };
        setRolesList((res.data.data || []).map((role: any) => ({
          id: roleIdMap[role.code] || String(role.code).toLowerCase(), nameVi: role.name || role.code,
          nameEn: role.name || role.code, description: role.description || '', isSystem: Boolean(role.is_system),
          permissions: Object.fromEntries((role.permissions || []).map((permission: string) => [permission, true])),
        })));
      })
      .catch((err) => console.warn('Failed to fetch roles:', err));
  }, []);

  // Selected Role for Matrix Editing
  const [selectedRoleId, setSelectedRoleId] = useState<string>('admin');

  // Search & Filter state for Users
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Password Eye View States in Table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Eye Toggle in Add/Edit User Modal
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Quick Password Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<SaasUserItem | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showResetPasswordEye, setShowResetPasswordEye] = useState(true);

  // User Add / Edit Modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    department: '',
    departmentId: '',
    roleId: 'sales_rep',
    password: '',
    status: 'active' as 'active' | 'locked',
    companyId: '' as string, // required when the platform owner creates a user
  });

  // New Role Modal State
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    id: '',
    nameVi: '',
    nameEn: '',
    description: '',
  });

  // Current selected Role Object for Matrix
  const activeRoleObj = useMemo(() => {
    return rolesList.find((r) => r.id === selectedRoleId) || rolesList[0];
  }, [rolesList, selectedRoleId]);

  const persistUsers = (newList: SaasUserItem[]) => {
    setUsersList(newList);
  };

  // Save Roles to Storage
  const persistRoles = (newList: SystemRole[]) => {
    setRolesList(newList);
  };

  // Password Helper Actions
  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleCopyPassword = (pass: string, name: string) => {
    navigator.clipboard.writeText(pass);
    addToast(
      t('da_sao_chep_mat_khau', 'Đã sao chép mật khẩu của {{name}} vào bộ nhớ tạm!', { name: name }),
      'success'
    );
  };

  const [resetWebshopTargetUser, setResetWebshopTargetUser] = useState<any | null>(null);

  const handleOpenResetPasswordModal = (user: SaasUserItem) => {
    setResetTargetUser(user);
    setResetWebshopTargetUser(null);
    setNewResetPassword('');
    setShowResetPasswordEye(true);
    setIsResetModalOpen(true);
  };

  const handleOpenResetWebshopPasswordModal = (user: any) => {
    setResetWebshopTargetUser(user);
    setResetTargetUser(null);
    setNewResetPassword('');
    setShowResetPasswordEye(true);
    setIsResetModalOpen(true);
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let rand = 'Erp#';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewResetPassword(rand);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetWebshopTargetUser) {
      if (!newResetPassword.trim()) {
        addToast(t('vui_long_nhap_mat_khau', 'Vui lòng nhập mật khẩu mới'), 'error');
        return;
      }
      try {
        await client.put(`/api/shop/admin/customers/${resetWebshopTargetUser.id}/password`, {
          password: newResetPassword.trim(),
          email: resetWebshopTargetUser.email,
        });
      } catch (error: any) {
        addToast(error?.response?.data?.message || (t('cap_lai_mat_khau_that', 'Cấp lại mật khẩu thất bại')), 'error');
        return;
      }
      // The new password is never stored in React state or localStorage.
      addToast(
        t('da_cap_lai_mat_khau', 'Đã cấp lại mật khẩu WebShop cho {{name}} thành công!', { name: resetWebshopTargetUser.name }),
        'success'
      );
      setIsResetModalOpen(false);
      setResetWebshopTargetUser(null);
      return;
    }

    if (!resetTargetUser || !newResetPassword.trim()) {
      addToast(t('vui_long_nhap_mat_khau', 'Vui lòng nhập mật khẩu mới'), 'error');
      return;
    }

    try {
      await client.put(`/api/saas/users/${resetTargetUser.id}`, { password: newResetPassword.trim() });
      const updated = usersList.map((u) =>
        u.id === resetTargetUser.id ? { ...u, password: '' } : u
      );
      persistUsers(updated);
      addToast(
        t('da_cap_lai_mat_khau_2', 'Đã cấp lại mật khẩu mới cho {{fullname}} thành công!', { fullname: resetTargetUser.fullName }),
        'success'
      );
    } catch (err: any) {
      addToast(err.response?.data?.message || (t('cap_lai_mat_khau_that', 'Cấp lại mật khẩu thất bại')), 'error');
    }
    setIsResetModalOpen(false);
    setResetTargetUser(null);
  };

  // Role ID mapping: frontend string ID -> backend numeric ID
  const mapRoleIdToBackend = (roleId: string): number => {
    const map: Record<string, number> = {
      'admin': 1,
      'manager': 2,
      'accountant': 3,
      'warehouse_keeper': 4,
      'sales_rep': 5,
    };
    return map[roleId] || 5;
  };

  // User Action Handlers
  const handleOpenAddUser = () => {
    setEditingUserId(null);
    // Super admin: pre-pick the tenant currently selected in the list filter
    // (still changeable); tenant admins always create inside their own tenant.
    const presetCompanyId = isSuperAdmin && tenantFilter !== 'all' ? tenantFilter : '';
    if (isSuperAdmin) {
      loadDepartments(presetCompanyId || undefined);
    }
    const defaultDept = presetCompanyId || !isSuperAdmin ? allDepartments[0] : undefined;
    setUserFormData({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      department: defaultDept ? (pickLocalized(language === 'en', defaultDept.nameEn, defaultDept.nameVi)) : '',
      departmentId: defaultDept ? defaultDept.id : '',
      roleId: 'sales_rep',
      password: '',
      status: 'active',
      companyId: presetCompanyId,
    });
    setShowModalPassword(false);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: SaasUserItem) => {
    setEditingUserId(user.id);
    setUserFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      department: user.department,
      departmentId: user.departmentId || '',
      roleId: user.roleId,
      password: '',
      status: user.status,
      companyId: user.companyId || '',
    });
    setShowModalPassword(false);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username || !userFormData.fullName || (!editingUserId && !userFormData.password.trim())) {
      addToast(
        t('vui_long_nhap_ten_dang', 'Vui lòng nhập tên đăng nhập và họ tên'),
        'error'
      );
      return;
    }
    // The platform owner must explicitly choose which business the new
    // account belongs to — otherwise the API rightfully rejects it
    // (TENANT_REQUIRED) to keep every tenant's staff list separated.
    if (!editingUserId && isSuperAdmin && !userFormData.companyId) {
      addToast(
        t('vui_long_chon_doanh_nghiep', 'Vui lòng chọn doanh nghiệp (tenant) cho tài khoản này'),
        'error'
      );
      return;
    }

    const matchedRole = rolesList.find((r) => r.id === userFormData.roleId);
    const roleName = matchedRole ? (pickLocalized(language === 'en', matchedRole.nameEn, matchedRole.nameVi)) : userFormData.roleId;
    const backendRoleId = mapRoleIdToBackend(userFormData.roleId);

    try {
      if (editingUserId) {
        const updatePayload: any = {
          username: userFormData.username,
          full_name: userFormData.fullName,
          email: userFormData.email || userFormData.username,
          phone: userFormData.phone,
          role_id: backendRoleId,
          status: userFormData.status,
          department_id: userFormData.departmentId || null,
        };
        
        // Only update password if a new plaintext password is provided
        const newPassword = userFormData.password?.trim();
        if (newPassword && !newPassword.startsWith('$2a$') && !newPassword.startsWith('$2b$')) {
          updatePayload.password = newPassword;
        }
        
        const res = await client.put(`/api/saas/users/${editingUserId}`, updatePayload);
        if (res.data?.ok) {
          const updated = usersList.map((u) =>
            u.id === editingUserId
              ? {
                  ...u,
                  username: userFormData.username,
                  fullName: userFormData.fullName,
                  email: userFormData.email || userFormData.username,
                  phone: userFormData.phone,
                   department: userFormData.department,
                   departmentId: userFormData.departmentId,
                  roleId: userFormData.roleId,
                  roleName,
                  status: userFormData.status,
                  password: newPassword && !newPassword.startsWith('$2a$') && !newPassword.startsWith('$2b$') ? newPassword : u.password,
                }
              : u
          );
          persistUsers(updated);
          addToast(t('da_cap_nhat_thong_tin', 'Đã cập nhật thông tin người dùng!'), 'success');
        } else {
          addToast(res.data?.message || (t('auth_profile_update_failed', 'Cập nhật thất bại')), 'error');
        }
      } else {
        const res = await client.post('/api/saas/users', {
          username: userFormData.username,
          full_name: userFormData.fullName,
          email: userFormData.email || userFormData.username,
          phone: userFormData.phone,
          role_id: backendRoleId,
          department_id: userFormData.departmentId || null,
          status: userFormData.status,
          password: userFormData.password,
          // Only meaningful for the platform owner; tenant admins are always
          // scoped to their own company server-side.
          company_id: userFormData.companyId ? Number(userFormData.companyId) : undefined,
        });
        if (res.data?.ok) {
          const dbUser = res.data.data;
          const chosenTenant = tenantOptions.find((tn) => String(tn.id) === String(userFormData.companyId));
          const newUser: SaasUserItem = {
            id: String(dbUser.id),
            username: dbUser.username,
            fullName: dbUser.full_name || userFormData.fullName,
            email: dbUser.email || '',
            phone: dbUser.phone || '',
            department: userFormData.department,
            departmentId: userFormData.departmentId,
            roleId: userFormData.roleId,
            roleName,
            status: dbUser.status === 'locked' ? 'locked' : 'active',
            password: userFormData.password,
            createdAt: dbUser.created_at ? new Date(dbUser.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            companyId: dbUser.company_id != null ? String(dbUser.company_id) : (userFormData.companyId || ''),
            companyName: chosenTenant?.name || '',
          };
          persistUsers([...usersList, newUser]);
          addToast(t('da_them_tai_khoan_nguoi', 'Đã thêm tài khoản người dùng mới thành công!'), 'success');
        } else {
          addToast(res.data?.message || (t('tao_tai_khoan_that_bai', 'Tạo tài khoản thất bại')), 'error');
        }
      }
    } catch (err: any) {
      addToast(err.response?.data?.message || (t('saas_tenants_thao_tac_that_bai', 'Thao tác thất bại')), 'error');
    }

    setIsUserModalOpen(false);
  };

  const handleToggleUserStatus = async (userId: string) => {
    const user = usersList.find((u) => u.id === userId);
    if (!user) return;
    const nextStatus: 'active' | 'locked' = user.status === 'active' ? 'locked' : 'active';

    try {
      await client.put(`/api/saas/users/${userId}`, { status: nextStatus });
      const updated = usersList.map((u) =>
        u.id === userId ? { ...u, status: nextStatus } : u
      );
      persistUsers(updated);
      addToast(
        nextStatus === 'locked'
          ? t('da_khoa_tai_khoan_account', 'Đã khóa tài khoản {{username}}!', { username: user.username })
          : t('da_mo_khoa_tai_khoan', 'Đã mở khóa tài khoản {{username}}!', { username: user.username }),
        'info'
      );
    } catch (err: any) {
      addToast(err.response?.data?.message || (t('cap_nhat_trang_thai_that', 'Cập nhật trạng thái thất bại')), 'error');
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!window.confirm(t('ban_co_chac_chan_muon_2', 'Bạn có chắc chắn muốn xóa người dùng {{name}}?', { name: name }))) return;

    try {
      await client.delete(`/api/saas/users/${userId}`);
      const updated = usersList.filter((u) => u.id !== userId);
      persistUsers(updated);
      addToast(t('da_xoa_nguoi_dung_khoi', 'Đã xóa người dùng khỏi hệ thống!'), 'warning');
    } catch (err: any) {
      addToast(err.response?.data?.message || (t('xoa_that_bai_delete_failed', 'Xóa thất bại')), 'error');
    }
  };

  // Matrix Permission Cell Toggle
  const handleToggleMatrixPermission = (moduleCode: string, actionCode: string) => {
    if (!activeRoleObj) return;

    const permKey = `${moduleCode}:${actionCode}`;
    const currentVal = !!activeRoleObj.permissions[permKey];
    const updatedPermissions = {
      ...activeRoleObj.permissions,
      [permKey]: !currentVal,
    };

    const updatedRoles = rolesList.map((r) =>
      r.id === activeRoleObj.id ? { ...r, permissions: updatedPermissions } : r
    );

    persistRoles(updatedRoles);
    addToast(
      t('da_cap_nhat_ma_tran', 'Đã cập nhật ma trận phân quyền cho vai trò {{namevi}}', { namevi: activeRoleObj.nameVi }),
      'info'
    );
  };

  // Toggle all permissions for a specific module row
  const handleToggleModuleRow = (moduleCode: string) => {
    if (!activeRoleObj) return;

    const allChecked = ACTION_CODES.every((act) => activeRoleObj.permissions[`${moduleCode}:${act.code}`]);
    const nextVal = !allChecked;

    const updatedPermissions = { ...activeRoleObj.permissions };
    ACTION_CODES.forEach((act) => {
      updatedPermissions[`${moduleCode}:${act.code}`] = nextVal;
    });

    const updatedRoles = rolesList.map((r) =>
      r.id === activeRoleObj.id ? { ...r, permissions: updatedPermissions } : r
    );

    persistRoles(updatedRoles);
    addToast(
      nextVal
        ? t('da_cap_tat_ca_quyen', 'Đã cấp tất cả quyền cho mô-đun {{modulecode}}', { modulecode: moduleCode })
        : t('da_bo_chon_tat_ca', 'Đã bỏ chọn tất cả quyền của mô-đun {{modulecode}}', { modulecode: moduleCode }),
      'info'
    );
  };

  // Toggle all permissions for a specific action column
  const handleToggleActionColumn = (actionCode: string) => {
    if (!activeRoleObj) return;

    const allChecked = SYSTEM_MODULES.every((mod) => activeRoleObj.permissions[`${mod.code}:${actionCode}`]);
    const nextVal = !allChecked;

    const updatedPermissions = { ...activeRoleObj.permissions };
    SYSTEM_MODULES.forEach((mod) => {
      updatedPermissions[`${mod.code}:${actionCode}`] = nextVal;
    });

    const updatedRoles = rolesList.map((r) =>
      r.id === activeRoleObj.id ? { ...r, permissions: updatedPermissions } : r
    );

    persistRoles(updatedRoles);
  };

  // Create Custom Role
  const handleCreateNewRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleForm.nameVi) {
      addToast(t('vui_long_nhap_ten_vai', 'Vui lòng nhập tên vai trò mới'), 'error');
      return;
    }

    const roleId = newRoleForm.id || `role_${Date.now()}`;
    const newRole: SystemRole = {
      id: roleId,
      nameVi: newRoleForm.nameVi,
      nameEn: newRoleForm.nameEn || newRoleForm.nameVi,
      description: newRoleForm.description || 'Vai trò tùy chỉnh quy trình doanh nghiệp',
      isSystem: false,
      permissions: SYSTEM_MODULES.reduce((acc, mod) => {
        acc[`${mod.code}:view`] = true; // Default view only
        return acc;
      }, {} as Record<string, boolean>),
    };

    persistRoles([...rolesList, newRole]);
    setSelectedRoleId(roleId);
    setIsNewRoleModalOpen(false);
    setNewRoleForm({ id: '', nameVi: '', nameEn: '', description: '' });
    addToast(t('da_khoi_tao_vai_tro', 'Đã khởi tạo vai trò mới thành công!'), 'success');
  };

  const handleDeleteRole = (roleId: string) => {
    const role = rolesList.find((r) => r.id === roleId);
    if (role?.isSystem) {
      addToast(t('khong_the_xoa_vai_tro', 'Không thể xóa vai trò mặc định của hệ thống!'), 'error');
      return;
    }

    if (window.confirm(t('ban_co_chac_muon_xoa_6', 'Bạn có chắc muốn xóa vai trò {{namevi}}?', { namevi: role?.nameVi }))) {
      const updated = rolesList.filter((r) => r.id !== roleId);
      persistRoles(updated);
      setSelectedRoleId('admin');
      addToast(t('da_xoa_vai_tro_khoi', 'Đã xóa vai trò khỏi danh sách!'), 'warning');
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.roleName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = departmentFilter === 'all' || u.department === departmentFilter;

      return matchesSearch && matchesDept;
    });
  }, [usersList, searchTerm, departmentFilter]);

  // Departments list for filter — merge API-fetched departments with any observed in user data
  const departments = useMemo(() => {
    const fromUsers = Array.from(new Set(usersList.map((u) => u.department || 'Ban Giám Đốc')));
    const fromApi = allDepartments.map((d) => pickLocalized(language === 'en', d.nameEn, d.nameVi));
    return Array.from(new Set([...fromApi, ...fromUsers]));
  }, [usersList, allDepartments, language]);

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:to-zinc-900 text-white rounded-2xl p-6 shadow-md border border-zinc-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <h2 className="text-lg font-black tracking-wide">
              {t('quan_tri_nguoi_dung_ma', 'Quản Trị Người Dùng & Ma Trận Phân Quyền Vai Trò (RBAC Matrix)')}
            </h2>
          </div>
          <p className="text-xs text-zinc-300 max-w-2xl">
            {t('them_tai_khoan_phan_quyen', 'Thêm tài khoản, phân quyền ma trận phân chia chi tiết chức năng (Xem, Thêm, Sửa, Xóa, Xuất dữ liệu, Phê duyệt) theo từng vai trò & phòng ban.')}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-800/80 p-1.5 rounded-xl border border-zinc-700">
          <button
            onClick={() => setSubTab('users_list')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              subTab === 'users_list'
                ? 'bg-amber-500 text-zinc-950 shadow-sm font-black'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{t('topbar_erp_staff', 'Nhân Viên ERP')} ({usersList.length})</span>
          </button>

          <button
            onClick={() => setSubTab('webshop_users')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              subTab === 'webshop_users'
                ? 'bg-amber-500 text-zinc-950 shadow-sm font-black'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <ShoppingBag className="h-4 w-4 text-amber-400" />
            <span>{t('khach_hang_webshop_webshop_users', 'Khách Hàng WebShop')} ({webshopUsers.length})</span>
          </button>

          <button
            onClick={() => setSubTab('roles_matrix')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              subTab === 'roles_matrix'
                ? 'bg-amber-500 text-zinc-950 shadow-sm font-black'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <Shield className="h-4 w-4 text-emerald-400" />
            <span>{t('ma_tran_cap_quyen_rbac', 'Ma Trận Cấp Quyền RBAC')}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUB-TAB 1: USERS DIRECTORY & MANAGEMENT                 */}
      {/* ======================================================== */}
      {subTab === 'users_list' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder={t('tim_kiem_ho_ten_email', 'Tìm kiếm họ tên, email, vai trò...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">{t('tat_ca_phong_ban_all', 'Tất cả phòng ban')}</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Platform owner: users are always managed PER TENANT. */}
              {isSuperAdmin && (
                <select
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-800 dark:text-emerald-200 focus:outline-none"
                  title={t('loc_nguong_dung_theo_doanh', 'Lọc ngường dùng theo doanh nghiệp (tenant)')}
                >
                  <option value="all">{t('tat_ca_doanh_nghiep_all', 'Tất cả doanh nghiệp')}</option>
                  {tenantOptions.map((tn) => (
                    <option key={tn.id} value={String(tn.id)}>
                      {tn.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={handleOpenAddUser}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t('add_user_account', 'Thêm Tài Khoản Mới')}</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3.5 px-4">{t('ho_ten_tai_khoan_user', 'Họ & Tên / Tài Khoản')}</th>
                    {isSuperAdmin && (
                      <th className="py-3.5 px-4">{t('doanh_nghiep_company', 'Doanh Nghiệp')}</th>
                    )}
                    <th className="py-3.5 px-4">{t('phong_ban_department', 'Phòng Ban')}</th>
                    <th className="py-3.5 px-4">{t('vai_tro_rbac_assigned_role', 'Vai Trò RBAC')}</th>
                    <th className="py-3.5 px-4">{t('mat_khau_password_password', 'Mật Khẩu (Password)')}</th>
                    <th className="py-3.5 px-4">{t('saas_customers_lien_he', 'Liên Hệ')}</th>
                    <th className="py-3.5 px-4">{t('status', 'Trạng Thái')}</th>
                    <th className="py-3.5 px-4 text-right">{t('actions', 'Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 8 : 7} className="py-8 text-center text-zinc-400">
                        {t('khong_tim_thay_tai_khoan', 'Không tìm thấy tài khoản người dùng nào phù hợp.')}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isLocked = u.status === 'locked';
                      const isPassVisible = !!visiblePasswords[u.id];
                      const isHashedPassword = !u.password;
                      const displayPass = isHashedPassword ? '••••••••' : (isPassVisible ? u.password : '••••••••');

                      return (
                        <tr key={u.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 font-black flex items-center justify-center text-xs shadow-2xs">
                                {u.fullName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                  <span>{u.fullName}</span>
                                  {u.roleId === 'admin' && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:amber-300">
                                      {t('admin', 'ADMIN')}</span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{u.username}</div>
                              </div>
                            </div>
                          </td>

                          {isSuperAdmin && (
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/60">
                                <Building className="w-3.5 h-3.5" />
                                {u.companyName || (u.companyId ? `Tenant #${u.companyId}` : '—')}
                              </span>
                            </td>
                          )}

                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700">
                              {u.department}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800/50">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {u.roleName}
                            </span>
                          </td>

                          {/* Eye View Password Column */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 w-max shadow-2xs">
                              <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="font-bold font-mono tracking-wide text-zinc-900 dark:text-zinc-100 text-[11px] min-w-[70px]">
                                {displayPass}
                              </span>
                              <button
                                onClick={() => {
                                  if (isHashedPassword) {
                                    addToast(t('webshop_password_encrypted'), 'info');
                                    return;
                                  }
                                  togglePasswordVisibility(u.id);
                                }}
                                className="p-1 text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
                                title={isPassVisible ? (t('an-mat-khau', 'Ẩn mật khẩu')) : (t('xem_mat_khau_show_password', 'Xem mật khẩu'))}
                              >
                                {isPassVisible && !isHashedPassword ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-500" />}
                              </button>
                              <button
                                onClick={() => {
                                  if (isHashedPassword) {
                                    addToast(t('webshop_password_encrypted'), 'info');
                                    return;
                                  }
                                  handleCopyPassword(u.password, u.fullName);
                                }}
                                className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
                                title={t('saas_customers_sao_chep_mat_khau', 'Sao chép mật khẩu')}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400 text-[11px]">
                            <div>{u.email}</div>
                            <div className="font-mono">{u.phone}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleUserStatus(u.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                isLocked
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              <span>{isLocked ? (t('da_khoa_locked', 'Đã khóa')) : (t('saas_categories_units_hoat_dong', 'Hoạt động'))}</span>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleOpenResetPasswordModal(u)}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
                              title={t('cap_lai_reset_mat_khau', 'Cấp lại / Reset mật khẩu')}
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                              title={t('chinh_sua_tai_khoan_vai', 'Chỉnh sửa tài khoản & vai trò')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.fullName)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                              title={t('xoa_tai_khoan_delete_user', 'Xóa tài khoản')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: WEBSHOP STOREFRONT USER ACCOUNTS               */}
      {/* ======================================================== */}
      {subTab === 'webshop_users' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder={t('tim_ten_sdt_email_khach', 'Tìm tên, SĐT, email khách WebShop...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="text-xs text-zinc-500 font-medium">
                {t('tong_so_tai_khoan_webshop', 'Tổng số tài khoản WebShop:')}{' '}
                <span className="font-bold text-amber-600 dark:text-amber-400">{webshopUsers.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-700/80">
                  <tr>
                    <th className="py-3.5 px-4">{t('ma_phan_loai_code_type', 'Mã / Phân Loại')}</th>
                    <th className="py-3.5 px-4">{t('ten_khach_hang_cong_ty', 'Tên Khách Hàng / Công Ty')}</th>
                    <th className="py-3.5 px-4">{t('email_so_dien_thoai_contact', 'Email / Số Điện Thoại')}</th>
                    <th className="py-3.5 px-4">{t('mat_khau_webshop_password_webshop', 'Mật Khẩu WebShop (Password)')}</th>
                    <th className="py-3.5 px-4">{t('han_muc_no_hien_tai', 'Hạn Mức / Nợ Hiện Tại')}</th>
                    <th className="py-3.5 px-4 text-right">{t('actions', 'Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                  {webshopUsers
                    .filter((w) => {
                      const matchSearch =
                        !searchTerm ||
                        w.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        w.phone?.includes(searchTerm) ||
                        w.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        w.code?.toLowerCase().includes(searchTerm.toLowerCase());
                      return matchSearch;
                    })
                    .map((w) => {
                      const isPassVisible = !!visiblePasswords[`web_${w.id}`];
                      const isHashedPassword = !w.password;
                      const displayPass = isHashedPassword ? '••••••••' : (isPassVisible ? w.password : '••••••••');

                      return (
                        <tr key={w.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{w.code}</div>
                            <span className="inline-block px-2 py-0.5 mt-1 text-[10px] rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                              {w.type}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">{w.name}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">{t('mst', 'MST:')}{w.taxCode}</div>
                          </td>

                          <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                            <div>{w.email}</div>
                            <div className="font-mono">{w.phone}</div>
                          </td>

                          {/* Password Eye View */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 w-max shadow-2xs">
                              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                               <span className="font-bold font-mono tracking-wide text-zinc-900 dark:text-zinc-100 text-[11px] min-w-[70px]">
                                 {displayPass}
                               </span>
                               <button
                                 onClick={() => {
                                    if (isHashedPassword) {
                                      addToast(t('webshop_password_encrypted'), 'info');
                                      return;
                                    }
                                   togglePasswordVisibility(`web_${w.id}`);
                                 }}
                                 className="p-1 text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
                                 title={isPassVisible ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                               >
                                 {isPassVisible && !isHashedPassword ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-500" />}
                               </button>
                               <button
                                 onClick={() => {
                                    if (isHashedPassword) {
                                      addToast(t('webshop_password_encrypted'), 'info');
                                      return;
                                    }
                                   handleCopyPassword(w.password, w.name);
                                 }}
                                 className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
                                 title={t('saas_customers_sao_chep_mat_khau', 'Sao chép mật khẩu')}
                               >
                                 <Copy className="w-3.5 h-3.5" />
                               </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">
                              {(w.creditLimit || 0).toLocaleString('vi-VN')} đ
                            </div>
                            <div className={`text-[11px] ${w.currentDebt > 0 ? 'text-rose-500 font-bold' : 'text-zinc-400'}`}>
                              {t('users_rbac_debt_label', 'Nợ:')} {(w.currentDebt || 0).toLocaleString('vi-VN')} đ
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleOpenResetWebshopPasswordModal(w)}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
                              title={t('cap_lai_reset_mat_khau_4', 'Cấp lại / Reset mật khẩu WebShop')}
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Bạn có chắc muốn xóa tài khoản WebShop "${w.name}"?`)) {
                                  persistWebshopUsers(webshopUsers.filter((item) => item.id !== w.id));
                                  addToast(`Đã xóa tài khoản WebShop ${w.name}`, 'warning');
                                }
                              }}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                              title={t('xoa_tai_khoan_webshop', 'Xóa tài khoản WebShop')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: RBAC MATRIX PERMISSIONS CONFIGURATION         */}
      {/* ======================================================== */}
      {subTab === 'roles_matrix' && (
        <div className="space-y-6">
          {/* Roles Selector & Matrix Controls */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-amber-500" />
                  {t('chon_vai_tro_de_cau', 'Chọn Vai Trò Để Cấu Hình Ma Trận Cấp Quyền')}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('nhap_vao_cac_o_tick', 'Nhấp vào các ô tick trong bảng ma trận để bật/tắt tức thì các quyền Xem, Thêm, Sửa, Xóa, Xuất, Phê duyệt.')}
                </p>
              </div>

              <button
                onClick={() => setIsNewRoleModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-2xs flex items-center gap-1.5 transition cursor-pointer self-start md:self-auto"
              >
                <Plus className="w-4 h-4 text-amber-400 dark:text-amber-600" />
                <span>{t('create_custom_role', 'Thêm Vai Trò Tùy Chỉnh')}</span>
              </button>
            </div>

            {/* Role Pills List */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {rolesList.map((r) => {
                const isActive = r.id === selectedRoleId;
                return (
                  <div key={r.id} className="relative group flex-shrink-0">
                    <button
                      onClick={() => setSelectedRoleId(r.id)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-zinc-950 shadow-md ring-2 ring-amber-500/50'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      <Shield className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-amber-500'}`} />
                      <span>{pickLocalized(language === 'en', r.nameEn, r.nameVi)}</span>
                      {r.isSystem && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-extrabold ${
                          isActive ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                        }`}>
                          {t('sys', 'SYS')}</span>
                      )}
                    </button>
                    {!r.isSystem && (
                      <button
                        onClick={() => handleDeleteRole(r.id)}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow"
                        title={t('xoa_vai_tro_nay', 'Xóa vai trò này')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Role Description Bar */}
            {activeRoleObj && (
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold mr-1.5">
                    {pickLocalized(language === 'en', activeRoleObj.nameEn, activeRoleObj.nameVi)}:
                  </span>
                  <span>{activeRoleObj.description}</span>
                </div>
              </div>
            )}
          </div>

          {/* Granular Permission Matrix Grid */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs space-y-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900 text-zinc-100 border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-4 px-5 w-1/3">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-amber-400" />
                        <span>{t('mo_dun_chuc_nang_he', 'Mô-đun Chức Năng Hệ Thống')}</span>
                      </div>
                    </th>
                    {ACTION_CODES.map((act) => (
                      <th key={act.code} className="py-4 px-3 text-center w-28">
                        <button
                          onClick={() => handleToggleActionColumn(act.code)}
                          className="hover:text-amber-400 transition inline-flex flex-col items-center gap-0.5 group cursor-pointer"
                          title={`Toggle all ${act.viCopy}`}
                        >
                          <span className="text-sm">{act.icon}</span>
                          <span className="group-hover:underline">{pickLocalized(language === 'en', act.labelEn, act.viCopy)}</span>
                        </button>
                      </th>
                    ))}
                    <th className="py-4 px-4 text-center w-24">{t('saas_inventory_tat_ca', 'Tất cả')}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                  {SYSTEM_MODULES.map((mod, idx) => {
                    const rowAllChecked = ACTION_CODES.every(
                      (act) => !!activeRoleObj?.permissions[`${mod.code}:${act.code}`]
                    );

                    return (
                      <tr
                        key={mod.code}
                        className={`${
                          idx % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50/50 dark:bg-zinc-800/30'
                        } hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition`}
                      >
                        {/* Module Name */}
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                            {pickLocalized(language === 'en', mod.nameEn, mod.nameVi)}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">{t('code', 'code:')}{mod.code}</div>
                        </td>

                        {/* Action Checkboxes */}
                        {ACTION_CODES.map((act) => {
                          const permKey = `${mod.code}:${act.code}`;
                          const isChecked = !!activeRoleObj?.permissions[permKey];

                          return (
                            <td key={act.code} className="py-3.5 px-3 text-center">
                              <button
                                onClick={() => handleToggleMatrixPermission(mod.code, act.code)}
                                className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-emerald-500 text-white shadow-xs scale-105 hover:bg-emerald-600'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                                title={`${act.viCopy} - ${mod.nameVi}`}
                              >
                                {isChecked ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-40" />}
                              </button>
                            </td>
                          );
                        })}

                        {/* Row Quick Select All */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleModuleRow(mod.code)}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              rowAllChecked
                                ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                            }`}
                            title={rowAllChecked ? 'Bỏ chọn toàn bộ dòng' : 'Chọn toàn bộ dòng này'}
                          >
                            {rowAllChecked ? <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Matrix Footer Note */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/80 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span> {t('quyen_duoc_phep_allowed', 'Quyền được phép (Allowed)')}</span>
                <span className="flex items-center gap-1.5 font-semibold text-zinc-400">
                  <span className="w-3 h-3 rounded bg-zinc-300 dark:bg-zinc-700 inline-block"></span> {t('quyen_bi_chan_denied', 'Quyền bị chặn (Denied)')}</span>
              </div>
              <span className="font-mono text-[11px]">
                {t('matrix_sync_status_active_realtime', 'Matrix Sync Status: Active Realtime')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT USER PROFILE & ASSIGN ROLE           */}
      {/* ======================================================== */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-500" />
                {editingUserId
                  ? t('chinh_sua_tai_khoan_cap', 'Chỉnh Sửa Tài Khoản & Cấp Quyền')
                  : t('tao_moi_tai_khoan_nguoi', 'Tạo Mới Tài Khoản Người Dùng Enterprise')}
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('ten_dang_nhap_email', 'Tên Đăng Nhập / Email')}<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    placeholder={t('vd_user_erpacc_vn', 'vd: user@erpacc.vn')}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('ho_va_ten_nhan_vien', 'Họ và Tên Nhân Viên')}<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userFormData.fullName}
                    onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                    placeholder={t('vd_nguyen_van_a', 'vd: Nguyễn Văn A')}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('phong_ban_bo_phan_department', 'Phòng Ban / Bộ Phận')}</label>
                  <select
                    value={userFormData.departmentId}
                    onChange={(e) => {
                      const selected = allDepartments.find((d) => d.id === e.target.value);
                      setUserFormData({
                        ...userFormData,
                        departmentId: e.target.value,
                        department: selected ? (pickLocalized(language === 'en', selected.nameEn, selected.nameVi)) : '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none font-semibold"
                    required
                  >
                    <option value="">{t('chon_phong_ban_select_department', 'Chọn phòng ban')}</option>
                    {allDepartments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {pickLocalized(language === 'en', dept.nameEn, dept.nameVi)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('saas_register_company_phone', 'Số Điện Thoại')}</label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="0988.xxx.xxx"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Company (tenant) selector — platform owner creating a user
                  must explicitly choose which business the account belongs to. */}
              {isSuperAdmin && !editingUserId && (
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('doanh_nghiep_tenant_company_tenant', 'Doanh Nghiệp (Tenant)')} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={userFormData.companyId}
                    onChange={(e) => {
                      const nextCompanyId = e.target.value;
                      // Departments are tenant-specific: reload them for the
                      // newly chosen company and clear the stale selection.
                      loadDepartments(nextCompanyId || undefined);
                      setUserFormData({ ...userFormData, companyId: nextCompanyId, departmentId: '', department: '' });
                    }}
                    className="w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold text-emerald-900 dark:text-emerald-200 focus:outline-none"
                    required
                  >
                    <option value="">{t('chon_doanh_nghiep_cho_tai', 'Chọn doanh nghiệp cho tài khoản')}</option>
                    {tenantOptions.map((tn) => (
                      <option key={tn.id} value={String(tn.id)}>
                        {tn.name} (#{tn.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {t('tai_khoan_chi_duoc_tao', 'Tài khoản chỉ được tạo trong tenant đã chọn — không trộn chung vào ERP của nền tảng.')}
                  </p>
                </div>
              )}

              {/* Role Select Dropdown */}
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('gan_vai_tro_phan_quyen', 'Gán Vai Trò Phân Quyền (RBAC Role)')}<span className="text-rose-500">*</span>
                </label>
                <select
                  value={userFormData.roleId}
                  onChange={(e) => setUserFormData({ ...userFormData, roleId: e.target.value })}
                  className="w-full px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl font-bold text-amber-900 dark:text-amber-200 focus:outline-none"
                >
                  {rolesList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {pickLocalized(language === 'en', r.nameEn, r.nameVi)} ({r.description.slice(0, 45)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('mat_khau_dang_nhap', 'Mật Khẩu Đăng Nhập')}</label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      placeholder={editingUserId ? 'Nhập mật khẩu mới (hoặc giữ nguyên)' : 'Nhập mật khẩu mới'}
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      className="w-full pl-3 pr-9 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-amber-500 transition cursor-pointer"
                      title={showModalPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showModalPassword ? <EyeOff className="w-4 h-4 text-rose-500" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('trang_thai_tai_khoan', 'Trạng Thái Tài Khoản')}</label>
                  <select
                    value={userFormData.status}
                    onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 font-bold text-xs"
                  >
                    <option value="active">{t('hoat_dong_active', 'Hoạt động (Active)')}</option>
                    <option value="locked">{t('tam_khoa_locked', 'Tạm khóa (Locked)')}</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold"
                >
                  {t('assets_cancel', 'Hủy')}</button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingUserId ? 'Lưu Thay Đổi' : 'Tạo Tài Khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CREATE CUSTOM ROLE                              */}
      {/* ======================================================== */}
      {isNewRoleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                {t('khoi_tao_vai_tro_tuy', 'Khởi Tạo Vai Trò Tùy Chỉnh (Custom RBAC Role)')}</h3>
              <button
                onClick={() => setIsNewRoleModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRole} className="space-y-3">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('ten_vai_tro_tieng_viet', 'Tên Vai Trò (Tiếng Việt) *')}</label>
                <input
                  type="text"
                  placeholder={t('vd_quan_ly_du_an', 'vd: Quản Lý Dự Án')}
                  value={newRoleForm.nameVi}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, nameVi: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('role_name_english', 'Role Name (English)')}</label>
                <input
                  type="text"
                  placeholder={t('vd_project_director', 'vd: Project Director')}
                  value={newRoleForm.nameEn}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('mo_ta_chuc_nang', 'Mô Tả Chức Năng')}</label>
                <textarea
                  rows={2}
                  placeholder={t('mo_ta_quyen_han_vai', 'Mô tả quyền hạn vai trò này...')}
                  value={newRoleForm.description}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold"
                >
                  {t('assets_cancel', 'Hủy')}</button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('tao_vai_tro_di_den', 'Tạo Vai Trò & Đi Đến Matrix')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL 3: REISSUE / RESET USER PASSWORD                   */}
      {/* ======================================================== */}
      {isResetModalOpen && (resetTargetUser || resetWebshopTargetUser) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                {resetWebshopTargetUser
                  ? (t('cap_lai_reset_mat_khau_2', 'Cấp Lại / Reset Mật Khẩu Khách Hàng WebShop'))
                  : (t('cap_lai_reset_mat_khau_3', 'Cấp Lại / Reset Mật Khẩu Người Dùng ERP'))}
              </h3>
              <button
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetTargetUser(null);
                  setResetWebshopTargetUser(null);
                }}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1 text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center justify-between">
                <span>{resetWebshopTargetUser ? resetWebshopTargetUser.name : resetTargetUser?.fullName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold">
                  {resetWebshopTargetUser ? resetWebshopTargetUser.code : resetTargetUser?.username}
                </span>
              </div>
              <div className="text-[11px] opacity-80">
                {resetWebshopTargetUser ? (
                  <>{t('email', 'Email:')}{resetWebshopTargetUser.email} {t('sdt_2', '| SĐT:')}{resetWebshopTargetUser.phone}</>
                ) : (
                  <>{t('phong_ban_department', 'Phòng ban')}: {resetTargetUser?.department} | {t('vai_tro_role', 'Vai trò')}: {resetTargetUser?.roleName}</>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    {t('mat_khau_moi_cap_lai', 'Mật Khẩu Mới Cấp Lại')} <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t('saas_customers_tao_ng_u_nhien', 'Tạo ngẫu nhiên')}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPasswordEye ? 'text' : 'password'}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 font-mono font-bold text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordEye(!showResetPasswordEye)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-amber-500 cursor-pointer"
                    title={showResetPasswordEye ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showResetPasswordEye ? <EyeOff className="w-4 h-4 text-rose-500" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  {t('assets_cancel', 'Hủy')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{t('luu_cap_mat_khau_moi', 'Lưu & Cấp Mật Khẩu Mới')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
