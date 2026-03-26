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
  Calendar,
  Eye,
  Check,
  X,
  Sparkles,
  Settings,
  Save
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, getDocs, updateDoc } from "firebase/firestore"
import { useAuth } from "@/firebase"
import { signOut } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function StudentDashboard() {
  const containerRef = useScrollReveal()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()

  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("exams")
  const [reviewResult, setReviewResult] = useState<any>(null)
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([])
  const [loadingReview, setLoadingReview] = useState(false)
  
  // Profile Editing State
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null
    return doc(db, "users", user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: profileLoading } = useDoc(userDocRef)

  useEffect(() => {
    if (userProfile?.username) {
      setNewUsername(userProfile.username)
    }
  }, [userProfile])

  const examsQuery = useMemoFirebase(() => {
    if (!user) return null
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

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newUsername.trim()) return
    
    setIsUpdatingProfile(true)
    try {
      const userRef = doc(db, "users", user.uid)
      await updateDoc(userRef, {
        username: newUsername.trim()
      })
      toast({ title: "Profile Updated", description: "Your username has been successfully synchronized." })
      setIsEditingProfile(false)
    } catch (e: any) {
      toast({ title: "Update Error", description: e.message, variant: "destructive" })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleReview = async (res: any) => {
    setReviewResult(res)
    setReviewQuestions([]) 
    setLoadingReview(true)
    try {
      const qRef = collection(db, `exams/${res.examId}/questions`)
      const qSnap = await getDocs(qRef)
      const qs = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setReviewQuestions(qs)
    } catch (e: any) {
      toast({ title: "Review Error", description: "Could not fetch assessment questions for review.", variant: "destructive" })
    } finally {
      setLoadingReview(false)
    }
  }

  const getSafeDate = (dateVal: any) => {
    if (!dateVal) return null;
    if (dateVal.toDate) return dateVal.toDate();
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }

  const stats = {
    totalTaken: results?.length || 0,
    avgScore: results?.length 
      ? Math.round(results.reduce((acc, res) => acc + (res.score || 0), 0) / results.length) 
      : 0,
    latestScore: results?.length ? results[results.length - 1].score : 0,
    flags: results?.filter(r => r.integrityStatus === 'Flagged').length || 0
  }

  // Hydration-safe loading logic
  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium">Initialising Interface...</p>
      </div>
    )
  }

  if (isUserLoading || profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4" suppressHydrationWarning>
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
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-xs font-bold text-primary group transition-all">
              <CircleUser className="w-4 h-4" />
              <span>{displayName}</span>
              <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 rounded-full hover:bg-primary/10">
                    <Settings className="w-3 h-3 text-primary/60" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem]">
                  <DialogHeader>
                    <DialogTitle>Edit Identity</DialogTitle>
                    <DialogDescription>Update your display name across the assessment gateway.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateUsername} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username / Display Name</Label>
                      <Input 
                        id="username" 
                        value={newUsername} 
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="rounded-xl h-12"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full h-12 rounded-xl gap-2" disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Identity
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
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
                      const attemptDate = getSafeDate(res.startedAt);

                      return (
                        <div key={res.id} className="p-10 flex flex-col md:flex-row md:items-center justify-between hover:bg-muted/30 transition-all gap-6">
                          <div className="space-y-3 flex-1">
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
                                <span className="text-[10px] uppercase font-bold">
                                  {attemptDate ? format(attemptDate, 'MMM dd, yyyy @ hh:mm a') : 'Unknown Date'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-5xl font-black text-primary">{res.score || 0}%</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2">Calculated Score</p>
                            </div>
                            <Button 
                              variant="outline" 
                              className="rounded-2xl gap-2 h-14 px-6 border-primary/20 hover:bg-primary/5 hover:border-primary/40"
                              onClick={() => handleReview(res)}
                              disabled={!res.correctAnswers}
                            >
                              <Eye className="w-4 h-4" /> Review
                            </Button>
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

      <Dialog open={!!reviewResult} onOpenChange={(open) => !open && setReviewResult(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-8 border-b bg-muted/20 shrink-0">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" /> Session Review
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of your performance for <strong>{reviewResult?.examTitle}</strong>. All questions are displayed below with correct answers.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-8 min-h-0">
            {loadingReview ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-bold">Fetching secure assessment data...</p>
              </div>
            ) : (
              <>
                {reviewQuestions.map((q, idx) => {
                  const studentChoice = reviewResult?.responses?.[q.id];
                  const correctChoice = reviewResult?.correctAnswers?.[q.id];
                  const isCorrect = studentChoice === correctChoice;
                  const isSkipped = studentChoice === undefined;

                  return (
                    <Card key={q.id} className={cn(
                      "border-none shadow-sm rounded-3xl overflow-hidden",
                      isCorrect ? "bg-emerald-500/5 ring-1 ring-emerald-500/20" : "bg-destructive/5 ring-1 ring-destructive/20"
                    )}>
                      <CardHeader className="p-6">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">Question {idx + 1}</Badge>
                          <Badge variant={isCorrect ? 'default' : 'destructive'} className={cn(
                            "rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest gap-1",
                            isCorrect ? "bg-emerald-500" : ""
                          )}>
                            {isCorrect ? <Check className="w-3 h-3" /> : (isSkipped ? <AlertTriangle className="w-3 h-3" /> : <X className="w-3 h-3" />)}
                            {isCorrect ? 'Correct' : (isSkipped ? 'Skipped' : 'Incorrect')}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg font-bold">{q.questionText}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 pt-0 space-y-3">
                        {q.options.map((opt: string, oIdx: number) => {
                          const isStudentOption = studentChoice === oIdx;
                          const isCorrectOption = correctChoice === oIdx;

                          return (
                            <div 
                              key={oIdx} 
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-2xl border transition-all",
                                isCorrectOption ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-sm" : "bg-background border-border/50",
                                isStudentOption && !isCorrectOption ? "bg-destructive/10 border-destructive/30 ring-1 ring-destructive/20" : ""
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs",
                                isCorrectOption ? "bg-emerald-500 text-white" : 
                                isStudentOption ? "bg-destructive text-white" : "bg-muted text-muted-foreground"
                              )}>
                                {String.fromCharCode(65 + oIdx)}
                              </div>
                              <span className={cn(
                                "flex-1 text-sm font-medium",
                                isCorrectOption ? "text-emerald-700 font-bold" : 
                                isStudentOption ? "text-destructive font-bold" : "text-foreground/70"
                              )}>
                                {opt}
                              </span>
                              {isCorrectOption && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                              {isStudentOption && !isCorrectOption && <XCircle className="w-5 h-5 text-destructive" />}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
                {reviewQuestions.length === 0 && (
                  <div className="py-20 text-center text-muted-foreground italic">
                    No questions found for this assessment.
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="p-8 border-t bg-muted/20 flex justify-end shrink-0">
            <Button className="px-8 rounded-2xl h-12 font-bold" onClick={() => setReviewResult(null)}>Close Review</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
