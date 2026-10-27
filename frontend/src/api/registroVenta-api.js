import axios from 'axios'

export const obtenerAllVentas = () => {
    return axios.get('http://localhost:8000/login/?next=/')

}