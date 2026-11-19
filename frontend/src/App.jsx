import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { RutaPrivada } from './auth/RutaPrivada'

//Para agregar una página a una ruta seguir estos pasos:

//1. Importar la función de la aplicación con una ruta correcta (la página)
import { Login } from './pages/login'


//ADMIN
import { MainAdmin } from './pages/administrador/main/MainAdmin'
import { ReportesAdmin } from './pages/administrador/reportes/ReportesAdmin'
import {AdminSucursales} from'./pages/administrador/sucursales/admin-sucursales'
import { VentasAdmin } from './pages/administrador/venta/VentasAdmin'
import { AsistenciaAdmin } from './pages/administrador/asistencia/AsistenciaAdmin'
import { Inventario } from "./pages/administrador/inventario/Inventario";
import { RegistrarProducto } from "./pages/administrador/inventario/RegistrarProducto";

//RECEPCIONISTA
import { MainRecepcionista } from './pages/recepcionista/main/MainRecepcionista'
import { RegistrarVenta } from './pages/recepcionista/venta/RegistrarVenta'
import { VentasRecepcionista } from './pages/recepcionista/venta/VentasRecepcionista'
import { AsistenciaRecepcionista } from './pages/recepcionista/asistencia/AsistenciaRecepcionista'

//TRABAJADOR
import { MainTrabajador } from './pages/trabajador/main/MainTrabajador'
import { RegistrarAsistencia } from './pages/trabajador/asistencia/RegistrarAsistencia'



import { AuthProvider, useAuth } from "./auth/AuthContext";
import { INICIO_POR_ROL } from "./config/roles";

//2. Establecer un Route con la url como se ve abajo, DENTRO del grupo del rol que puede entrar
//3. agregar la función exportada

// A1: cualquier dirección que no exista lleva al inicio del rol de la persona.
// Antes mandaba a /login, y el login cierra la sesión al abrirse.
function IrAlInicio() {
  const { usuario, cargando } = useAuth();
  if (cargando) return null; // todavía se está recuperando la sesión
  return <Navigate to={usuario ? (INICIO_POR_ROL[usuario.rol] ?? "/login") : "/login"} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* LOGIN GLOBAL*/}

          <Route path='/' element={<Navigate to="/login"/>}/> {/* No se ingresa a la ruta raíz, en su caso, la lleva a login automáticamente*/}
          <Route path='/login' element={<Login />} /> {/* Renderización de la página Login*/}


          {/* 1. ADMINISTRADOR: solo entra el rol ADMIN */}
          <Route element={<RutaPrivada roles={["ADMIN"]} />}>
            <Route path='/admin/inicio' element={< MainAdmin/>}/>
            <Route path='/admin/locales' element={< AdminSucursales/>}/>
            <Route path='/admin/ventas' element={<VentasAdmin/>}/>
            <Route path='/admin/asistencia' element={<AsistenciaAdmin/>}/>
            <Route path='/admin/reportes' element={<ReportesAdmin/>} /> {/* La ruta que usa el Sidebar */}
            <Route path='/reportes' element={<ReportesAdmin/>} /> {/* Ruta original del equipo, se mantiene por si la usan en otro lado */}
            <Route path="/admin/inventario" element={<Inventario />}/>
            <Route path="/admin/inventario/registrar" element={<RegistrarProducto />}/>
          </Route>


          {/* 2. RECEPCIONISTA: solo entra el rol RECEP */}
          <Route element={<RutaPrivada roles={["RECEP"]} />}>
            <Route path='/recepcionista/inicio' element={< MainRecepcionista/>} />
            <Route path='/recepcionista/registrar-venta' element={< RegistrarVenta/>} />
            <Route path='/recepcionista/ventas' element={<VentasRecepcionista/>} />
            <Route path='/recepcionista/asistencia' element={<AsistenciaRecepcionista/>} />
          </Route>

          {/* 3. TRABAJADOR: solo entra el rol TRAB */}
          <Route element={<RutaPrivada roles={["TRAB"]} />}>
            <Route path='/especialista/inicio' element={<MainTrabajador/>} />
            <Route path='/trabajador/asistencia' element={<RegistrarAsistencia />} />
          </Route>

          <Route path="*" element={<IrAlInicio />} /> {/* A1: dirección inexistente → inicio del rol (sin cerrar la sesión) */}

        </Routes>

        {/* Avisos (toasts): abajo al centro, grandes. Verde = éxito, rojo = error */}
        <Toaster
          position="bottom-center"
          containerStyle={{ bottom: 32 }}
          toastOptions={{
            duration: 3500,
            style: {
              padding: "16px 24px",
              fontSize: "1.2rem",
              fontWeight: 600,
              borderRadius: "16px",
              maxWidth: "90vw",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            },
            success: {
              style: { background: "#16a34a", color: "#ffffff" },
              iconTheme: { primary: "#ffffff", secondary: "#16a34a" },
            },
            error: {
              style: { background: "#dc2626", color: "#ffffff" },
              iconTheme: { primary: "#ffffff", secondary: "#dc2626" },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;