import React from 'react';
import { 
  MessageSquare, 
  ChevronRight, 
  Wallet, 
  Headphones, 
  Heart, 
  CreditCard, 
  User, 
  Key, 
  Lock, 
  Settings, 
  Home 
} from 'lucide-react';
import { cn } from '../lib/utils';

// --- Custom SVGs ---

const UserAvatarSVG = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="20" fill="#F1F5F9" />
    <path d="M20 22C24.4183 22 28 18.4183 28 14C28 9.58172 24.4183 6 20 6C15.5817 6 12 9.58172 12 14C12 18.4183 15.5817 22 20 22Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 25C13.3726 25 8 30.3726 8 37V39H32V37C32 30.3726 26.6274 25 20 25Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WaveSVG = () => (
  <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 375 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 40H375V0C281.25 26.6667 93.75 26.6667 0 0V40Z" fill="#F8FAFC" />
  </svg>
);

const RigengLogoSVG = ({ active }: { active?: boolean }) => (
  <div className={cn(
    "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
    active ? "bg-[#CC2936]" : "bg-slate-300"
  )}>
    <div className="w-3 h-3 bg-white rounded-full opacity-40"></div>
  </div>
);

// --- Components ---

const ActionItem = ({ icon: Icon, label }: { icon: any, label: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 cursor-pointer active:opacity-70 transition-opacity">
    <Icon className="w-6 h-6 text-slate-800" strokeWidth={1.5} />
    <span className="text-xs text-slate-800 font-medium">{label}</span>
  </div>
);

const ListItem = ({ icon: Icon, label, extra, isLast }: { icon: any, label: string, extra?: string, isLast?: boolean }) => (
  <div className={cn(
    "flex items-center justify-between py-4 cursor-pointer active:bg-slate-50 transition-colors px-4",
    !isLast && "border-b border-slate-100"
  )}>
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
      <span className="text-[15px] text-slate-800">{label}</span>
    </div>
    <div className="flex items-center gap-1">
      {extra && <span className="text-sm text-slate-400">{extra}</span>}
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </div>
  </div>
);

export default function MinePage() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] relative pb-20 no-scrollbar overflow-y-auto">
      {/* Header Section */}
      <div className="relative h-44 bg-gradient-to-b from-[#CC2936] to-[#E85D3A] px-6 pt-12 shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <UserAvatarSVG />
            <span className="text-white text-lg font-medium tracking-wide">15500981851</span>
          </div>
          <button className="p-1 active:opacity-70 transition-opacity">
            <MessageSquare className="w-6 h-6 text-white" strokeWidth={2} />
          </button>
        </div>
        <WaveSVG />
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-5 z-10 space-y-4">
        {/* My Netbar Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-4">
            <h2 className="text-base font-bold text-slate-900">我的网吧</h2>
            <div className="flex items-center text-sm text-slate-400 cursor-pointer active:opacity-70">
              全部订单 <ChevronRight className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 pb-6 pt-2">
            <ActionItem icon={Wallet} label="卡包" />
            <ActionItem icon={Headphones} label="订座" />
            <ActionItem icon={Heart} label="收藏" />
            <ActionItem icon={CreditCard} label="退卡" />
          </div>
        </div>

        {/* Settings List Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <ListItem icon={User} label="实名认证" extra="已认证" />
          <ListItem icon={Key} label="账号与安全" />
          <ListItem icon={Lock} label="上机密码修改" />
          <ListItem icon={Headphones} label="客服中心" />
          <ListItem icon={Settings} label="设置" isLast />
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[375px] mx-auto bg-white border-t border-slate-100 flex h-14 items-center justify-around z-50">
        <div className="flex flex-col items-center justify-center gap-0.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity">
          <Home className="w-6 h-6 text-slate-900" strokeWidth={1.5} />
          <span className="text-[10px] text-slate-900 font-medium">首页</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 cursor-pointer">
          <RigengLogoSVG active />
          <span className="text-[10px] text-[#CC2936] font-bold">我的</span>
        </div>
      </div>
    </div>
  );
}
