import logo1 from '../assets/logo1.png'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      if (error.message.includes('Usuario inactivo')) {
        setError('Su cuenta está inactiva. Contacte al administrador.')
      } else if (error.message.includes('Usuario no encontrado')) {
        setError('Usuario no registrado en el sistema.')
      } else {
        setError('Credenciales incorrectas')
      }
    } else {
      navigate('/')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="flex flex-col items-center">
        <div>
          <img src={logo1} alt="logo1" className="mb-0 w-60" />
        </div>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-80">
          <h2 className="text-2xl font-bold mb-4">Iniciar sesión</h2>
          <input
            type="email"
            placeholder="Email"
            className="w-full mb-3 p-2 border rounded"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full mb-3 p-2 border rounded"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="text-red-500 mb-2">{error}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}