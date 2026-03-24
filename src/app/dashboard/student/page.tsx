
"use client"

import { useEffect, useState } from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Clock, 
  BookOpen, 
  Trophy, 
  ShieldCheck, 
  ChevronRight, 
  LogOut, 
  LayoutDashboard,
  Target,
  History,
  TrendingUp,
  FileText,
  User,
  AlertTriangle,
  CircleUser,
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where } from "firebase/firestore"
import { useAuth } from "@/firebase"
import { signOut } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export default function StudentDashboard() {
  const containerRef = useScrollReveal()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("exams")

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null
    return doc(db, "users", user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: profileLoading } = useDoc(userDocRef)

  const examsQuery = useMemoFirebase(() => {
    if (!user) return null
    // Only show published exams to students
    return query(collection(db, "exams"), where("status", "==", "published"))
  }, [db, user])
  const { data: exams, isLoading: examsLoading } = useCollection(examsQuery)

  const resultsQuery = useMemoFirebase(() => {
    if (!user) return null
    return collection(db, "users", user.uid, "results")
  }, [db, user])
  const { data: results, isLoading: resultsLoading } = useCollection(resultsQuery)

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

  // Calculate Stats
  const stats = {
    totalTaken: results?.length || 0,
    avgScore: results?.length 
      ? Math.round(results.reduce((acc, res) => acc + (res.score || 0), 0) / results.length) 
      : 0,
    latestScore: results?.length ? results[results.length - 1].score : 0,
    flags: results?.filter(r => r.integrityStatus === 'Flagged').length || 0
  }

  if (isUserLoading || profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Verifying Session...</p>
      </div>
    )
  }

  if (!user) return null;

  const displayName = userProfile?.username || user.email?.split('@')[0] || "Scholar";

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <nav className="border-b bg-card h-16 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary w-8 h-8" />
            <span className="font-bold text-xl tracking-tight hidden sm:inline">Student Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-xs font-bold text-primary">
              <CircleUser className="w-4 h-4" />
              <span>{displayName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-6 md:p-12 space-y-12">
        <header className="space-y-8 py-10">
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-4">
              Welcome, <span className="text-primary">{displayName}</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
              You are currently authenticated in the secure assessment gateway. Your academic integrity standing is <span className="text-foreground font-bold">Verified</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-8">
            {[
              { label: "Assessments", value: stats.totalTaken, icon: History, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Aggregate", value: `${stats.avgScore}%`, icon: Target, color: "text-primary", bg: "bg-primary/10" },
              { label: "Recent Score", value: `${stats.latestScore}%`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Security Flags", value: stats.flags, icon: ShieldCheck, color: "text-red-500", bg: "bg-red-500/10" },
            ].map((item, i) => (
              <Card key={i} className="border-none shadow-sm rounded-3xl bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={cn("p-3 rounded-2xl shrink-0", item.bg)}>
                    <item.icon className={cn("w-6 h-6", item.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-black">{item.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
          <TabsList className="bg-muted/50 p-1.5 rounded-3xl border w-full max-w-md h-auto grid grid-cols-2">
            <TabsTrigger value="exams" className="rounded-2xl py-3 px-6 text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm transition-all">
              <BookOpen className="w-4 h-4 mr-2" /> Available Tests
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-2xl py-3 px-6 text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm transition-all">
              <History className="w-4 h-4 mr-2" /> Session History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="space-y-8 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {examsLoading ? (
                [1,2,3].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-3xl" />)
              ) : (
                exams?.map((exam) => (
                  <Card key={exam.id} className="hover:border-primary transition-all shadow-xl border-none bg-card group overflow-hidden rounded-[2.5rem]">
                    <CardHeader className="p-8">
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                          <Clock className="w-3 h-3 mr-1" /> {exam.timeLimitMinutes}m
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">{exam.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-4 text-base leading-relaxed">{exam.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="p-8 pt-0">
                      <Button onClick={() => router.push(`/exam/${exam.id}`)} className="w-full btn-premium py-7 text-lg rounded-2xl bg-primary hover:bg-primary/90">
                        Start Session <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
              {(!exams || exams.length === 0) && !examsLoading && (
                <Card className="col-span-full border-dashed border-2 p-20 flex flex-col items-center justify-center text-center bg-muted/20 rounded-[2.5rem]">
                  <BookOpen className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
                  <h3 className="text-2xl font-bold">No Active Assessments</h3>
                  <p className="text-muted-foreground max-w-sm mt-3 text-lg">Your academic roster is currently up to date. New assessments will appear here.</p>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-8 outline-none">
            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-card">
              <CardHeader className="p-10 border-b bg-muted/20">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <History className="w-6 h-6 text-primary" /> Session Archive
                </CardTitle>
                <CardDescription className="text-base">Comprehensive log of completed proctored assessments.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {resultsLoading ? (
                  <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {results?.map((res) => {
                      const examData = exams?.find(e => e.id === res.examId);
                      const isGraded = res.score !== undefined;
                      const isPassed = isGraded && res.score >= (examData?.passingScore || 0);

                      return (
                        <div key={res.id} className="p-10 flex items-center justify-between hover:bg-muted/30 transition-all">
                          <div className="space-y-3">
                            <p className="font-bold text-xl">{res.examTitle}</p>
                            <div className="flex items-center gap-4 flex-wrap">
                              <Badge variant={res.integrityStatus === 'Clean' ? 'outline' : 'destructive'} className="text-[10px] px-4 py-1 font-black uppercase tracking-widest rounded-full">
                                {res.integrityStatus}
                              </Badge>
                              {isGraded && (
                                <Badge variant={isPassed ? 'default' : 'destructive'} className={cn("text-[10px] px-4 py-1 font-black uppercase tracking-widest rounded-full gap-1", isPassed ? "bg-emerald-500 hover:bg-emerald-600" : "")}>
                                  {isPassed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {isPassed ? "PASS" : "FAIL"}
                                </Badge>
                              )}
                              {res.correctCount !== undefined && (
                                <Badge variant="secondary" className="text-[10px] px-4 py-1 font-black uppercase tracking-widest rounded-full gap-2">
                                  <Target className="w-3 h-3" /> Marks: {res.correctCount} / {res.totalQuestions || 0}
                                </Badge>
                              )}
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span className="text-[10px] uppercase font-bold">{res.startedAt ? format(new Date(res.startedAt), 'MMM dd, yyyy @ hh:mm a') : 'Unknown Date'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-5xl font-black text-primary">{res.score || 0}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2">Calculated Score</p>
                          </div>
                        </div>
                      );
                    })}
                    {(!results || results.length === 0) && (
                      <div className="p-24 text-center text-muted-foreground italic text-lg">
                        Your session archive is currently empty.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
