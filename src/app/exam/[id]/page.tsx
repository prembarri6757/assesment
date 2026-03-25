
"use client"

import { useState, useEffect, useCallback, use, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, ShieldAlert, CheckCircle2, Lock, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, getDoc } from "firebase/firestore"

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()
  const containerRef = useScrollReveal()

  // Firestore Hooks - gated by user session
  const examRef = useMemoFirebase(() => {
    if (!user) return null
    return doc(db, "exams", id)
  }, [db, id, user])
  const { data: exam, isLoading: examLoading } = useDoc(examRef)
  
  const questionsQuery = useMemoFirebase(() => {
    if (!user) return null
    return collection(db, `exams/${id}/questions`)
  }, [db, id, user])
  const { data: rawQuestions, isLoading: questionsLoading } = useCollection(questionsQuery)

  // Local State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isFlagged, setIsFlagged] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const [resultId, setResultId] = useState<string | null>(null)
  const [shuffledQuestions, setShuffledQuestions] = useState<any[] | null>(null)

  /**
   * Fisher-Yates Shuffle Algorithm
   * Ensures a truly randomized distribution of questions for every attempt.
   */
  const shuffleQuestions = (array: any[]) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const initializeExam = async () => {
    if (!user || !exam || !rawQuestions) return
    
    // Safety check: Don't allow starting if it's a draft
    if (exam.status === 'draft') {
      toast({ title: "Access Denied", description: "This assessment is currently in draft mode.", variant: "destructive" })
      router.push('/dashboard/student')
      return
    }

    // Fetch user profile to get username
    const userDocRef = doc(db, "users", user.uid)
    const userSnap = await getDoc(userDocRef)
    const userData = userSnap.data()
    const studentUsername = userData?.username || user.email?.split('@')[0] || "Scholar"

    // RANDOMIZE questions for this specific session
    setShuffledQuestions(shuffleQuestions(rawQuestions))

    const newResultId = doc(collection(db, "users", user.uid, "results")).id
    setResultId(newResultId)
    
    const resultRef = doc(db, "users", user.uid, "results", newResultId)
    // Initialize the result document in Firestore
    setDoc(resultRef, {
      id: newResultId,
      studentId: user.uid,
      studentEmail: user.email,
      studentUsername: studentUsername,
      examId: exam.id,
      examTitle: exam.title,
      startedAt: serverTimestamp(),
      integrityStatus: 'Clean',
      totalQuestions: rawQuestions.length,
      responses: {}
    }).catch((e) => {
      console.error("Session sync failed:", e)
    })
    
    setIsStarted(true)
    setTimeLeft(exam.timeLimitMinutes * 60)
    
    // Attempt to enforce Fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch (e) {
      console.warn("Fullscreen request failed. This may happen if not triggered by user interaction or browser policy.")
    }
  }

  // Auto-Save Effect: Syncs responses to Firestore as the student progresses
  useEffect(() => {
    if (isStarted && !isFinished && resultId && user && Object.keys(answers).length > 0) {
      const resultRef = doc(db, "users", user.uid, "results", resultId)
      setDoc(resultRef, { responses: answers }, { merge: true }).catch(() => {})
    }
  }, [answers, isStarted, isFinished, resultId, db, user])

  const finishExam = useCallback(async () => {
    if (isFinished || !resultId || !user) return
    setIsFinished(true)

    const resultRef = doc(db, "users", user.uid, "results", resultId)
    setDoc(resultRef, {
      completedAt: serverTimestamp(),
      integrityStatus: isFlagged ? 'Flagged' : 'Clean'
    }, { merge: true }).catch(() => {})

    // Exit Fullscreen on completion
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    toast({
      title: "Assessment Completed",
      description: "Your responses have been securely submitted.",
    })
  }, [isFinished, resultId, isFlagged, db, user, toast])

  // ANTI-CHEAT: Exit prevention and Focus tracking
  useEffect(() => {
    if (!isStarted || isFinished) return

    const handleProctoringViolation = () => {
      if (isFinished) return
      setIsFlagged(true)
      if (resultId && user) {
        const resultRef = doc(db, "users", user.uid, "results", resultId)
        setDoc(resultRef, { integrityStatus: 'Flagged' }, { merge: true }).catch(() => {})
      }
      toast({
        title: "SECURITY ALERT",
        description: "Focus loss or window minimize detected. Your session has been flagged.",
        variant: "destructive"
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleProctoringViolation()
      }
    }

    const handleBlur = () => {
      handleProctoringViolation()
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleProctoringViolation()
        toast({
          title: "PROCTORING ALERT",
          description: "Exiting full-screen is prohibited during active assessments.",
          variant: "destructive"
        })
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "Exiting the test will result in a flag. Are you sure?"
      return e.returnValue
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isStarted, isFinished, resultId, db, toast, user])

  // Timer Countdown Logic with AUTO-SUBMIT
  useEffect(() => {
    if (!isStarted || isFinished || timeLeft <= 0) {
      if (isStarted && timeLeft <= 0 && !isFinished) {
        finishExam()
      }
      return
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          finishExam() // AUTO-SUBMIT on timer completion
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isStarted, isFinished, timeLeft, finishExam])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleNext = () => {
    if (shuffledQuestions && currentQuestionIdx < shuffledQuestions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1)
    } else {
      finishExam()
    }
  }

  if (examLoading || questionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">Accessing Secure Vault...</p>
        </div>
      </div>
    )
  }

  if (!exam || !rawQuestions) return <div className="min-h-screen flex items-center justify-center">Assessment unavailable.</div>

  if (!isStarted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-xl w-full glass-card">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto text-primary w-12 h-12 mb-4" />
            <CardTitle className="text-2xl font-bold">{exam.title}</CardTitle>
            <p className="text-muted-foreground mt-2">{exam.description}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg text-center bg-muted/30">
                <p className="text-xs font-bold uppercase text-muted-foreground">Time Limit</p>
                <p className="text-xl font-bold">{exam.timeLimitMinutes} Min</p>
              </div>
              <div className="p-4 border rounded-lg text-center bg-muted/30">
                <p className="text-xs font-bold uppercase text-muted-foreground">Questions</p>
                <p className="text-xl font-bold">{rawQuestions.length}</p>
              </div>
            </div>
            <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 text-xs text-destructive flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">ZERO-TRUST PROTOCOL ACTIVE</p>
                <p>1. Full-screen mode is mandatory.</p>
                <p>2. Minimizing the window or switching tabs will flag your session.</p>
                <p>3. The test will auto-submit exactly when the timer hits zero.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="button" onClick={initializeExam} className="w-full btn-premium py-6 text-lg">
              <Lock className="w-4 h-4 mr-2" /> Start Secure Session
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  if (isFinished) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-xl w-full glass-card">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto text-emerald-500 w-12 h-12 mb-4" />
            <CardTitle className="text-2xl font-bold">Session Finalized</CardTitle>
            <p className="text-muted-foreground mt-2">Your responses have been synced to the vault. Grading will be performed by the primary gateway.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={isFlagged ? "destructive" : "default"}>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Integrity Status: {isFlagged ? 'Flagged' : 'Secure'}</AlertTitle>
              <AlertDescription>
                {isFlagged 
                  ? "Proctoring violations were detected during your session. This attempt is under review." 
                  : "No integrity issues were detected. Your submission is verified."}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button type="button" onClick={() => router.push('/dashboard/student')} className="w-full">Return to Dashboard</Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  const currentQuestion = shuffledQuestions ? shuffledQuestions[currentQuestionIdx] : null
  const progress = shuffledQuestions ? ((currentQuestionIdx) / shuffledQuestions.length) * 100 : 0

  if (!currentQuestion) return null

  return (
    <div ref={containerRef} className="min-h-screen bg-background select-none">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="hidden sm:block">
               <p className="font-bold text-sm">{exam.title}</p>
               <p className="text-[10px] text-muted-foreground">Question {currentQuestionIdx + 1} of {shuffledQuestions?.length}</p>
             </div>
          </div>
          <div className={`px-4 py-2 rounded-lg font-mono text-xl border transition-all duration-500 ${timeLeft < 60 ? 'bg-destructive/10 border-destructive text-destructive animate-pulse' : 'bg-muted'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none bg-muted" />
      </header>

      <main className="container mx-auto max-w-4xl p-4 sm:p-12">
        <Card className="glass-card shadow-2xl border-none">
          <CardContent className="p-8 sm:p-12 space-y-8">
            <div className="space-y-2">
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">Active Question</Badge>
              <h2 className="text-2xl font-bold leading-tight">{currentQuestion.questionText}</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {currentQuestion.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAnswers({...answers, [currentQuestion.id]: idx})}
                  className={`flex items-center gap-4 p-5 rounded-xl border text-left transition-all duration-200 group ${
                    answers[currentQuestion.id] === idx 
                      ? 'bg-primary/5 border-primary shadow-sm' 
                      : 'hover:bg-muted/50 border-transparent hover:border-border'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    answers[currentQuestion.id] === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className={`text-lg font-medium ${answers[currentQuestion.id] === idx ? 'text-primary' : 'text-foreground'}`}>
                    {option}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 p-8 flex items-center justify-between">
            <p className="text-xs text-muted-foreground italic">Responses synced securely.</p>
            <div className="flex gap-4">
              <Button type="button" onClick={handleNext} disabled={answers[currentQuestion.id] === undefined} className="btn-premium px-8">
                {shuffledQuestions && currentQuestionIdx === shuffledQuestions.length - 1 ? 'Finalize Session' : 'Save & Next'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
