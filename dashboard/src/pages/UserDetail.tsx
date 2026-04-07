import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { ArrowRight, Send, Pause, Play, Ban, Trash2, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/admin/users/${id}`).then((r) => r.data),
  });

  const { data: allDoors } = useQuery({
    queryKey: ['doors'],
    queryFn: () => api.get('/admin/doors').then((r) => r.data),
  });

  const [selectedDoors, setSelectedDoors] = useState<string[]>([]);

  // Sync selected doors when user data loads
  const userDoorIds = user?.permissions?.map((p: any) => p.doorId) || [];

  const actionMutation = useMutation({
    mutationFn: ({ action, userId }: { action: string; userId: string }) => {
      if (action === 'resend-whatsapp') return api.post(`/admin/users/${userId}/resend-whatsapp`);
      if (action === 'suspend') return api.post(`/admin/users/${userId}/suspend`);
      if (action === 'activate') return api.post(`/admin/users/${userId}/activate`);
      if (action === 'revoke') return api.delete(`/admin/users/${userId}`);
      if (action === 'delete-permanent') return api.delete(`/admin/users/${userId}/permanent`);
      return Promise.reject('Unknown action');
    },
    onSuccess: (_data, variables) => {
      if (variables.action === 'delete-permanent') {
        queryClient.invalidateQueries({ queryKey: ['users'] });
        navigate('/users');
      } else {
        queryClient.invalidateQueries({ queryKey: ['user', id] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      }
    },
  });

  const permissionMutation = useMutation({
    mutationFn: ({ userId, doorId, action }: { userId: string; doorId: string; action: 'grant' | 'revoke'; permId?: string }) => {
      if (action === 'grant') return api.post('/admin/permissions', { userId, doorId });
      return api.delete(`/admin/permissions/${doorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });

  if (isLoading) return <div className="text-center py-8 text-gray-500">טוען...</div>;
  if (!user) return <div className="text-center py-8 text-gray-500">משתמש לא נמצא</div>;

  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: 'פעיל', color: 'bg-green-100 text-green-700' },
    pending: { label: 'ממתין', color: 'bg-yellow-100 text-yellow-700' },
    suspended: { label: 'מושהה', color: 'bg-orange-100 text-orange-700' },
    revoked: { label: 'בוטל', color: 'bg-red-100 text-red-700' },
  };
  const status = statusLabels[user.status] || { label: user.status, color: 'bg-gray-100 text-gray-700' };

  return (
    <div>
      <button onClick={() => navigate('/users')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowRight className="w-4 h-4" />
        חזרה למשתמשים
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{user.name || 'ללא שם'}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-gray-500 text-sm">
              <span dir="ltr">{user.phone}</span>
              {user.apartment && <span>דירה {user.apartment}</span>}
              {user.registeredAt && <span>נרשם {format(new Date(user.registeredAt), 'dd/MM/yyyy')}</span>}
            </div>
          </div>
          <span className={`self-start px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>{status.label}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mt-6">
          <button
            onClick={() => actionMutation.mutate({ action: 'resend-whatsapp', userId: user.id })}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Send className="w-4 h-4" />
            שלח WhatsApp מחדש
          </button>
          {user.status === 'active' && (
            <button
              onClick={() => actionMutation.mutate({ action: 'suspend', userId: user.id })}
              className="flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50"
            >
              <Pause className="w-4 h-4" />
              השהה
            </button>
          )}
          {user.status === 'suspended' && (
            <button
              onClick={() => actionMutation.mutate({ action: 'activate', userId: user.id })}
              className="flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm border border-green-300 rounded-lg text-green-700 hover:bg-green-50"
            >
              <Play className="w-4 h-4" />
              הפעל מחדש
            </button>
          )}
          {user.status !== 'revoked' && (
            <button
              onClick={() => {
                if (confirm('האם אתה בטוח שברצונך לבטל את הגישה של המשתמש?')) {
                  actionMutation.mutate({ action: 'revoke', userId: user.id });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50"
            >
              <Ban className="w-4 h-4" />
              בטל גישה
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('האם אתה בטוח? המשתמש יימחק לצמיתות ולא ניתן יהיה לשחזר אותו.')) {
                actionMutation.mutate({ action: 'delete-permanent', userId: user.id });
              }
            }}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm border border-red-300 rounded-lg text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            מחק משתמש
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Door Permissions */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">הרשאות דלתות</h2>
          <div className="space-y-3">
            {allDoors?.map((door: any) => {
              const hasPerm = user.permissions?.find((p: any) => p.doorId === door.id);
              return (
                <label key={door.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!hasPerm}
                    onChange={() => {
                      if (hasPerm) {
                        permissionMutation.mutate({ userId: user.id, doorId: hasPerm.id, action: 'revoke' });
                      } else {
                        permissionMutation.mutate({ userId: user.id, doorId: door.id, action: 'grant' });
                      }
                    }}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{door.name}</span>
                  <span className={`text-xs ${door.isOnline ? 'text-green-500' : 'text-red-500'}`}>
                    {door.isOnline ? 'מחובר' : 'מנותק'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Devices */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">מכשירים</h2>
          {user.credentials?.length > 0 ? (
            <div className="space-y-3">
              {user.credentials.map((cred: any) => (
                <div key={cred.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Smartphone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cred.deviceName || 'מכשיר'}</p>
                    <p className="text-xs text-gray-500">{cred.platform} | {format(new Date(cred.createdAt), 'dd/MM/yyyy')}</p>
                  </div>
                  <span className={`text-xs mr-auto ${cred.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {cred.isActive ? 'פעיל' : 'בוטל'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">אין מכשירים רשומים</p>
          )}
        </div>
      </div>

      {/* Access History */}
      <div className="bg-white rounded-xl border border-gray-200 mt-6">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">היסטוריית כניסות</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">תאריך</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">דלת</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">שיטה</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {user.history?.map((log: any) => (
              <tr key={log.id} className="border-b border-gray-50">
                <td className="px-6 py-3 text-sm text-gray-500">
                  {log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm') : '—'}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">{log.doorName || '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-600">{log.method || '—'}</td>
                <td className="px-6 py-3 text-sm">
                  <span className={log.action === 'unlock' ? 'text-green-600' : 'text-red-600'}>
                    {log.action === 'unlock' ? 'נפתח' : log.action === 'denied' ? 'נדחה' : log.action}
                  </span>
                </td>
              </tr>
            ))}
            {(!user.history || user.history.length === 0) && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">אין היסטוריה</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
