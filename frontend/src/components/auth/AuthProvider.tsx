import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { AlertCircle, KeyRound } from 'lucide-react'
import { Alert, AlertDescription } from '../ui/alert'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [secret, setSecret] = useState(localStorage.getItem('managementApiSecret') || '')
  const [isAuthenticated, setIsAuthenticated] = useState(!!secret)
  const [inputSecret, setInputSecret] = useState('')
  const [error, setError] = useState('')

  // Listen to unauth events from ApiService
  React.useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false)
      setSecret('')
      setError('Your Management API secret is invalid or has expired.')
    }
    
    window.addEventListener('management-api-unauthorized', handleUnauthorized)
    return () => window.removeEventListener('management-api-unauthorized', handleUnauthorized)
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputSecret.trim()) {
      setError('Please enter a valid Management API secret.')
      return
    }
    
    // In a real scenario we'd do a quick check to see if the API accepts this key
    localStorage.setItem('managementApiSecret', inputSecret.trim())
    setSecret(inputSecret.trim())
    setIsAuthenticated(true)
    setError('')
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <form onSubmit={handleLogin}>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <KeyRound size={28} />
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold">Chat2API Manager</CardTitle>
            <CardDescription className="text-center">
              Please enter your Management API secret to continue.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="secret">API Secret</Label>
              <Input 
                id="secret" 
                type="password" 
                placeholder="sk-..." 
                value={inputSecret}
                onChange={(e) => setInputSecret(e.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </div>
          </CardContent>
          
          <CardFooter>
            <Button type="submit" className="w-full" size="lg">
              Login
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
