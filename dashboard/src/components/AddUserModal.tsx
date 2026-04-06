import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddUserModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    phone: '',
    name: '',
    apartment: '',
    email: '',
    doorIds: [] as string[],
    sendWhatsApp: true,
  });
  const [error, setError] = useState('');

  const { data: doors } = useQuery({
    queryKey: ['doors'],
    queryFn: () => api.get('/admin/doors').then((r) => r.data),
    enabled: isOpen,
  });

  // Pre-select all doors when they load
  useEffect(() => {
    if (doors && doors.length > 0 && form.doorIds.length === 0) {
      setForm((f) => ({ ...f, doorIds: doors.map((d: any) => d.id) }));
    }
  }, [doors]);

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/admin/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      setForm({ phone: '', name: '', apartment: '', email: '', doorIds: [], sendWhatsApp: true });
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'שגיאה ביצירת משתמש');
    },
  });

  if (!isOpen) return null;

  const toggleDoor = (doorId: string) => {
    setForm((f) => ({
      ...f,
      doorIds: f.doorIds.includes(doorId)
        ? f.doorIds.filter((id) => id !== doorId)
        : [...f.doorIds, doorId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">הוספת משתמש חדש</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            mutation.mutate(form);
          }}
          className="p-6 space-y-4"
        >
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">טלפון *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="05X-XXXXXXX"
              required
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">דירה/חדר</label>
              <input
                type="text"
                value={form.apartment}
                onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">הקצה דלתות</label>
            <div className="space-y-2">
              {doors?.map((door: any) => (
                <label key={door.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.doorIds.includes(door.id)}
                    onChange={() => toggleDoor(door.id)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{door.name}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendWhatsApp}
              onChange={(e) => setForm({ ...form, sendWhatsApp: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">שלח הודעת WhatsApp</span>
          </label>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'שומר...' : 'הוסף משתמש'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
