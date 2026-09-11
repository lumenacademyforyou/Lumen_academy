import React from "react";
import { ProfileCard } from "./ProfileCard";

export default function ProfileView() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#001a2a] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#00243B] dark:text-white">
            My Profile
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Manage your personal and academic information.
          </p>
        </div>

        <ProfileCard />
      </div>
    </main>
  );
}