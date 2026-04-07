import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { ArrowRight, Plus, X } from 'lucide-react';
import { format } from 'date-fns';

export default function OrgDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'admins' | 'doors' | 'users' | 'logs'>('overview');
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', name: '', phone: '' });

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => api.get(`/super/organizations/${id}`).then((r) => r.data),
  });

  const createAdminMutation = useMutation({
    mutationFn: (data: typeof adminForm) => api.post(`/super/organizations/${id}/admins`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      setShowAddAdmin(false);
      setAdminForm({ email: '', password: '', name: '', phone: '' });
    },
  });

  if (isLoading) return <div className="text-center py-8 text-gray-500">טוען...</div>;
  if (!org) return <div className="text-center py-8 text-gray-500">ארגון לא נמצא</div>;

  const tabs = [
    { key: 'overview', label: 'סקירה' },
    { key: 'admins', label: 'מנהלים' },
    { key: 'doors', label: 'דלתות' },
    { key: 'users', label: 'משתמשים' },
    { key: 'logs', label: 'לוגים' },
  ] as const;

  return (
    <div>
      <button onClick={() => navigate('/organizations')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowRight className="w-4 h-4" /> חזרה לארגונים
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{org.name}</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">{org.address}</p>
          </div>
          <span className={`self-start px-3 py-1 rounded-full text-sm font-medium ${org.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {org.isActive ? 'פעיל' : 'מושבת'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 min-w-[80px] py-2.5 min-h-[44px] text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">פרטים</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">תוכנית:</span> <span className="font-medium">{org.plan}</span></div>
              <div><span className="text-gray-500">מנוי חודשי:</span> <span className="font-medium">₪{org.monthlyFee?.toLocaleString()}</span></div>
              <div><span className="text-gray-500">איש קשר:</span> <span className="font-medium">{org.contactName || '—'}</span></div>
              <div><span className="text-gray-500">טלפון:</span> <span className="font-medium" dir="ltr">{org.contactPhone || '—'}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">סטטיסטיקות</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">משתמשים:</span> <span className="font-bold text-lg">{org.userCount}</span></div>
              <div><span className="text-gray-500">דלתות:</span> <span className="font-bold text-lg">{org.doors?.length || 0}</span></div>
              <div><span className="text-gray-500">מנהלים:</span> <span className="font-bold text-lg">{org.admins?.length || 0}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">הערות פנימיות</h3>
            <p className="text-sm text-gray-600">{org.notes || 'אין הערות'}</p>
          </div>
        </div>
      )}

      {/* Admins Tab */}
      {tab === 'admins' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-b border-gray-100">
            <h2 className="text-base sm:text-lg font-semibold">מנהלים</h2>
            <button onClick={() => setShowAddAdmin(true)}
              className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm self-start">
              <Plus className="w-4 h-4" /> הוסף מנהל
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">שם</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">אימייל</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">תפקיד</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">התחברות אחרונה</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {org.admins?.map((admin: any) => (
                <tr key={admin.id} className="border-b border-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{admin.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600" dir="ltr">{admin.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{admin.role === 'admin' ? 'מנהל' : 'צופה'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {admin.lastLoginAt ? format(new Date(admin.lastLoginAt), 'dd/MM/yyyy HH:mm') : 'טרם התחבר'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {admin.isActive ? 'פעיל' : 'מושבת'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Doors Tab */}
      {tab === 'doors' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h2 className="text-base sm:text-lg font-semibold">דלתות</h2>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">שם</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">מזהה מכשיר</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">קושחה</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {org.doors?.map((door: any) => (
                <tr key={door.id} className="border-b border-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{door.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600" dir="ltr">{door.espDeviceId || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{door.firmwareVersion || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 text-sm ${door.isOnline ? 'text-green-600' : 'text-red-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${door.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                      {door.isOnline ? 'מחובר' : 'מנותק'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          צפייה במשתמשים זמינה דרך דשבורד המנהל
        </div>
      )}

      {/* Logs Tab */}
      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          צפייה בלוגים זמינה דרך דשבורד המנהל
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setShowAddAdmin(false)}>
          <div className="bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">הוספת מנהל</h2>
              <button onClick={() => setShowAddAdmin(false)} className="p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createAdminMutation.mutate(adminForm); }} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם *</label>
                <input type="text" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל *</label>
                <input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none" required dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה *</label>
                <input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none" required minLength={6} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input type="tel" value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none" dir="ltr" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddAdmin(false)}
                  className="flex-1 px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">ביטול</button>
                <button type="submit" disabled={createAdminMutation.isPending}
                  className="flex-1 px-4 py-3 min-h-[44px] bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                  {createAdminMutation.isPending ? 'יוצר...' : 'הוסף מנהל'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
