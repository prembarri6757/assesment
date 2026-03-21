
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
  AlertTriangle
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useAuth } from "@/firebase"
import { signOut } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { ModeToggle } from "@/components/mode-toggle"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

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

  const examsQuery = useMemoFirebase(() => collection(db, "exams"), [db])
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

  if (isUserLoading || profileLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <ShieldCheck className="w-12 h-12 text-primary animate-pulse" />
        <p className="text-muted-foreground font-medium">Verifying Session...</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <nav className="border-b bg-card h-16 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary w-8 h-8" />
            <span className="font-bold text-xl tracking-tight">Student Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-8 space-y-12">
        {/* Hero Section with Stats */}
        <header className="reveal-up space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
                Identity Verified: {userProfile?.email}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                Welcome back, <span className="text-primary">{userProfile?.username || "Scholar"}</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Your high-integrity academic workspace. Monitor your performance and access assigned assessments.
              </p>
            </div>
            <div className="hidden lg:block">
              <div className="bg-muted/50 p-4 rounded-3xl border border-dashed flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="text-primary w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold">{userProfile?.username}</p>
                  <p className="text-xs text-muted-foreground">Level 1 Student Account</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Assessments Taken", value: stats.totalTaken, icon: History, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Aggregate Score", value: `${stats.avgScore}%`, icon: Target, color: "text-primary", bg: "bg-primary/10" },
              { label: "Most Recent", value: `${stats.latestScore}%`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Security Flags", value: stats.flags, icon: ShieldCheck, color: "text-red-500", bg: "bg-red-500/10" },
            ].map((item, i) => (
              <Card key={i} className="border-none shadow-sm rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm border-t border-white/10">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={cn("p-3 rounded-xl shrink-0", item.bg)}>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-muted/50 p-1 rounded-2xl border w-full max-w-md h-auto grid grid-cols-2">
            <TabsTrigger value="exams" className="rounded-xl py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm">
              <BookOpen className="w-4 h-4 mr-2" /> Available Tests
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm">
              <History className="w-4 h-4 mr-2" /> Session History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="space-y-8 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <section className="reveal-up space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Target className="w-6 h-6 text-primary" /> Active Vaults
                    </h2>
                    <Badge variant="secondary" className="px-4 py-1">{exams?.length || 0} Open</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {examsLoading ? (
                      [1,2].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)
                    ) : (
                      exams?.map((exam) => (
                        <Card key={exam.id} className="hover:border-primary transition-all shadow-lg border-none bg-card group overflow-hidden relative rounded-3xl">
                          <div className="absolute top-0 right-0 p-4 opacity-5">
                            <FileText className="w-20 h-20" />
                          </div>
                          <CardHeader className="relative z-10">
                            <Badge variant="secondary" className="w-fit mb-4 bg-primary/10 text-primary border-none">
                              <Clock className="w-3 h-3 mr-1" /> {exam.timeLimitMinutes}m Window
                            </Badge>
                            <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">{exam.title}</CardTitle>
                            <CardDescription className="line-clamp-2 mt-2 text-base">{exam.description}</CardDescription>
                          </CardHeader>
                          <CardFooter className="relative z-10 pt-4">
                            <Button onClick={() => router.push(`/exam/${exam.id}`)} className="w-full btn-premium py-6 text-lg rounded-2xl">
                              Initialize Session <ChevronRight className="w-5 h-5 ml-2" />
                            </Button>
                          </CardFooter>
                        </Card>
                      ))
                    )}
                    {exams?.length === 0 && !examsLoading && (
                      <Card className="col-span-full border-dashed border-2 p-20 flex flex-col items-center justify-center text-center bg-muted/20 rounded-3xl">
                        <BookOpen className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-xl font-bold">No Open Vaults</h3>
                        <p className="text-muted-foreground max-w-sm mt-2">There are currently no assessments assigned to your roster.</p>
                      </Card>
                    )}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <Card className="reveal-up bg-primary text-primary-foreground p-8 shadow-2xl border-none relative overflow-hidden group rounded-3xl">
                  <div className="absolute -top-10 -right-10 p-4 opacity-10 transition-transform group-hover:scale-110 rotate-12">
                    <ShieldCheck className="w-48 h-48" />
                  </div>
                  <h3 className="font-bold text-2xl mb-4 relative z-10">Proctored Mode</h3>
                  <p className="text-lg opacity-90 relative z-10 leading-relaxed">
                    Identity tracking is active. Ensure your environment is secure and maintain focus on the browser window to avoid automated integrity flags.
                  </p>
                </Card>

                <Card className="reveal-up p-8 shadow-sm rounded-3xl border-none bg-muted/30">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-6">Gateway Guidelines</h3>
                  <ul className="space-y-6">
                    <li className="flex items-start gap-4">
                      <div className="bg-primary/10 p-2 rounded-lg"><Clock className="w-5 h-5 text-primary" /></div>
                      <div>
                        <p className="font-bold text-sm">Time Enforcement</p>
                        <p className="text-xs text-muted-foreground">Sessions auto-submit on expiration.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="bg-primary/10 p-2 rounded-lg"><AlertTriangle className="w-5 h-5 text-primary" /></div>
                      <div>
                        <p className="font-bold text-sm">Integrity Policy</p>
                        <p className="text-xs text-muted-foreground">Window blur events are logged.</p>
                      </div>
                    </li>
                  </ul>
                </Card>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-8 outline-none">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card">
              <CardHeader className="p-8 border-b">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" /> Detailed Session Archive
                </CardTitle>
                <CardDescription>A comprehensive audit of your completed assessments and security markers.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {resultsLoading ? (
                  <div className="p-20 flex justify-center"><TrendingUp className="w-10 h-10 animate-spin text-primary opacity-20" /></div>
                ) : (
                  <div className="divide-y">
                    {results?.map((res) => (
                      <div key={res.id} className="p-8 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="space-y-2">
                          <p className="font-bold text-lg">{res.examTitle}</p>
                          <div className="flex items-center gap-3">
                            <Badge variant={res.integrityStatus === 'Clean' ? 'outline' : 'destructive'} className="text-[10px] px-3">
                              {res.integrityStatus}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Reference: {res.id.slice(0,8)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-black text-primary">{res.score}%</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Final Score</p>
                        </div>
                      </div>
                    ))}
                    {(!results || results.length === 0) && (
                      <div className="p-20 text-center text-muted-foreground italic">
                        Your academic archive is currently empty.
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
