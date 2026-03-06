import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ListTodo, UserSquare2, Trophy, LogOut } from "lucide-react";
import clsx from "clsx";

export function Layout() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { to: "/", icon: ListTodo, label: "Mandados" },
    { to: "/private", icon: UserSquare2, label: "Privados" },
    { to: "/leaderboard", icon: Trophy, label: "Ranking" }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600 truncate">
                {String(userProfile?.championName || "Champions")}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-end">
                <span className="text-sm text-gray-500">Saldo</span>
                <span className="font-bold text-green-600">{Number(userProfile?.cap || 0)} CAP</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-500 rounded-full"
                title="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 sm:pb-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                  isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                )
              }
            >
              <Icon className="h-6 w-6 mb-1" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop sidebar navigation - only visible on larger screens if we wanted,
          but for simplicity we'll just keep the bottom nav for mobile and top header for all,
          and add a simple tab nav below header for desktop */}
      <div className="hidden sm:block bg-white shadow mb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    "inline-flex items-center px-1 py-4 border-b-2 text-sm font-medium",
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )
                }
              >
                <Icon className="h-5 w-5 mr-2" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}