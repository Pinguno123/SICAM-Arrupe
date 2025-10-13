import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import RootLayout from "./layout/RootLayout.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

function Placeholder({ title, description }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {description ? <p className="text-gray-600">{description}</p> : null}
    </section>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<Navigate to="/panel" replace />} />
          <Route path="panel" element={<AdminDashboard />} />
          <Route
            path="procedimientos/nuevo"
            element={<Placeholder title="Nuevo procedimiento" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="procedimientos/lista"
            element={<Placeholder title="Lista de procedimientos" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="informes/mensual"
            element={<Placeholder title="Informe mensual" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="informes/anual"
            element={<Placeholder title="Informe anual" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="mantenimiento/usuarios"
            element={<Placeholder title="Usuarios" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="mantenimiento/catalogos"
            element={<Placeholder title="Catalogos" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="admin/roles"
            element={<Placeholder title="Roles" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="admin/permisos"
            element={<Placeholder title="Permisos" description="Pantalla pendiente de implementar." />}
          />
          <Route
            path="*"
            element={<Placeholder title="404" description="Ruta no encontrada." />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
