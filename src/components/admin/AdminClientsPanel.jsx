import React from 'react';
import { Building2 } from 'lucide-react';

/** Placeholder until client role is implemented */
const AdminClientsPanel = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight">Browse clients</h1>
      <p className="text-gray-500 text-sm font-medium mt-2">
        Hiring-partner accounts are not enabled yet.
      </p>
    </div>

    <div className="bg-white border border-gray-200 rounded-[2rem] p-12 text-center shadow-sm">
      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Building2 size={28} className="text-gray-300" />
      </div>
      <p className="font-black text-gray-800 uppercase tracking-widest text-sm mb-2">Coming soon</p>
      <p className="text-gray-500 text-sm font-medium max-w-md mx-auto leading-relaxed">
        The client role and client directory will be added in a later release. Super admins will
        manage client access from here.
      </p>
    </div>
  </div>
);

export default AdminClientsPanel;
