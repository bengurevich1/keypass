import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const actionLabels: Record<string, string> = {
  organization_created: 'ארגון נוצר',
  organization_updated: 'ארגון עודכן',
  organization_deactivated: 'ארגון הושבת',
  admin_created: 'מנהל נוסף',
  admin_updated: 'מנהל עודכן',
  admin_deactivated: 'מנהל הושבת',
  user_created: 'משתמש נוסף',
  user_revoked: 'משתמש בוטל',
  user_suspended: 'משתמש הושהה',
  user_activated: 'משתמש הופעל',
  door_created: 'דלת נוספה',
  door_updated: 'דלת עודכנה',
  door_deleted: 'דלת נמחקה',
  door_remote_unlock: 'פתיחת דלת מרחוק',
  permission_granted: 'הרשאה ניתנה',
  permission_revoked: 'הרשאה בוטלה',
  whatsapp_resent: 'WhatsApp נשלח מחדש',
};

export default function ActivityLog() {
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ['activity-log', page],
    queryFn: () => api.get('/super/activity-log', { params: { page, limit: 30 } }).then((r) => r.data),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">לוג פעילות</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">זמן</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">פעולה</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">סוג מבצע</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">יעד</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">פרטים</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((log: any) => (
              <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-500">
                  {log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss') : '—'}
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {actionLabels[log.action] || log.action}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {log.adminType === 'super_admin' ? 'מנהל על' : 'מנהל'}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">{log.targetType || '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {log.details ? JSON.stringify(log.details).slice(0, 60) : '—'}
                </td>
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">אין רשומות</td></tr>
            )}
          </tbody>
        </table>

        {data && data.total > 30 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">{data.total} רשומות</span>
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
