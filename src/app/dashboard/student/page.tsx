
"use client"

import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MOCK_EXAMS, MOCK_RESULTS } from "@/lib/mock-data"
import { Clock, BookOpen, Trophy, ShieldCheck, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

export default function StudentDashboard() {
  const containerRef = useScrollReveal()
  const router = useRouter()

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-xl hidden sm:inline-block">Student Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold">John Doe</p>
              <p className="text-[10px] text-muted-foreground">Student ID: 29482</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Logout</Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4 sm:p-8 space-y-8">
        <header className="reveal-up space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, John</h1>
          <p className="text-muted-foreground">You have 2 upcoming assessments this week.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            <section className="reveal-up space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Available Assessments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MOCK_EXAMS.map((exam) => (
                  <Card key={exam.id} className="group hover:border-primary transition-all duration-300">
                    <CardHeader>
                      <Badge className="w-fit mb-2 bg-primary/10 text-primary hover:bg-primary/20">{exam.timeLimitMinutes}m duration</Badge>
                      <CardTitle className="group-hover:text-primary transition-colors">{exam.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{exam.description}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button 
                        onClick={() => router.push(`/exam/${exam.id}`)}
                        className="w-full btn-premium flex items-center justify-between"
                      >
                        Start Assessment <ChevronRight className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </section>

            <section className="reveal-up space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent" /> Recent Performance
              </h2>
              <div className="space-y-3">
                {MOCK_RESULTS.map((res) => (
                  <Card key={res.id} className="glass-card">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className={`p-2 rounded-lg ${res.score >= 70 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                           {res.score >= 70 ? <ShieldCheck className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                         </div>
                         <div>
                           <p className="font-medium text-sm">{res.examTitle}</p>
                           <p className="text-xs text-muted-foreground">Completed: {new Date(res.completedAt).toLocaleDateString()}</p>
                         </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${res.score >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {res.score}%
                        </p>
                        <p className="text-[10px] uppercase tracking-wider font-bold opacity-50">Score</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <Card className="reveal-up bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-lg">Integrity Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold">Account Secure</p>
                    <p className="text-xs opacity-80">Zero incidents flagged</p>
                  </div>
                </div>
                <p className="text-xs opacity-70 leading-relaxed">
                  Our system monitors your environment to ensure fair testing. Switching tabs or windows will terminate active exams.
                </p>
              </CardContent>
            </Card>

            <Card className="reveal-up">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 text-sm">
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Reliable Internet Connection</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Quiet Environment</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Webcam/Mic Enabled</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
