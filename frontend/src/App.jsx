import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import { Login } from './pages/login'
import { RecepcionistaVenta } from './pages/Recepcionista-Venta'

function App(){
  return(
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Navigate to="/login"/>}/> {/* Al entrar en la raíz, redirecciona al Login */}
          <Route path='/login' element={<Login />} /> {/* Renderiza la página web de Login de la ruta /login */}
          <Route path='/recepcionista/venta' element={<RecepcionistaVenta />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;