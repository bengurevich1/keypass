import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Devices() {
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get('/super/devices').then((r) => r.data),
    refetchInterval: 30000,
  });

  const online = devices?.filter((d: any) => d.isOnline) || [];
  const offline = devices?.filter((d: any) => !d.isOnline) || [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">מכשירים (ESP32)</h1>
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">{online.length} מחוברים</span>
          <span className="text-red-500">{offline.length} מנותקים</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">מזהה מכשיר</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">ארגון</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">דלת</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">קושחה</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">נראה לאחרונה</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {devices?.map((device: any) => (
              <tr key={device.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-600" dir="ltr">{device.espDeviceId || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{device.orgName || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{device.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{device.firmwareVersion || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {device.lastSeenAt
                    ? formatDistanceToNow(new Date(device.lastSeenAt), { locale: he, addSuffix: true })
                    : 'לא ידוע'}
                </td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-1.5 text-sm ${device.isOnline ? 'text-green-600' : 'text-red-500'}`}>
                    {device.isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    {device.isOnline ? 'מחובר' : 'מנותק'}
                  </span>
                </td>
              </tr>
            ))}
            {(!devices || devices.length === 0) && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">אין מכשירים רשומים</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
