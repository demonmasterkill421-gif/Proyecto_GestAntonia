import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'

//Para agregar una página a una ruta seguir estos pasos:

//1. Importar la función de la aplicación con una ruta correcta (la página)
import { Login } from './pages/login'


//ADMIN
import { MainAdmin } from './pages/administrador/main/MainAdmin'

//RECEPCIONISTA
import { MainRecepcionista } from './pages/recepcionista/main/MainRecepcionista'

//TRABAJADOR
import { MainTrabajador } from './pages/trabajador/main/MainTrabajador'



import { AuthProvider } from "./auth/AuthContext";

//2. Establecer un Route con la url como se ve abajo
//3. agregar la función exportada

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* LOGIN GLOBAL*/}

          <Route path='/' element={<Navigate to="/login"/>}/> {/* No se ingresa a la ruta raíz, en su caso, la lleva a login automáticamente*/}
          <Route path='/login' element={<Login />} /> {/* Renderización de la página Login*/}


          {/* 1. ADMINISTRADOR*/}
          <Route path='/admin/inicio' element={< MainAdmin/>}/>


          {/* 2. RECEPCIONISTA */}

          <Route path='/recepcionista/inicio' element={< MainRecepcionista/>} />

          {/* 3. TRABAJADOR */}

          <Route path='/especialista/inicio' element={<MainTrabajador/>} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;