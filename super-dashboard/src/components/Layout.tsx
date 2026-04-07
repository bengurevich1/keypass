import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Building2,
  Cpu,
  ScrollText,
  LogOut,
  Shield,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'דשבורד', icon: LayoutDashboard },
  { path: '/organizations', label: 'ארגונים', icon: Building2 },
  { path: '/devices', label: 'מכשירים', icon: Cpu },
  { path: '/activity-log', label: 'לוג פעילות', icon: ScrollText },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-base font-bold text-white">KeyPass</span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -mr-2 text-white hover:bg-slate-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="פתח תפריט"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 right-0 z-50
          w-72 lg:w-64 bg-slate-900 text-white flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">KeyPass</h1>
              <p className="text-xs text-slate-400">ניהול על</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 -ml-2 text-slate-300 hover:bg-slate-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="סגור תפריט"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-amber-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-slate-300">
                {user?.name?.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            התנתק
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
