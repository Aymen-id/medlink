import React from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-gray-900 tracking-tight">MediLink</span>
          </Link>
        </div>
        
        {children}
        
        <div className="pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Secure, encrypted workspace for independent physicians.
          </p>
        </div>
      </div>
    </div>
  );
}
