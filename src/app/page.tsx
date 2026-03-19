
"use client"

import { AuthForm } from "@/components/auth/AuthForm"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { useUser, useDoc, useFirestore, useAuth } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { LogOut, LayoutDashboard, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { useMemoFirebase } from "@/firebase"

export default function Home() {
  const containerRef = useScrollReveal()
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { user, isUserLoading } = useUser()

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null
    return doc(db, "users", user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: profileLoading } = useDoc(userDocRef)

  const handleLogout = async () => {
    await signOut(auth)
  }

  return (
    <main ref={containerRef} className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/30">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />
      </div>

      <div className="reveal-up space-y-8 w-full max-w-md">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
            Gateway
          </h1>
          <p className="text-muted-foreground text-lg">
            High-integrity examination environment.
          </p>
        </div>

        {!isUserLoading && user ? (
          <div className="glass-card p-8 rounded-2xl shadow-xl space-y-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="text-primary w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">
                Welcome back, {profileLoading ? "..." : (userProfile?.username || "Scholar")}
              </h2>
              <p className="text-sm text-muted-foreground">You are currently authenticated.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={() => router.push(`/dashboard/${userProfile?.role || 'student'}`)}
                className="w-full btn-premium py-6 flex items-center gap-2"
              >
                <LayoutDashboard className="w-5 h-5" /> Go to Dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="w-full py-6 flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" /> Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <AuthForm />
        )}

        <div className="grid grid-cols-2 gap-4 pt-8">
          <div className="p-4 bg-card rounded-xl border border-border/50 text-center">
            <h3 className="text-sm font-semibold text-primary">Biometric Sync</h3>
            <p className="text-xs text-muted-foreground">Identity Verification</p>
          </div>
          <div className="p-4 bg-card rounded-xl border border-border/50 text-center">
            <h3 className="text-sm font-semibold text-primary">Live Proctor</h3>
            <p className="text-xs text-muted-foreground">Focus Mode Enabled</p>
          </div>
        </div>
      </div>
    </main>
  )
}
