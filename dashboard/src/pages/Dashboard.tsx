import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import KPICard from '../components/KPICard';
import { Users, UserCheck, DoorOpen, Wifi, Activity, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data),
  });

  useSocket((event) => {
    if (['access:new_log', 'door:status_changed', 'user:status_changed'].includes(event)) {
      refetch();
    }
  });

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">שלום, {user?.name}</h1>
        <p className="text-gray-500">{user?.orgName}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KPICard
          title="סה״כ משתמשים"
          value={stats?.totalUsers || 0}
          icon={<Users className="w-5 h-5" />}
          color="primary"
        />
        <KPICard
          title="משתמשים פעילים"
          value={stats?.activeUsers || 0}
          icon={<UserCheck className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="דלתות מחוברות"
          value={`${stats?.onlineDoors || 0}/${stats?.totalDoors || 0}`}
          icon={<Wifi className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="כניסות היום"
          value={stats?.accessesToday || 0}
          icon={<Activity className="w-5 h-5" />}
          color="purple"
        />
        <KPICard
          title="ממתינים לרישום"
          value={stats?.pendingRegistrations || 0}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
        />
      </div>

      {/* Recent Access Logs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">כניסות אחרונות</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">זמן</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">משתמש</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">דלת</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">שיטה</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentLogs?.map((log: any) => {
                const action = actionLabels[log.action] || { label: log.action, color: 'text-gray-600' };
                return (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.timestamp ? format(new Date(log.timestamp), 'HH:mm dd/MM', { locale: he }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.userName || 'לא ידוע'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.doorName || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{methodLabels[log.method] || log.method || '—'}</td>
                    <td className={`px-6 py-4 text-sm font-medium ${action.color}`}>{action.label}</td>
                  </tr>
                );
              })}
              {(!stats?.recentLogs || stats.recentLogs.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">אין כניסות אחרונות</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
