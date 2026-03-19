
"use client"

import { AuthForm } from "@/components/auth/AuthForm"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"

export default function Home() {
  const containerRef = useScrollReveal()

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

        <AuthForm />

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
