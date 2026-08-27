import React, { useState } from "react";
import { LogOut, Users, BookOpen, Activity, LayoutDashboard, Settings } from "lucide-react";
import LumenLogo from "../components/ui/LumenLogo";

interface AdminViewProps {
  onLogout: () => void;
  adminName: string;
}

export default function AdminView({ onLogout, adminName }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex text-slate-900 dark:text-white font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <LumenLogo />
            </div>
            <h1 className="text-lg font-bold">Admin Portal</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
            { id: "students", label: "Students", icon: <Users size={18} /> },
            { id: "content", label: "Content Mgmt", icon: <BookOpen size={18} /> },
            { id: "analytics", label: "Analytics", icon: <Activity size={18} /> },
            { id: "settings", label: "Settings", icon: <Settings size={18} /> }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === item.id
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-bold">Welcome back, {adminName}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Here's what's happening today.</p>
        </header>

        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Total Students", value: "2,405", trend: "+12%" },
                { label: "Active Sessions", value: "342", trend: "+5%" },
                { label: "Assessments Taken", value: "14,092", trend: "+24%" }
              ].map((stat, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <div className="flex items-end justify-between mt-2">
                    <h3 className="text-3xl font-bold">{stat.value}</h3>
                    <span className="text-sm font-bold text-green-500">{stat.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold">Recent Signups</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {[
                  { name: "Sarah J.", stream: "NEET Aspirant", date: "2 mins ago" },
                  { name: "Rahul K.", stream: "JEE Mains", date: "15 mins ago" },
                  { name: "Priya S.", stream: "Olympiad", date: "1 hour ago" },
                  { name: "Amit P.", stream: "NEET Repeaters", date: "3 hours ago" }
                ].map((user, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 dark:text-slate-300">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.stream}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{user.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab !== "overview" && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <p className="text-slate-500 dark:text-slate-400 font-medium">{activeTab} section coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
}
