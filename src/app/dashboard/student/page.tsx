
"use client"

import { useEffect } from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, BookOpen, Trophy, ShieldCheck, ChevronRight, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useAuth } from "@/firebase"
import { signOut } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { ModeToggle } from "@/components/mode-toggle"

export default function StudentDashboard() {
  const containerRef = useScrollReveal()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null
    return doc(db, "users", user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: profileLoading } = useDoc(userDocRef)

  const examsQuery = useMemoFirebase(() => collection(db, "exams"), [db])
  const { data: exams, isLoading: examsLoading } = useCollection(examsQuery)

  const resultsQuery = useMemoFirebase(() => {
    if (!user) return null
    return collection(db, "users", user.uid, "results")
  }, [db, user])
  const { data: results } = useCollection(resultsQuery)

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/')
    }
    if (!isUserLoading && !profileLoading && userProfile && userProfile.role === 'admin') {
      router.push('/dashboard/admin')
    }
  }, [user, isUserLoading, userProfile, profileLoading, router])

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/')
  }

  if (isUserLoading || profileLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading portal...</div>
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <nav className="border-b bg-card h-16 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary w-6 h-6" />
            <span className="font-bold text-xl">Student Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-8 space-y-8">
        <header className="reveal-up">
          <h1 className="text-3xl font-bold">Welcome back, {userProfile?.username}</h1>
          <p className="text-muted-foreground">Select an assessment to begin your session.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="reveal-up space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Active Assessments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {exams?.map((exam) => (
                  <Card key={exam.id} className="hover:border-primary transition-all shadow-sm">
                    <CardHeader>
                      <Badge variant="secondary" className="w-fit mb-2">{exam.timeLimitMinutes}m Limit</Badge>
                      <CardTitle className="text-xl">{exam.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{exam.description}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button onClick={() => router.push(`/exam/${exam.id}`)} className="w-full btn-premium">
                        Start Session <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
                {exams?.length === 0 && (
                  <Card className="col-span-full border-dashed p-12 flex flex-col items-center justify-center text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                    <p className="text-muted-foreground">No assessments available at this time.</p>
                  </Card>
                )}
              </div>
            </section>

            <section className="reveal-up space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> Performance History
              </h2>
              <div className="space-y-3">
                {results?.map((res) => (
                  <Card key={res.id} className="shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-bold">{res.examTitle}</p>
                        <Badge variant={res.integrityStatus === 'Clean' ? 'outline' : 'destructive'} className="text-[10px] h-4">
                          {res.integrityStatus}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-primary">{res.score}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Score</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!results || results.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-xl border border-dashed">No attempts recorded.</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <Card className="reveal-up bg-primary text-primary-foreground p-6 shadow-xl border-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 transition-transform group-hover:scale-110">
                <ShieldCheck className="w-24 h-24" />
              </div>
              <h3 className="font-bold text-lg mb-2 relative z-10">Security Active</h3>
              <p className="text-sm opacity-90 relative z-10">Focus tracking and identity verification are active for all sessions. Maintain tab focus to avoid flags.</p>
            </Card>

            <Card className="reveal-up p-6 shadow-sm">
              <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground mb-4">Guidelines</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Time limits are strictly enforced.</span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Answer keys are server-protected.</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
