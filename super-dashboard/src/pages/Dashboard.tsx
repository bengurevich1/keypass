import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { Building2, Users, DoorOpen, Wifi, Activity, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, refetch } = useQuery({
    queryKey: ['super-dashboard'],
    queryFn: () => api.get('/super/dashboard').then((r) => r.data),
  });

  useSocket(() => refetch());

  const kpis = [
    { label: 'ארגונים', value: stats?.totalOrgs || 0, icon: <Building2 className="w-5 h-5" />, color: 'bg-blue-50 text-blue-600' },
    { label: 'משתמשים', value: stats?.totalUsers || 0, icon: <Users className="w-5 h-5" />, color: 'bg-green-50 text-green-600' },
    { label: 'דלתות מחוברות', value: stats?.onlineDoors || 0, icon: <Wifi className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'כניסות היום', value: stats?.accessesToday || 0, icon: <Activity className="w-5 h-5" />, color: 'bg-purple-50 text-purple-600' },
    { label: 'הכנסה חודשית', value: `₪${(stats?.revenueMonthly || 0).toLocaleString()}`, icon: <DollarSign className="w-5 h-5" />, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">דשבורד ראשי</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">{kpi.label}</span>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                {kpi.icon}
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Plans distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">ארגונים לפי תוכנית</h2>
          <div className="space-y-3">
            {stats?.orgsByPlan?.map((item: any) => (
              <div key={item.plan} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{item.plan || 'standard'}</span>
                <span className="text-sm font-bold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">פעילות אחרונה</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats?.recentActivity?.map((activity: any) => (
              <div key={activity.id} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-gray-600">{activity.action}</span>
                <span className="text-gray-400 mr-auto text-xs">
                  {activity.timestamp ? new Date(activity.timestamp).toLocaleString('he-IL') : ''}
                </span>
              </div>
            ))}
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <p className="text-gray-500 text-sm">אין פעילות אחרונה</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
