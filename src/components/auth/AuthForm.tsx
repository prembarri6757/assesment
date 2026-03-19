
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Lock, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth, useFirestore } from "@/firebase"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"

export function AuthForm() {
  const [role, setRole] = useState<'student' | 'admin'>('student')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        const user = userCredential.user

        // 1. Create the base user profile in /users/{uid}
        await setDoc(doc(db, "users", user.uid), {
          id: user.uid,
          email: user.email,
          role: role,
          createdAt: serverTimestamp()
        })

        // 2. If admin, create the special marker document in /admin_roles/{uid} for security rules
        if (role === 'admin') {
          await setDoc(doc(db, "admin_roles", user.uid), {
            uid: user.uid,
            createdAt: serverTimestamp()
          })
        }

        toast({ title: "Account created", description: "Welcome to the Secure Gateway." })
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      router.push(`/dashboard/${role}`)
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md glass-card animate-in fade-in zoom-in duration-500">
      <CardHeader className="text-center space-y-1">
        <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
          <ShieldCheck className="text-primary-foreground w-8 h-8" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Secure Gateway</CardTitle>
        <CardDescription>
          {isSignUp ? "Create a new account" : "Enter your credentials to access the portal"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex p-1 bg-muted rounded-lg mb-6">
          <button 
            type="button"
            onClick={() => setRole('student')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${role === 'student' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
          >
            Student
          </button>
          <button 
            type="button"
            onClick={() => setRole('admin')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${role === 'admin' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
          >
            Administrator
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                id="email" 
                type="email" 
                placeholder="name@organization.com" 
                className="pl-10" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                id="password" 
                type="password" 
                className="pl-10" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
          </div>
          <Button type="submit" className="w-full btn-premium py-6 text-lg" disabled={loading}>
            {loading ? "Authenticating..." : isSignUp ? "Create Account" : "Login to Dashboard"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button variant="link" size="sm" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Zero-Trust Backend Protection Active
        </p>
      </CardFooter>
    </Card>
  )
}
