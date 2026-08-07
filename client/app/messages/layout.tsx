'use client';

import { usePathname } from 'next/navigation';
import SideBar from './SideBar';

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatOpen = pathname !== '/messages'; // any sub-route (dm/group/new-group) counts as "a chat is open"

  return (
    <div className="flex h-screen bg-[#0E1621] overflow-hidden">
      <div className={`${isChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-85 shrink-0`}>
        <SideBar />
      </div>
      <div className={`${isChatOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {children}
      </div>
    </div>
  );
}