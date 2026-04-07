import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
  subtitle?: string;
}

export default function KPICard({ title, value, icon, color = 'primary', subtitle }: KPICardProps) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <span className="text-xs sm:text-sm font-medium text-gray-500">{title}</span>
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
