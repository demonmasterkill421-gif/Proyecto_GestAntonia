import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import { Login } from './pages/login'
import { RecepcionistaVenta } from './pages/Recepcionista-Venta'

function App(){
  return(
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Navigate to="/login"/>}/>
          <Route path='/login' element={<Login />} />
          <Route path='/recepcionista/venta' element={<RecepcionistaVenta />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;