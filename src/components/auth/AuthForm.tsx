
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Lock, User, Mail } from "lucide-react"
import { useRouter } from "next/navigation"

export function AuthForm() {
  const [role, setRole] = useState<'student' | 'admin'>('student')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulate auth transition
    setTimeout(() => {
      router.push(`/dashboard/${role}`)
    }, 1000)
  }

  return (
    <Card className="w-full max-w-md glass-card animate-in fade-in zoom-in duration-500">
      <CardHeader className="text-center space-y-1">
        <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
          <ShieldCheck className="text-primary-foreground w-8 h-8" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Secure Gateway</CardTitle>
        <CardDescription>
          Enter your credentials to access the portal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex p-1 bg-muted rounded-lg mb-6">
          <button 
            onClick={() => setRole('student')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${role === 'student' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
          >
            Student
          </button>
          <button 
            onClick={() => setRole('admin')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${role === 'admin' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
          >
            Administrator
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="name@organization.com" className="pl-10" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" className="pl-10" required />
            </div>
          </div>
          <Button type="submit" className="w-full btn-premium py-6 text-lg" disabled={loading}>
            {loading ? "Authenticating..." : "Login to Dashboard"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <p className="text-xs text-center text-muted-foreground">
          Zero-Trust Backend Protection Active
        </p>
      </CardFooter>
    </Card>
  )
}
