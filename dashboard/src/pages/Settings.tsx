import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put('/admin/settings/password', data),
    onSuccess: () => {
      setMessage('סיסמה עודכנה בהצלחה');
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err: any) => {
      setMessage(err.response?.data?.error || 'שגיאה בעדכון סיסמה');
    },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">הגדרות</h1>

      {/* Organization Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">פרטי ארגון</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">שם הארגון</label>
            <p className="text-gray-900 font-medium">{settings?.organization?.name || '—'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">כתובת</label>
            <p className="text-gray-900">{settings?.organization?.address || '—'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">תוכנית</label>
            <p className="text-gray-900">{settings?.organization?.plan || '—'}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4">לשינוי פרטי הארגון, פנה למנהל המערכת</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">הפרופיל שלי</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">שם</label>
            <p className="text-gray-900 font-medium">{settings?.admin?.name || user?.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">אימייל</label>
            <p className="text-gray-900" dir="ltr">{settings?.admin?.email || user?.email}</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">שינוי סיסמה</h2>
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.includes('בהצלחה') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {message}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage('');
            passwordMutation.mutate({ currentPassword, newPassword });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה נוכחית</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה חדשה</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
              minLength={6}
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {passwordMutation.isPending ? 'מעדכן...' : 'עדכן סיסמה'}
          </button>
        </form>
      </div>
    </div>
  );
}
