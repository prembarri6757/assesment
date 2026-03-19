
"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, ShieldAlert, CheckCircle2, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore"

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()
  const containerRef = useScrollReveal()

  // Firestore Hooks
  const examRef = useMemoFirebase(() => doc(db, "exams", id), [db, id])
  const { data: exam } = useDoc(examRef)
  
  const questionsQuery = useMemoFirebase(() => collection(db, `exams/${id}/questions`), [db, id])
  const { data: questions } = useCollection(questionsQuery)

  // Local State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isFlagged, setIsFlagged] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const [resultId, setResultId] = useState<string | null>(null)

  // Initial Sync: Create Result document when started
  const initializeExam = async () => {
    if (!user || !exam) return
    const newResultId = doc(collection(db, "results")).id
    setResultId(newResultId)
    
    await setDoc(doc(db, "results", newResultId), {
      id: newResultId,
      studentId: user.uid,
      studentEmail: user.email,
      examId: exam.id,
      examTitle: exam.title,
      score: 0,
      startedAt: serverTimestamp(),
      integrityStatus: 'Clean',
      answers: {}
    })
    
    setIsStarted(true)
    setTimeLeft(exam.timeLimitMinutes * 60)
    
    // Request Fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
      }
    } catch (e) {
      console.warn("Fullscreen request failed")
    }
  }

  // Auto-Save Effect
  useEffect(() => {
    if (isStarted && !isFinished && resultId && Object.keys(answers).length > 0) {
      const resultRef = doc(db, "results", resultId)
      // Non-blocking update
      setDoc(resultRef, { answers }, { merge: true })
      // LocalStorage backup
      localStorage.setItem(`exam_draft_${id}`, JSON.stringify(answers))
    }
  }, [answers, isStarted, isFinished, resultId, db, id])

  const finishExam = useCallback(async () => {
    if (isFinished || !resultId || !exam || !questions) return
    setIsFinished(true)

    // Calculate score
    let correctCount = 0
    questions.forEach(q => {
      if (answers[q.id] === q.correctOptionIndex) {
        correctCount++
      }
    })
    const finalScore = Math.round((correctCount / questions.length) * 100)

    await setDoc(doc(db, "results", resultId), {
      score: finalScore,
      completedAt: serverTimestamp(),
      integrityStatus: isFlagged ? 'Flagged' : 'Clean'
    }, { merge: true })

    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }, [isFinished, resultId, exam, questions, answers, isFlagged, db])

  // Anti-Cheat: Tab switching detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isStarted && !isFinished) {
        setIsFlagged(true)
        if (resultId) {
          setDoc(doc(db, "results", resultId), { integrityStatus: 'Flagged' }, { merge: true })
        }
        toast({
          title: "SECURITY ALERT",
          description: "Unauthorized window switching detected. This session has been flagged.",
          variant: "destructive"
        })
      }
    }

    const handleFocusLoss = () => {
      if (isStarted && !isFinished) {
        setIsFlagged(true)
      }
    }

    if (isStarted && !isFinished) {
      document.addEventListener("visibilitychange", handleVisibilityChange)
      window.addEventListener("blur", handleFocusLoss)
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleFocusLoss)
    }
  }, [isStarted, isFinished, resultId, db, toast])

  // Timer
  useEffect(() => {
    if (!isStarted || isFinished || timeLeft <= 0) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          finishExam()
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
    if (questions && currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1)
    } else {
      finishExam()
    }
  }

  if (!exam || !questions) return <div className="min-h-screen flex items-center justify-center">Loading assessment vault...</div>

  if (!isStarted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-xl w-full glass-card animate-in zoom-in-95 duration-500">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="text-primary w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-bold">{exam.title}</CardTitle>
            <p className="text-muted-foreground mt-2">{exam.description}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg text-center bg-muted/30">
                <p className="text-xs font-bold uppercase text-muted-foreground">Time Limit</p>
                <p className="text-xl font-bold">{exam.timeLimitMinutes} Minutes</p>
              </div>
              <div className="p-4 border rounded-lg text-center bg-muted/30">
                <p className="text-xs font-bold uppercase text-muted-foreground">Total Questions</p>
                <p className="text-xl font-bold">{questions.length}</p>
              </div>
            </div>
            <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 text-xs text-destructive flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>Critical: This exam is proctored. Switching tabs or loss of focus will result in an immediate integrity violation report. Fullscreen mode will be requested.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={initializeExam} className="w-full btn-premium py-6 text-lg">
              <Lock className="w-4 h-4 mr-2" /> Begin Secure Session
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  if (isFinished) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-xl w-full glass-card animate-in slide-in-from-bottom duration-500">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="text-emerald-500 w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-bold">Session Finalized</CardTitle>
            <p className="text-muted-foreground mt-2">Your results have been synced to the primary gateway.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={isFlagged ? "destructive" : "default"}>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Integrity Analysis: {isFlagged ? 'Flagged' : 'Verified'}</AlertTitle>
              <AlertDescription>
                {isFlagged 
                  ? "Unauthorized environment changes were detected. Your logs are under review."
                  : "Session completed with a clean integrity status."}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard/student')} className="w-full">
              Return to Portal
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  const currentQuestion = questions[currentQuestionIdx]
  const progress = ((currentQuestionIdx) / questions.length) * 100

  return (
    <div ref={containerRef} className="min-h-screen bg-background select-none">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
               <ShieldAlert className="text-primary-foreground w-5 h-5" />
             </div>
             <div className="hidden sm:block">
               <p className="font-bold text-sm leading-none">{exam.title}</p>
               <p className="text-[10px] text-muted-foreground mt-1">Question {currentQuestionIdx + 1} of {questions.length}</p>
             </div>
          </div>
          <div className={`px-4 py-2 rounded-lg font-mono text-xl border transition-all duration-500 ${timeLeft < 60 ? 'bg-destructive/10 border-destructive text-destructive pulse-warning' : 'bg-muted border-border'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none bg-muted" />
      </header>

      <main className="container mx-auto max-w-4xl p-4 sm:p-12">
        <Card className="reveal-up glass-card shadow-2xl border-none">
          <CardContent className="p-8 sm:p-12 space-y-8">
            <div className="space-y-2">
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">Active Question</Badge>
              <h2 className="text-2xl font-bold leading-tight">{currentQuestion.questionText}</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {currentQuestion.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setAnswers({...answers, [currentQuestion.id]: idx})}
                  className={`flex items-center gap-4 p-5 rounded-xl border text-left transition-all duration-200 group ${
                    answers[currentQuestion.id] === idx 
                      ? 'bg-primary/5 border-primary shadow-sm' 
                      : 'hover:bg-muted/50 border-transparent hover:border-border'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    answers[currentQuestion.id] === idx 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
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
            <p className="text-xs text-muted-foreground italic">Draft synced to vault.</p>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx(p => p - 1)}
              >
                Previous
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={answers[currentQuestion.id] === undefined}
                className="btn-premium px-8"
              >
                {currentQuestionIdx === questions.length - 1 ? 'Finish Assessment' : 'Next Question'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
