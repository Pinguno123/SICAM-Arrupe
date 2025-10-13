import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";

export default function RootLayout() {
  return (
    <div className="h-screen bg-gray-50 grid grid-cols-[16rem_1fr]">
      <Sidebar />
      <main className="flex flex-col overflow-y-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
