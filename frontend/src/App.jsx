import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import { RutaPrivada } from './auth/RutaPrivada'

//Para agregar una página a una ruta seguir estos pasos:

//1. Importar la función de la aplicación con una ruta correcta (la página)
import { Login } from './pages/login'


//ADMIN
import { MainAdmin } from './pages/administrador/main/MainAdmin'
import {AdminSucursales} from'./pages/administrador/sucursales/admin-sucursales'

//RECEPCIONISTA
import { MainRecepcionista } from './pages/recepcionista/main/MainRecepcionista'
import { RegistrarVenta } from './pages/recepcionista/venta/RegistrarVenta'

//TRABAJADOR
import { MainTrabajador } from './pages/trabajador/main/MainTrabajador'



import { AuthProvider } from "./auth/AuthContext";

//2. Establecer un Route con la url como se ve abajo, DENTRO del grupo del rol que puede entrar
//3. agregar la función exportada

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
          </Route>


          {/* 2. RECEPCIONISTA: solo entra el rol RECEP */}
          <Route element={<RutaPrivada roles={["RECEP"]} />}>
            <Route path='/recepcionista/inicio' element={< MainRecepcionista/>} />
            <Route path='/recepcionista/registrar-venta' element={< RegistrarVenta/>} />
          </Route>

          {/* 3. TRABAJADOR: solo entra el rol TRAB */}
          <Route element={<RutaPrivada roles={["TRAB"]} />}>
            <Route path='/especialista/inicio' element={<MainTrabajador/>} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;