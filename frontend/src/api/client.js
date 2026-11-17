//Importación de AXIOS: librería para que el frontend se comunique con Django
import axios from "axios";



//Función que crea un cliente configurado con la ruta Base. ej: http://localhost:8000
//de esta forma se ejecutan las consultas api independiente de su ruta.
const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL,
});


//Función que Intercepta la petición y le agrega el token al encabezado
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); //Obtiene el Token del LocalStorage

  //Si hay un token,lo envía en formato "Bearer token" en el encabezado Authorization
  if (token) config.headers.Authorization = `Bearer ${token}`; 
  return config; //devuelve la petición par ser enviada
});

export default api;