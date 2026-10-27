import { InputForm } from '../components/InputForm'
import { MainButton } from '../components/MainButton'
import logoImg from '../assets/logo.png'

export function Login(){
  return(
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF9] via-[#EFC8E6] to-[#FAFAF9] flex flex-col items-center justify-center p-4">

      <div className="flex flex-col items-center mb-6 text-center">
        <div className="items-center justify-center mb">
          <img 
            src={logoImg} 
            alt="Logo GestAntonia" 
            className="w-2 object-contain mb-3" 
          />
        </div>
        
        <h1 className='text-2xl font-bold text-slate-800'>
          Gest <span className="text-[#8B2F63]">Antonia</span>
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Gestión de ventas, inventario y asistencia
        </p>
      </div>

      <div className='bg-[#FAFAF9]  p-8 rounded-2xl shadow-xl w- 10flex flex-col gap-4'>
        <InputForm
        label={"Correo Electrónico"}
        placeholder={"Ej.: paola@gestantonia.cl"}/>
        <InputForm
        label={"Contraseña"}
        placeholder={"******"}/>

        <MainButton
        text={"Ingresar"}/>
      </div>

    </div>
  )
}