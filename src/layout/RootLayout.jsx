import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function RootLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout({ withServerRevoke: true });
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    } finally {
      setLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="h-screen bg-gray-50 grid grid-cols-[16rem_1fr]">
      <Sidebar onLogout={handleLogout} logoutDisabled={loggingOut} />
      <main className="flex flex-col overflow-y-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
