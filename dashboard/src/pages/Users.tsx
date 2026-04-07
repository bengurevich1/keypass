import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import AddUserModal from '../components/AddUserModal';
import { Plus, Search, Download, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'פעיל ✓', color: 'bg-green-100 text-green-700' },
  pending: { label: 'ממתין', color: 'bg-yellow-100 text-yellow-700' },
  suspended: { label: 'מושהה', color: 'bg-orange-100 text-orange-700' },
  revoked: { label: 'בוטל', color: 'bg-red-100 text-red-700' },
};

export default function Users() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, statusFilter],
    queryFn: () =>
      api.get('/admin/users', {
        params: { page, limit: 20, search: search || undefined, status: statusFilter || undefined },
      }).then((r) => r.data),
  });

  const handleExport = () => {
    window.open('/api/admin/users/export', '_blank');
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">משתמשים</h1>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            ייצוא
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            הוסף משתמש
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="חיפוש לפי שם, טלפון או דירה..."
            className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="pending">ממתין</option>
          <option value="suspended">מושהה</option>
          <option value="revoked">בוטל</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">שם</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">טלפון</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">דירה</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">דלתות</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">סטטוס</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">כניסה אחרונה</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((user: any) => {
              const status = statusLabels[user.status] || { label: user.status, color: 'bg-gray-100 text-gray-700' };
              return (
                <tr
                  key={user.id}
                  onClick={() => navigate(`/users/${user.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600" dir="ltr">{user.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.apartment || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {user.doors?.map((d: any) => d.doorName).join(', ') || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.lastAccess ? format(new Date(user.lastAccess), 'dd/MM HH:mm') : '—'}
                  </td>
                </tr>
              );
            })}
            {isLoading && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">טוען...</td></tr>
            )}
            {!isLoading && (!data?.data || data.data.length === 0) && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">לא נמצאו משתמשים</td></tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {data.total} משתמשים | עמוד {page} מתוך {Math.ceil(data.total / 20)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= data.total}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddUserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
