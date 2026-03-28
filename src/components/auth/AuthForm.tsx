
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Lock, Mail, User as UserIcon, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth, useFirestore } from "@/firebase"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function AuthForm() {
  const [selectedRole, setSelectedRole] = useState<'student' | 'admin'>('student')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()

  // Ensure role is reset to student when switching to sign up
  useEffect(() => {
    if (isSignUp) {
      setSelectedRole('student')
    }
  }, [isSignUp])

  // Reset password visibility when switching roles
  useEffect(() => {
    setShowPassword(false)
  }, [selectedRole])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (isSignUp) {
        if (!username) {
          toast({ title: "Validation Error", description: "Please enter a username.", variant: "destructive" })
          setLoading(false)
          return
        }

        if (password !== confirmPassword) {
          toast({ title: "Validation Error", description: "Passwords do not match. Please verify your new password.", variant: "destructive" })
          setLoading(false)
          return
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        const user = userCredential.user

        // Administrator signup is disabled. All public signups default to student.
        const finalizedRole = 'student'

        // 1. Create the base user profile with username
        await setDoc(doc(db, "users", user.uid), {
          id: user.uid,
          email: user.email,
          username: username,
          role: finalizedRole,
          createdAt: serverTimestamp()
        })

        toast({ title: "Account created", description: `Welcome, ${username}. Access granted to student portal.` })
        router.push(`/dashboard/${finalizedRole}`)
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        const user = userCredential.user

        // Fetch user document to find their actual role and username for redirection
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          router.push(`/dashboard/${userData.role}`)
        } else {
          // Fallback if profile doesn't exist yet (should not happen in normal flow)
          router.push(`/dashboard/${selectedRole}`)
        }
      }
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

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address first to receive a reset link.",
        variant: "destructive"
      })
      return
    }

    try {
      await sendPasswordResetEmail(auth, email)
      toast({
        title: "Reset Email Sent",
        description: "Check your inbox for instructions to reset your password.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
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
          {isSignUp ? "Register for a secure student account" : "Enter credentials to access your dashboard"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Role Selection - Hidden during Sign Up as Admin registration is closed */}
        <div className="flex p-1 bg-muted rounded-lg mb-6">
          <button 
            type="button"
            onClick={() => setSelectedRole('student')}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
              selectedRole === 'student' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground',
              isSignUp && "w-full cursor-default"
            )}
          >
            Student {isSignUp && "Registration"}
          </button>
          {!isSignUp && (
            <button 
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
                selectedRole === 'admin' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'
              )}
            >
              Administrator
            </button>
          )}
        </div>

        {isSignUp && (
          <div className="mb-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
              Admin identities must be provisioned by the gateway
            </p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="username">Username / Full Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="username" 
                  type="text" 
                  placeholder="John Doe" 
                  className="pl-10 h-12 rounded-xl" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                id="email" 
                type="email" 
                placeholder="name@organization.com" 
                className="pl-10 h-12 rounded-xl" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{isSignUp ? "Create Password" : "Password"}</Label>
              {!isSignUp && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="px-0 font-normal text-xs"
                  onClick={handleForgotPassword}
                  type="button"
                >
                  Forgot password?
                </Button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                id="password" 
                type={showPassword && selectedRole === 'student' ? "text" : "password"} 
                className={cn("pl-10 h-12 rounded-xl", (selectedRole === 'student' || isSignUp) && "pr-10")} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? "Min. 6 characters" : ""}
                required 
              />
              {(selectedRole === 'student' || isSignUp) && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="confirmPassword" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Repeat your password"
                  className="pl-10 h-12 rounded-xl" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full btn-premium py-7 text-lg rounded-2xl" disabled={loading}>
            {loading ? "Verifying..." : isSignUp ? "Create Student Account" : "Access Secure Portal"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button variant="link" size="sm" onClick={() => { setIsSignUp(!isSignUp); setConfirmPassword(""); }} className="text-muted-foreground hover:text-primary">
          {isSignUp ? "Already have an identity? Sign In" : "Need a student account? Sign Up"}
        </Button>
        <div className="flex items-center gap-2 opacity-50 grayscale">
          <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0 border-muted-foreground">Zero-Trust</Badge>
          <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0 border-muted-foreground">Proctored</Badge>
        </div>
      </CardFooter>
    </Card>
  )
}
