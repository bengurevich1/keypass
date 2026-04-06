import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { Wifi, WifiOff, Unlock, Settings, Users, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Doors() {
  const queryClient = useQueryClient();

  const { data: doors, refetch } = useQuery({
    queryKey: ['doors'],
    queryFn: () => api.get('/admin/doors').then((r) => r.data),
  });

  useSocket((event) => {
    if (event === 'door:status_changed' || event === 'door:created') {
      refetch();
    }
  });

  const unlockMutation = useMutation({
    mutationFn: (doorId: string) => api.post(`/admin/doors/${doorId}/unlock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">דלתות</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doors?.map((door: any) => (
          <div key={door.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Status bar */}
            <div className={`h-1.5 ${door.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{door.name}</h3>
                <div className={`flex items-center gap-1.5 text-sm ${door.isOnline ? 'text-green-600' : 'text-red-500'}`}>
                  {door.isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  {door.isOnline ? 'מחובר' : 'מנותק'}
                </div>
              </div>

              <div className="space-y-2 mb-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{door.userCount || 0} משתמשים</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {door.lastAccess
                      ? `כניסה אחרונה: ${formatDistanceToNow(new Date(door.lastAccess), { locale: he, addSuffix: true })}`
                      : 'אין כניסות'}
                  </span>
                </div>
                {door.espDeviceId && (
                  <div className="text-xs text-gray-400" dir="ltr">
                    ESP: {door.espDeviceId}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (confirm(`לפתוח את ${door.name}?`)) {
                      unlockMutation.mutate(door.id);
                    }
                  }}
                  disabled={!door.isOnline || unlockMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Unlock className="w-4 h-4" />
                  פתח דלת
                </button>
              </div>
            </div>
          </div>
        ))}

        {(!doors || doors.length === 0) && (
          <div className="col-span-full text-center py-12 text-gray-500">
            אין דלתות מוגדרות
          </div>
        )}
      </div>
    </div>
  );
}
