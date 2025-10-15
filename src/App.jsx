import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import RootLayout from "./layout/RootLayout.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AppointmentCreate from "./pages/AppointmentCreate.jsx";
import Centers from "./pages/Centers.jsx";
import ContractSetup from "./pages/ContractSetup.jsx";
import Contracts from "./pages/Contracts.jsx";
import Forbidden from "./pages/Forbidden.jsx";
import Login from "./pages/Login.jsx";
import Patients from "./pages/Patients.jsx";
import Services from "./pages/Services.jsx";
import Users from "./pages/Users.jsx";

function Placeholder({ title, description }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {description ? <p className="text-gray-600">{description}</p> : null}
    </section>
  );
}

function LandingRedirect() {
  const { landingRoute } = useAuth();
  return <Navigate to={landingRoute || "/panel"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={(
            <RequireAuth>
              <RootLayout />
            </RequireAuth>
          )}
        >
          <Route index element={<LandingRedirect />} />
          <Route path="panel" element={<AdminDashboard />} />
          <Route
            path="pacientes"
            element={(
              <ProtectedRoute required={["view:patients"]}>
                <Patients />
              </ProtectedRoute>
            )}
          />
          <Route
            path="procedimientos/agendar"
            element={(
              <ProtectedRoute
                requireAny={["create:appointments", "phase:register", "phase:read", "phase:deliver"]}
              >
                <AppointmentCreate />
              </ProtectedRoute>
            )}
          />
          <Route
            path="procedimientos/lista"
            element={(
              <ProtectedRoute required={["view:appointments"]}>
                <Placeholder
                  title="Lista de procedimientos"
                  description="Pantalla pendiente de implementar."
                />
              </ProtectedRoute>
            )}
          />
          <Route
            path="informes/mensual"
            element={(
              <ProtectedRoute required={["*"]}>
                <Placeholder title="Informe mensual" description="Pantalla pendiente de implementar." />
              </ProtectedRoute>
            )}
          />
          <Route
            path="informes/anual"
            element={(
              <ProtectedRoute required={["*"]}>
                <Placeholder title="Informe anual" description="Pantalla pendiente de implementar." />
              </ProtectedRoute>
            )}
          />
          <Route
            path="mantenimiento/centros"
            element={(
              <ProtectedRoute required={["view:centers"]}>
                <Centers />
              </ProtectedRoute>
            )}
          />
          <Route
            path="mantenimiento/servicios"
            element={(
              <ProtectedRoute required={["view:services"]}>
                <Services />
              </ProtectedRoute>
            )}
          />
          <Route
            path="mantenimiento/contratos"
            element={(
              <ProtectedRoute required={["view:contracts"]}>
                <Contracts />
              </ProtectedRoute>
            )}
          />
          <Route
            path="mantenimiento/contratos/armado"
            element={(
              <ProtectedRoute required={["create:contracts"]}>
                <ContractSetup />
              </ProtectedRoute>
            )}
          />
          <Route
            path="mantenimiento/usuarios"
            element={(
              <ProtectedRoute required={["*"]}>
                <Users />
              </ProtectedRoute>
            )}
          />
          {/* <Route
            path="mantenimiento/catalogos"
            element={(
              <ProtectedRoute required={["*"]}>
                <Placeholder title="Catalogos" description="Pantalla pendiente de implementar." />
              </ProtectedRoute>
            )}
          /> */}
          <Route
            path="admin/roles"
            element={(
              <ProtectedRoute required={["*"]}>
                <Placeholder title="Roles" description="Pantalla pendiente de implementar." />
              </ProtectedRoute>
            )}
          />
          <Route
            path="admin/permisos"
            element={(
              <ProtectedRoute required={["*"]}>
                <Placeholder title="Permisos" description="Pantalla pendiente de implementar." />
              </ProtectedRoute>
            )}
          />
          <Route path="403" element={<Forbidden />} />
          <Route path="*" element={<Placeholder title="404" description="Ruta no encontrada." />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
