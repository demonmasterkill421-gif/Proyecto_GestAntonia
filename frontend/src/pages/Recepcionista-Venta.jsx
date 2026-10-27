import { useState, useEffect } from 'react'
import { PageHeader } from '../components/PageHeader'

export function RecepcionistaVenta(){
  const [localId, setLocalId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [descuento, setDescuento] = useState(0);
  const [trabajadorId, setTrabajadorId] = useState('');
  
  // Estados para guardar los datos reales del backend
  const [locales, setLocales] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);

  const [items, setItems] = useState([]);
  const [nombreItem, setNombreItem] = useState('');
  const [precioItem, setPrecioItem] = useState('');

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/locales/')
      .then(res => res.json())
      .then(data => setLocales(data))
      .catch(err => console.error("Error cargando locales:", err));

    fetch('http://127.0.0.1:8000/api/trabajadores/')
      .then(res => res.json())
      .then(data => setTrabajadores(data))
      .catch(err => console.error("Error cargando trabajadores:", err));
  }, []);

  const agregarItem = (e) => {
    e.preventDefault();
    if (!nombreItem || !precioItem) return;
    
    setItems([...items, { id: Date.now(), nombre: nombreItem, precio: Number(precioItem), cantidad: 1 }]);
    setNombreItem('');
    setPrecioItem('');
  };

  const subtotal = items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const total = subtotal - (subtotal * (descuento / 100));

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`¡Venta lista para enviar al backend!\nLocal: ${localId}\nTrabajador: ${trabajadorId}\nTotal: $${total}`);
  };

  return(
    <div className="min-h-screen bg-[#FAFAF9] flex flex-col">
        <PageHeader/>
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Registrar Venta / Atención</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">Detalles de la Venta</h2>
                        <div className="space-y-4">
                            
                            {/* Selector de Local (Datos de Django) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Local de Atención</label>
                                <select 
                                    value={localId} 
                                    onChange={(e) => setLocalId(e.target.value)} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                >
                                    <option value="">-- Seleccione un local --</option>
                                    {locales.map(l => (
                                        <option key={l.id} value={l.id}>{l.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Descripción</label>
                                <input 
                                    type="text" 
                                    value={descripcion} 
                                    onChange={(e) => setDescripcion(e.target.value)} 
                                    placeholder="Ej: Atención de salón"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            {/* Selector de Trabajador (Datos de Django) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Trabajador Encargado</label>
                                <select 
                                    value={trabajadorId} 
                                    onChange={(e) => setTrabajadorId(e.target.value)} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value="">-- Seleccione un trabajador --</option>
                                    {trabajadores.map(t => (
                                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Método de Pago</label>
                                    <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                        <option value="EFECTIVO">Efectivo</option>
                                        <option value="DEBITO">Débito</option>
                                        <option value="CREDITO">Crédito</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Descuento (%)</label>
                                    <input type="number" value={descuento} onChange={(e) => setDescuento(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Agregar Ítems */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">Servicios o Productos</h2>
                        <form onSubmit={agregarItem} className="flex gap-3">
                            <input type="text" placeholder="Nombre" value={nombreItem} onChange={(e) => setNombreItem(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"/>
                            <input type="number" placeholder="Precio" value={precioItem} onChange={(e) => setPrecioItem(e.target.value)} className="w-32 px-3 py-2 border border-gray-300 rounded-lg"/>
                            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium">Agregar</button>
                        </form>
                    </div>
                </div>

                {/* Resumen */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">Resumen</h2>
                        <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto mb-4">
                            {items.map(item => (
                                <div key={item.id} className="py-2 flex justify-between text-sm">
                                    <span>{item.nombre}</span>
                                    <span>${item.precio}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="text-indigo-600">${total}</span>
                        </div>
                        <button onClick={handleSubmit} className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold">
                            Confirmar Venta
                        </button>
                    </div>
                </div>
            </div>
        </main>
    </div>
  )
}