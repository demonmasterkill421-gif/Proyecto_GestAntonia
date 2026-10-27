export function PageHeader({text}){
  return(
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
             <h1 className='text-2xl font-bold text-slate-800'> Gest <span className="text-[#8B2F63]">Antonia</span></h1>
             <p>Centro de estética</p>
        </div>

        <div className="flex items-center gap-4">
            <p>recepcionista</p>

        </div>
    </header>
  );
}