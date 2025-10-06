import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/" },
    { label: "Drafts", path: "/drafts" },
    { label: "Users", path: "/users" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-3">
          <h1 className="text-xl font-semibold text-blue-600">WWConsole</h1>

          <nav className="flex gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`font-medium hover:text-blue-600 ${
                  location.pathname === item.path
                    ? "text-blue-600"
                    : "text-gray-600"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div>
            <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
              + Add Draft
            </button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
