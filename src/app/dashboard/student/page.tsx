
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
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <nav className="border-b bg-card h-16 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary w-6 h-6" />
            <span className="font-bold text-xl">Student Portal</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </nav>

      <main className="container mx-auto p-8 space-y-8">
        <header className="reveal-up">
          <h1 className="text-3xl font-bold">Welcome back, {userProfile?.username}</h1>
          <p className="text-muted-foreground">Select an assessment to begin.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="reveal-up space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Assessments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {exams?.map((exam) => (
                  <Card key={exam.id} className="hover:border-primary transition-all">
                    <CardHeader>
                      <Badge className="w-fit mb-2">{exam.timeLimitMinutes}m</Badge>
                      <CardTitle>{exam.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{exam.description}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button onClick={() => router.push(`/exam/${exam.id}`)} className="w-full">
                        Start <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </section>

            <section className="reveal-up space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> History
              </h2>
              <div className="space-y-3">
                {results?.map((res) => (
                  <Card key={res.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{res.examTitle}</p>
                        <Badge variant={res.integrityStatus === 'Clean' ? 'outline' : 'destructive'} className="text-[10px]">
                          {res.integrityStatus}
                        </Badge>
                      </div>
                      <p className="text-lg font-bold">{res.score}%</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <Card className="reveal-up bg-primary text-primary-foreground p-6">
              <h3 className="font-bold mb-2">Security Active</h3>
              <p className="text-sm opacity-90">Focus tracking is enabled for all sessions.</p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
