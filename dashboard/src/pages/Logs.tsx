import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const actionLabels: Record<string, { label: string; color: string }> = {
  unlock: { label: 'נפתח', color: 'text-green-600' },
  denied: { label: 'נדחה', color: 'text-red-600' },
  remote_unlock: { label: 'פתיחה מרחוק', color: 'text-blue-600' },
  error: { label: 'שגיאה', color: 'text-orange-600' },
};

const methodLabels: Record<string, string> = {
  nfc: 'NFC',
  nfc_mock: 'NFC (סימולציה)',
  ble: 'BLE',
  remote: 'מרחוק',
  button: 'כפתור',
};

export default function Logs() {
  const [page, setPage] = useState(1);
  const [doorFilter, setDoorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: doors } = useQuery({
    queryKey: ['doors'],
    queryFn: () => api.get('/admin/doors').then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['logs', page, doorFilter, actionFilter],
    queryFn: () =>
      api.get('/admin/logs', {
        params: {
          page,
          limit: 30,
          door_id: doorFilter || undefined,
          action: actionFilter || undefined,
        },
      }).then((r) => r.data),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">לוג כניסות</h1>
        <button
          onClick={() => window.open('/api/admin/logs/export', '_blank')}
          className="flex items-center gap-2 px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 self-start"
        >
          <Download className="w-4 h-4" />
          ייצוא CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <select
          value={doorFilter}
          onChange={(e) => { setDoorFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">כל הדלתות</option>
          {doors?.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">כל הפעולות</option>
          <option value="unlock">נפתח</option>
          <option value="denied">נדחה</option>
          <option value="remote_unlock">פתיחה מרחוק</option>
          <option value="error">שגיאה</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">זמן</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">משתמש</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">דלת</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">שיטה</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((log: any) => {
              const action = actionLabels[log.action] || { label: log.action, color: 'text-gray-600' };
              return (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss') : '—'}
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{log.userName || 'לא ידוע'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{log.doorName || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{methodLabels[log.method] || log.method || '—'}</td>
                  <td className={`px-6 py-3 text-sm font-medium ${action.color}`}>{action.label}</td>
                </tr>
              );
            })}
            {isLoading && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">טוען...</td></tr>
            )}
            {!isLoading && (!data?.data || data.data.length === 0) && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">אין רשומות</td></tr>
            )}
          </tbody>
        </table>
        </div>

        {data && data.total > 30 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {data.total} רשומות | עמוד {page}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 30 >= data.total}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
