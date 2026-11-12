import Link from 'next/link';
import { logout } from '@/app/login/actions';

interface TopBarProps {
  role: 'public' | 'government_official';
}

export default function TopBar({ role }: TopBarProps) {
  const isPublic = role === 'public';
  
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-black/80 border-b border-white/10 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${isPublic ? 'bg-public_teal' : 'bg-smc_blue'} shadow-[0_0_12px_rgba(255,255,255,0.2)]`} />
        <Link href={isPublic ? '/portal' : '/dashboard'} className="text-lg font-bold tracking-tight text-white hover:opacity-80 transition-opacity">
          RoadLens — {isPublic ? 'Public Transparency Portal' : 'SMC Command Center'}
        </Link>
      </div>

      <div className="flex items-center gap-4 text-sm font-medium text-white/70">
        <span className="hidden sm:inline-block">
          {isPublic ? 'Surat · Open data · Updated daily' : 'Public Works Dept · Live'}
        </span>
        
        {!isPublic && (
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white">
                A
              </div>
              <span>Admin</span>
            </div>
            <form action={logout}>
              <button type="submit" className="text-white/50 hover:text-white transition-colors">
                Logout
              </button>
            </form>
          </div>
        )}
        
        {isPublic && (
          <Link href="/login" className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all text-xs">
            Staff Login
          </Link>
        )}
      </div>
    </header>
  );
}
