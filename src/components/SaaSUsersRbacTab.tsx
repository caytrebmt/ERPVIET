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
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import client from '../api/client';

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
  { code: 'view', labelVi: 'Xem / Đọc', labelEn: 'View / Read', icon: '👁️' },
  { code: 'create', labelVi: 'Thêm mới', labelEn: 'Create', icon: '➕' },
  { code: 'edit', labelVi: 'Chỉnh sửa', labelEn: 'Edit', icon: '✏️' },
  { code: 'delete', labelVi: 'Xóa bớt', labelEn: 'Delete', icon: '🗑️' },
  { code: 'export', labelVi: 'Xuất PDF/Excel', labelEn: 'Export Data', icon: '📥' },
  { code: 'approve', labelVi: 'Phê duyệt / Khóa', labelEn: 'Approve / Lock', icon: '🛡️' },
];

export const SaaSUsersRbacTab: React.FC = () => {
  const { addToast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation();

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

  // Load users from the current tenant API.
  useEffect(() => {
    client.get('/api/saas/users')
      .then((res) => {
        if (!res.data?.ok) throw new Error(res.data?.message || 'Không tải được người dùng.');
        const items = res.data?.data || [];
        setUsersList(items.map((u: any) => ({
          id: String(u.id), username: u.username, fullName: u.full_name || u.username,
          email: u.email || '', phone: u.phone || '',
          department: (language === 'en' ? u.dept_name_en : u.dept_name_vi) || u.department_id || 'Chưa phân bổ',
          departmentId: u.dept_id ? String(u.dept_id) : '', roleId: String(u.role_id || 5),
          roleName: u.role_name_vi || u.role_name_en || 'Nhân Viên',
          status: u.status === 'locked' ? 'locked' : 'active',
          createdAt: u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : '', password: '',
        })));
      })
      .catch((err) => console.warn('Failed to fetch ERP users from backend:', err));
  }, [language]);

  // Load departments from the current tenant API.
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  useEffect(() => {
    client.get('/api/saas/departments')
      .then((res) => {
        if (!res.data?.ok) throw new Error(res.data?.message || 'Không tải được phòng ban.');
        setAllDepartments((res.data.data || []).map((d: any) => ({ id: String(d.id), code: d.code || '', nameVi: d.name_vi || '', nameEn: d.name_en || d.name_vi || '' })));
      })
      .catch((err) => console.warn('Failed to fetch departments:', err));
  }, []);

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
      language === 'en'
        ? `Password for ${name} copied to clipboard!`
        : `Đã sao chép mật khẩu của ${name} vào bộ nhớ tạm!`,
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
        addToast(language === 'en' ? 'Please enter a valid password' : 'Vui lòng nhập mật khẩu mới', 'error');
        return;
      }
      try {
        await client.put(`/api/shop/admin/customers/${resetWebshopTargetUser.id}/password`, {
          password: newResetPassword.trim(),
          email: resetWebshopTargetUser.email,
        });
      } catch (error: any) {
        addToast(error?.response?.data?.message || (language === 'en' ? 'Password reset failed' : 'Cấp lại mật khẩu thất bại'), 'error');
        return;
      }
      // The new password is never stored in React state or localStorage.
      addToast(
        language === 'en'
          ? `WebShop password for ${resetWebshopTargetUser.name} successfully reset!`
          : `Đã cấp lại mật khẩu WebShop cho ${resetWebshopTargetUser.name} thành công!`,
        'success'
      );
      setIsResetModalOpen(false);
      setResetWebshopTargetUser(null);
      return;
    }

    if (!resetTargetUser || !newResetPassword.trim()) {
      addToast(language === 'en' ? 'Please enter a valid password' : 'Vui lòng nhập mật khẩu mới', 'error');
      return;
    }

    try {
      await client.put(`/api/saas/users/${resetTargetUser.id}`, { password: newResetPassword.trim() });
      const updated = usersList.map((u) =>
        u.id === resetTargetUser.id ? { ...u, password: '' } : u
      );
      persistUsers(updated);
      addToast(
        language === 'en'
          ? `Password for ${resetTargetUser.fullName} successfully reset!`
          : `Đã cấp lại mật khẩu mới cho ${resetTargetUser.fullName} thành công!`,
        'success'
      );
    } catch (err: any) {
      addToast(err.response?.data?.message || (language === 'en' ? 'Password reset failed' : 'Cấp lại mật khẩu thất bại'), 'error');
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
    const defaultDept = allDepartments[0];
    setUserFormData({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      department: defaultDept ? (language === 'en' ? defaultDept.nameEn : defaultDept.nameVi) : '',
      departmentId: defaultDept ? defaultDept.id : '',
      roleId: 'sales_rep',
      password: '',
      status: 'active',
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
    });
    setShowModalPassword(false);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username || !userFormData.fullName || (!editingUserId && !userFormData.password.trim())) {
      addToast(
        language === 'en' ? 'Please enter username and full name' : 'Vui lòng nhập tên đăng nhập và họ tên',
        'error'
      );
      return;
    }

    const matchedRole = rolesList.find((r) => r.id === userFormData.roleId);
    const roleName = matchedRole ? (language === 'en' ? matchedRole.nameEn : matchedRole.nameVi) : userFormData.roleId;
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
          addToast(language === 'en' ? 'User profile updated!' : 'Đã cập nhật thông tin người dùng!', 'success');
        } else {
          addToast(res.data?.message || (language === 'en' ? 'Update failed' : 'Cập nhật thất bại'), 'error');
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
        });
        if (res.data?.ok) {
          const dbUser = res.data.data;
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
          };
          persistUsers([...usersList, newUser]);
          addToast(language === 'en' ? 'Added new user successfully!' : 'Đã thêm tài khoản người dùng mới thành công!', 'success');
        } else {
          addToast(res.data?.message || (language === 'en' ? 'Creation failed' : 'Tạo tài khoản thất bại'), 'error');
        }
      }
    } catch (err: any) {
      addToast(err.response?.data?.message || (language === 'en' ? 'Operation failed' : 'Thao tác thất bại'), 'error');
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
          ? language === 'en' ? `Account ${user.username} locked!` : `Đã khóa tài khoản ${user.username}!`
          : language === 'en' ? `Account ${user.username} unlocked!` : `Đã mở khóa tài khoản ${user.username}!`,
        'info'
      );
    } catch (err: any) {
      addToast(err.response?.data?.message || (language === 'en' ? 'Failed to update status' : 'Cập nhật trạng thái thất bại'), 'error');
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!window.confirm(language === 'en' ? `Are you sure you want to delete user ${name}?` : `Bạn có chắc chắn muốn xóa người dùng ${name}?`)) return;

    try {
      await client.delete(`/api/saas/users/${userId}`);
      const updated = usersList.filter((u) => u.id !== userId);
      persistUsers(updated);
      addToast(language === 'en' ? 'User deleted from system!' : 'Đã xóa người dùng khỏi hệ thống!', 'warning');
    } catch (err: any) {
      addToast(err.response?.data?.message || (language === 'en' ? 'Delete failed' : 'Xóa thất bại'), 'error');
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
      language === 'en'
        ? `Permission updated for role ${activeRoleObj.nameEn || activeRoleObj.nameVi}`
        : `Đã cập nhật ma trận phân quyền cho vai trò ${activeRoleObj.nameVi}`,
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
        ? language === 'en' ? `Granted all permissions for ${moduleCode}` : `Đã cấp tất cả quyền cho mô-đun ${moduleCode}`
        : language === 'en' ? `Revoked permissions for ${moduleCode}` : `Đã bỏ chọn tất cả quyền của mô-đun ${moduleCode}`,
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
      addToast(language === 'en' ? 'Please enter role name' : 'Vui lòng nhập tên vai trò mới', 'error');
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
    addToast(language === 'en' ? 'Created custom role successfully!' : 'Đã khởi tạo vai trò mới thành công!', 'success');
  };

  const handleDeleteRole = (roleId: string) => {
    const role = rolesList.find((r) => r.id === roleId);
    if (role?.isSystem) {
      addToast(language === 'en' ? 'Cannot delete system default roles!' : 'Không thể xóa vai trò mặc định của hệ thống!', 'error');
      return;
    }

    if (window.confirm(language === 'en' ? `Delete role ${role?.nameVi}?` : `Bạn có chắc muốn xóa vai trò ${role?.nameVi}?`)) {
      const updated = rolesList.filter((r) => r.id !== roleId);
      persistRoles(updated);
      setSelectedRoleId('admin');
      addToast(language === 'en' ? 'Role removed!' : 'Đã xóa vai trò khỏi danh sách!', 'warning');
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
    const fromApi = allDepartments.map((d) => language === 'en' ? d.nameEn : d.nameVi);
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
              {language === 'en'
                ? 'User Management & Role-Based Access Control (RBAC Matrix)'
                : 'Quản Trị Người Dùng & Ma Trận Phân Quyền Vai Trò (RBAC Matrix)'}
            </h2>
          </div>
          <p className="text-xs text-zinc-300 max-w-2xl">
            {language === 'en'
              ? 'Add users, manage accounts, define granular matrix permissions per system module (View, Create, Edit, Delete, Export, Approve).'
              : 'Thêm tài khoản, phân quyền ma trận phân chia chi tiết chức năng (Xem, Thêm, Sửa, Xóa, Xuất dữ liệu, Phê duyệt) theo từng vai trò & phòng ban.'}
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
            <span>{language === 'en' ? 'ERP Staff' : 'Nhân Viên ERP'} ({usersList.length})</span>
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
            <span>{language === 'en' ? 'WebShop Users' : 'Khách Hàng WebShop'} ({webshopUsers.length})</span>
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
            <span>{language === 'en' ? 'RBAC Permission Matrix' : 'Ma Trận Cấp Quyền RBAC'}</span>
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
                  placeholder={language === 'en' ? 'Search user, email or role...' : 'Tìm kiếm họ tên, email, vai trò...'}
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
                <option value="all">{language === 'en' ? 'All Departments' : 'Tất cả phòng ban'}</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenAddUser}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>{language === 'en' ? 'Add New User Account' : 'Thêm Tài Khoản Mới'}</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3.5 px-4">{language === 'en' ? 'User Profile' : 'Họ & Tên / Tài Khoản'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Department' : 'Phòng Ban'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Assigned Role' : 'Vai Trò RBAC'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Password' : 'Mật Khẩu (Password)'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Contact Info' : 'Liên Hệ'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Account Status' : 'Trạng Thái'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'en' ? 'Actions' : 'Thao Tác'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400">
                        {language === 'en' ? 'No users found matching filter.' : 'Không tìm thấy tài khoản người dùng nào phù hợp.'}
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
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{u.username}</div>
                              </div>
                            </div>
                          </td>

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
                                title={isPassVisible ? (language === 'en' ? 'Hide Password' : 'Ẩn mật khẩu') : (language === 'en' ? 'Show Password' : 'Xem mật khẩu')}
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
                                title={language === 'en' ? 'Copy Password' : 'Sao chép mật khẩu'}
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
                              <span>{isLocked ? (language === 'en' ? 'Locked' : 'Đã khóa') : (language === 'en' ? 'Active' : 'Hoạt động')}</span>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleOpenResetPasswordModal(u)}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
                              title={language === 'en' ? 'Reset / Reissue Password' : 'Cấp lại / Reset mật khẩu'}
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                              title={language === 'en' ? 'Edit Profile & Role' : 'Chỉnh sửa tài khoản & vai trò'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.fullName)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                              title={language === 'en' ? 'Delete User' : 'Xóa tài khoản'}
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
                  placeholder={language === 'en' ? 'Search WebShop customer name, phone, email...' : 'Tìm tên, SĐT, email khách WebShop...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="text-xs text-zinc-500 font-medium">
                {language === 'en' ? 'Total WebShop Accounts:' : 'Tổng số tài khoản WebShop:'}{' '}
                <span className="font-bold text-amber-600 dark:text-amber-400">{webshopUsers.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-700/80">
                  <tr>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Code / Type' : 'Mã / Phân Loại'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Customer Profile' : 'Tên Khách Hàng / Công Ty'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Contact Info' : 'Email / Số Điện Thoại'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'WebShop Password' : 'Mật Khẩu WebShop (Password)'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Credit / Debt' : 'Hạn Mức / Nợ Hiện Tại'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'en' ? 'Actions' : 'Thao Tác'}</th>
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
                            <div className="text-[11px] text-zinc-400 font-mono">MST: {w.taxCode}</div>
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
                                 title="Sao chép mật khẩu"
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
                              Nợ: {(w.currentDebt || 0).toLocaleString('vi-VN')} đ
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleOpenResetWebshopPasswordModal(w)}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
                              title="Cấp lại / Reset mật khẩu WebShop"
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
                              title="Xóa tài khoản WebShop"
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
                  {language === 'en' ? 'Select Target Role for Matrix Customization' : 'Chọn Vai Trò Để Cấu Hình Ma Trận Cấp Quyền'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {language === 'en'
                    ? 'Click checkboxes in the matrix table to instantly enable or revoke permissions per module and action.'
                    : 'Nhấp vào các ô tick trong bảng ma trận để bật/tắt tức thì các quyền Xem, Thêm, Sửa, Xóa, Xuất, Phê duyệt.'}
                </p>
              </div>

              <button
                onClick={() => setIsNewRoleModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-2xs flex items-center gap-1.5 transition cursor-pointer self-start md:self-auto"
              >
                <Plus className="w-4 h-4 text-amber-400 dark:text-amber-600" />
                <span>{language === 'en' ? 'Create Custom Role' : 'Thêm Vai Trò Tùy Chỉnh'}</span>
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
                      <span>{language === 'en' ? r.nameEn : r.nameVi}</span>
                      {r.isSystem && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-extrabold ${
                          isActive ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                        }`}>
                          SYS
                        </span>
                      )}
                    </button>
                    {!r.isSystem && (
                      <button
                        onClick={() => handleDeleteRole(r.id)}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow"
                        title="Xóa vai trò này"
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
                    {language === 'en' ? activeRoleObj.nameEn : activeRoleObj.nameVi}:
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
                        <span>{language === 'en' ? 'System Module / Service' : 'Mô-đun Chức Năng Hệ Thống'}</span>
                      </div>
                    </th>
                    {ACTION_CODES.map((act) => (
                      <th key={act.code} className="py-4 px-3 text-center w-28">
                        <button
                          onClick={() => handleToggleActionColumn(act.code)}
                          className="hover:text-amber-400 transition inline-flex flex-col items-center gap-0.5 group cursor-pointer"
                          title={`Toggle all ${act.labelVi}`}
                        >
                          <span className="text-sm">{act.icon}</span>
                          <span className="group-hover:underline">{language === 'en' ? act.labelEn : act.labelVi}</span>
                        </button>
                      </th>
                    ))}
                    <th className="py-4 px-4 text-center w-24">{language === 'en' ? 'Select All' : 'Tất cả'}</th>
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
                            {language === 'en' ? mod.nameEn : mod.nameVi}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">code: {mod.code}</div>
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
                                title={`${act.labelVi} - ${mod.nameVi}`}
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
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span> Quyền được phép (Allowed)
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-zinc-400">
                  <span className="w-3 h-3 rounded bg-zinc-300 dark:bg-zinc-700 inline-block"></span> Quyền bị chặn (Denied)
                </span>
              </div>
              <span className="font-mono text-[11px]">
                Matrix Sync Status: Active Realtime
              </span>
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
                  ? language === 'en' ? 'Edit User & Role Assignment' : 'Chỉnh Sửa Tài Khoản & Cấp Quyền'
                  : language === 'en' ? 'Add New Enterprise User Account' : 'Tạo Mới Tài Khoản Người Dùng Enterprise'}
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
                    Tên Đăng Nhập / Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    placeholder="vd: user@erpacc.vn"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Họ và Tên Nhân Viên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userFormData.fullName}
                    onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                    placeholder="vd: Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{language === 'en' ? 'Department' : 'Phòng Ban / Bộ Phận'}</label>
                  <select
                    value={userFormData.departmentId}
                    onChange={(e) => {
                      const selected = allDepartments.find((d) => d.id === e.target.value);
                      setUserFormData({
                        ...userFormData,
                        departmentId: e.target.value,
                        department: selected ? (language === 'en' ? selected.nameEn : selected.nameVi) : '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none font-semibold"
                    required
                  >
                    <option value="">{language === 'en' ? 'Select department' : 'Chọn phòng ban'}</option>
                    {allDepartments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {language === 'en' ? dept.nameEn : dept.nameVi}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="0988.xxx.xxx"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Role Select Dropdown */}
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Gán Vai Trò Phân Quyền (RBAC Role) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={userFormData.roleId}
                  onChange={(e) => setUserFormData({ ...userFormData, roleId: e.target.value })}
                  className="w-full px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl font-bold text-amber-900 dark:text-amber-200 focus:outline-none"
                >
                  {rolesList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {language === 'en' ? r.nameEn : r.nameVi} ({r.description.slice(0, 45)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Mật Khẩu Đăng Nhập</label>
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
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Trạng Thái Tài Khoản</label>
                  <select
                    value={userFormData.status}
                    onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 font-bold text-xs"
                  >
                    <option value="active">Hoạt động (Active)</option>
                    <option value="locked">Tạm khóa (Locked)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold"
                >
                  Hủy
                </button>
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
                Khởi Tạo Vai Trò Tùy Chỉnh (Custom RBAC Role)
              </h3>
              <button
                onClick={() => setIsNewRoleModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRole} className="space-y-3">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Tên Vai Trò (Tiếng Việt) *</label>
                <input
                  type="text"
                  placeholder="vd: Quản Lý Dự Án"
                  value={newRoleForm.nameVi}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, nameVi: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Role Name (English)</label>
                <input
                  type="text"
                  placeholder="vd: Project Director"
                  value={newRoleForm.nameEn}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Mô Tả Chức Năng</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả quyền hạn vai trò này..."
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
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Vai Trò & Đi Đến Matrix</span>
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
                  ? (language === 'en' ? 'Reissue / Reset WebShop Customer Password' : 'Cấp Lại / Reset Mật Khẩu Khách Hàng WebShop')
                  : (language === 'en' ? 'Reissue / Reset User Password' : 'Cấp Lại / Reset Mật Khẩu Người Dùng ERP')}
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
                  <>Email: {resetWebshopTargetUser.email} | SĐT: {resetWebshopTargetUser.phone}</>
                ) : (
                  <>{language === 'en' ? 'Dept' : 'Phòng ban'}: {resetTargetUser?.department} | {language === 'en' ? 'Role' : 'Vai trò'}: {resetTargetUser?.roleName}</>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    {language === 'en' ? 'New Reissued Password' : 'Mật Khẩu Mới Cấp Lại'} <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{language === 'en' ? 'Generate Random' : 'Tạo ngẫu nhiên'}</span>
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
                  {language === 'en' ? 'Cancel' : 'Hủy'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{language === 'en' ? 'Save & Reissue Password' : 'Lưu & Cấp Mật Khẩu Mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
