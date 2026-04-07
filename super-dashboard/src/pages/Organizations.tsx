import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Plus, Search, X } from 'lucide-react';

const planLabels: Record<string, { label: string; color: string }> = {
  trial: { label: 'ניסיון', color: 'bg-yellow-100 text-yellow-700' },
  standard: { label: 'רגיל', color: 'bg-blue-100 text-blue-700' },
  premium: { label: 'פרימיום', color: 'bg-purple-100 text-purple-700' },
};

export default function Organizations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', address: '', contactName: '', contactPhone: '', plan: 'standard', monthlyFee: 1000 });

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get('/super/organizations').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/super/organizations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setShowCreate(false);
      setForm({ name: '', address: '', contactName: '', contactPhone: '', plan: 'standard', monthlyFee: 1000 });
    },
  });

  const filtered = orgs?.filter((o: any) =>
    !search || o.name.includes(search) || o.address?.includes(search)
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">ארגונים</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm self-start">
          <Plus className="w-4 h-4" /> ארגון חדש
        </button>
      </div>

      <div className="relative sm:max-w-md mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש ארגון..."
          className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">שם</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">כתובת</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">תוכנית</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">משתמשים</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">דלתות</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">מנויים</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((org: any) => {
              const plan = planLabels[org.plan] || { label: org.plan, color: 'bg-gray-100 text-gray-700' };
              return (
                <tr key={org.id} onClick={() => navigate(`/organizations/${org.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{org.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{org.address || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${plan.color}`}>{plan.label}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{org.userCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{org.doorCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">₪{org.monthlyFee?.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${org.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {org.isActive ? 'פעיל' : 'מושבת'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-lg sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">ארגון חדש</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם הארגון *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">איש קשר</label>
                  <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                  <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תוכנית</label>
                  <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500">
                    <option value="trial">ניסיון</option>
                    <option value="standard">רגיל</option>
                    <option value="premium">פרימיום</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מנוי חודשי (₪)</label>
                  <input type="number" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" dir="ltr" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">ביטול</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 px-4 py-3 min-h-[44px] bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                  {createMutation.isPending ? 'יוצר...' : 'צור ארגון'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
