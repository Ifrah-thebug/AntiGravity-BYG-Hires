/** Shared page wrapper for super-admin routes (navbar is global). */
const AdminPageShell = ({ children }) => (
  <div className="min-h-screen bg-gray-50 font-sans text-black pt-24 pb-16">
    <div className="max-w-7xl mx-auto px-6">{children}</div>
  </div>
);

export default AdminPageShell;
