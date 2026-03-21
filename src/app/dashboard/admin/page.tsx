
"use client"

import { useState, useEffect } from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Plus, 
  LayoutDashboard, 
  FileText, 
  Users, 
  ShieldAlert, 
  Sparkles, 
  Trash2, 
  Save, 
  LogOut, 
  ShieldCheck,
  History,
  Menu,
  ChevronRight,
  UserCog,
  UserPlus,
  CircleCheck,
  X,
  AlertTriangle,
  Edit2,
  Loader2,
  Settings,
  Shield,
  Calculator,
  Target
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, collectionGroup, getDocs, updateDoc } from "firebase/firestore"
import { generateQuestionIdeas, type GenerateQuestionIdeasOutput } from "@/ai/flows/admin-question-idea-generator"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { useAuth } from "@/firebase"
import { signOut, createUserWithEmailAndPassword } from "firebase/auth"
import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function AdminDashboard() {
  const containerRef = useScrollReveal()
  const db = useFirestore()
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState("overview")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiIdeas, setAiIdeas] = useState<GenerateQuestionIdeasOutput | null>(null)
  const [topic, setTopic] = useState("")
  const [examToDelete, setExamToDelete] = useState<string | null>(null)
  
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [newStudent, setNewStudent] = useState({ email: "", password: "", username: "", role: "student" as "student" | "admin" })
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [isGrading, setIsGrading] = useState<string | null>(null)
  const [isGradingAll, setIsGradingAll] = useState(false)

  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    timeLimitMinutes: 30,
    passingScore: 70
  })
  const [examQuestions, setExamQuestions] = useState<any[]>([])

  const adminRoleRef = useMemoFirebase(() => {
    if (!user) return null
    return doc(db, "admin_roles", user.uid)
  }, [db, user])
  const { data: adminRole, isLoading: adminRoleLoading } = useDoc(adminRoleRef)

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/')
    }
  }, [user, isUserLoading, router])

  // Gated queries: only run after user is authenticated AND admin clearance is verified
  const examsQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return collection(db, "exams")
  }, [db, user, adminRole])
  const { data: exams, isLoading: examsLoading } = useCollection(examsQuery)

  const resultsQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return query(collectionGroup(db, "results"))
  }, [db, user, adminRole])
  const { data: results, isLoading: resultsLoading } = useCollection(resultsQuery)

  const usersQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return collection(db, "users")
  }, [db, user, adminRole])
  const { data: allUsers, isLoading: usersLoading } = useCollection(usersQuery)

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/')
  }

  const handleGradeResult = async (res: any) => {
    if (!adminRole) return;
    setIsGrading(res.id);
    try {
      const answersRef = collection(db, `exams/${res.examId}/answers`);
      const answersSnap = await getDocs(answersRef);
      const answerKey: Record<string, number> = {};
      answersSnap.forEach(doc => {
        answerKey[doc.id] = doc.data().correctOptionIndex;
      });

      let correct = 0;
      const total = Object.keys(answerKey).length;
      if (res.responses) {
        Object.entries(res.responses).forEach(([qId, selectedIdx]) => {
          if (answerKey[qId] === selectedIdx) {
            correct++;
          }
        });
      }

      const score = total > 0 ? Math.round((correct / total) * 100) : 0;

      const resultRef = doc(db, "users", res.studentId, "results", res.id);
      await updateDoc(resultRef, {
        score,
        correctCount: correct,
        totalQuestions: total,
        gradedAt: serverTimestamp()
      });

      toast({ title: "Grading Finalized", description: `Computed score: ${correct}/${total} (${score}%)` });
    } catch (e: any) {
      toast({ title: "Grading Error", description: e.message, variant: "destructive" });
    } finally {
      setIsGrading(null);
    }
  };

  const handleGradeAll = async () => {
    if (!adminRole || !results || results.length === 0) return;
    setIsGradingAll(true);
    let successCount = 0;
    try {
      // Group results by examId to fetch answers only once per exam for efficiency
      const resultsByExam: Record<string, any[]> = {};
      results.forEach(res => {
        if (!resultsByExam[res.examId]) resultsByExam[res.examId] = [];
        resultsByExam[res.examId].push(res);
      });

      for (const examId in resultsByExam) {
        // Fetch answer key once for this exam
        const answersRef = collection(db, `exams/${examId}/answers`);
        const answersSnap = await getDocs(answersRef);
        const answerKey: Record<string, number> = {};
        answersSnap.forEach(doc => {
          answerKey[doc.id] = doc.data().correctOptionIndex;
        });
        const total = Object.keys(answerKey).length;

        // Grade all results for this exam
        for (const res of resultsByExam[examId]) {
          let correct = 0;
          if (res.responses) {
            Object.entries(res.responses).forEach(([qId, selectedIdx]) => {
              if (answerKey[qId] === selectedIdx) {
                correct++;
              }
            });
          }
          const score = total > 0 ? Math.round((correct / total) * 100) : 0;
          const resultRef = doc(db, "users", res.studentId, "results", res.id);
          await updateDoc(resultRef, {
            score,
            correctCount: correct,
            totalQuestions: total,
            gradedAt: serverTimestamp()
          });
          successCount++;
        }
      }
      toast({ title: "Bulk Grading Complete", description: `Successfully processed ${successCount} attempts.` });
    } catch (e: any) {
      toast({ title: "Bulk Grading Error", description: e.message, variant: "destructive" });
    } finally {
      setIsGradingAll(false);
    }
  };

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!topic) return
    setIsGenerating(true)
    try {
      const ideas = await generateQuestionIdeas({ topic, difficultyLevel: 'medium' })
      setAiIdeas(ideas)
    } catch (error: any) {
      toast({ title: "AI Generation Failed", description: error.message, variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const addQuestion = (q?: any) => {
    const formatted = {
      id: "q-" + Date.now().toString() + Math.random().toString(36).substr(2, 5),
      questionText: q?.questionText || "",
      options: q?.suggestedOptions || q?.options || ["", "", "", ""],
      correctOptionIndex: q?.correctOptionIndex || 0
    }
    setExamQuestions(prev => [...prev, formatted])
  }

  const removeQuestion = (id: string) => {
    setExamQuestions(prev => prev.filter(q => q.id !== id))
  }

  const updateQuestion = (id: string, field: string, value: any) => {
    setExamQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  const addOption = (qId: string) => {
    setExamQuestions(prev => prev.map(q => {
      if (q.id === qId && q.options.length < 5) {
        return { ...q, options: [...q.options, ""] }
      }
      return q
    }))
  }

  const removeOption = (qId: string, oIdx: number) => {
    setExamQuestions(prev => prev.map(q => {
      if (q.id === qId && q.options.length > 2) {
        const newOptions = q.options.filter((_: any, i: number) => i !== oIdx)
        const newCorrectIndex = q.correctOptionIndex >= oIdx ? Math.max(0, q.correctOptionIndex - 1) : q.correctOptionIndex
        return { ...q, options: newOptions, correctOptionIndex: newCorrectIndex }
      }
      return q
    }))
  }

  const handleDeleteExam = async () => {
    if (!examToDelete) return
    try {
      await deleteDoc(doc(db, "exams", examToDelete))
      toast({ title: "Assessment Deleted", description: "The exam has been removed from the vault." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setExamToDelete(null)
    }
  }

  const handleSaveExam = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!user) return
    if (!newExam.title || examQuestions.length === 0) {
      toast({ title: "Validation Error", description: "Exam must have a title and questions.", variant: "destructive" })
      return
    }

    const examId = doc(collection(db, "exams")).id
    const examRef = doc(db, "exams", examId)

    setDoc(examRef, {
      ...newExam,
      id: examId,
      createdBy: user.uid,
      createdAt: serverTimestamp()
    }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: examRef.path,
        operation: 'create',
        requestResourceData: newExam
      }))
    })

    examQuestions.forEach(q => {
      const qId = doc(collection(db, `exams/${examId}/questions`)).id
      const publicQRef = doc(db, `exams/${examId}/questions`, qId)
      const privateARef = doc(db, `exams/${examId}/answers`, qId)

      setDoc(publicQRef, {
        id: qId,
        examId,
        questionText: q.questionText,
        options: q.options
      })

      setDoc(privateARef, {
        id: qId,
        correctOptionIndex: q.correctOptionIndex
      })
    })

    toast({ title: "Success", description: "Assessment published to the secure vault." })
    setNewExam({ title: "", description: "", timeLimitMinutes: 30, passingScore: 70 })
    setExamQuestions([])
    setActiveTab("exams")
  }

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProvisioning(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newStudent.email, newStudent.password)
      const newUser = userCredential.user

      await setDoc(doc(db, "users", newUser.uid), {
        id: newUser.uid,
        email: newUser.email,
        username: newStudent.username,
        role: newStudent.role,
        createdAt: serverTimestamp()
      })

      if (newStudent.role === 'admin') {
        await setDoc(doc(db, "admin_roles", newUser.uid), {
          uid: newUser.uid,
          createdAt: serverTimestamp()
        })
      }

      toast({ title: "User Provisioned", description: `Account created for ${newStudent.username}.` })
      setNewStudent({ email: "", password: "", username: "", role: "student" })
    } catch (error: any) {
      toast({ title: "Provisioning Error", description: error.message, variant: "destructive" })
    } finally {
      setIsProvisioning(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const userRef = doc(db, "users", editingUser.id)
    const adminMarkerRef = doc(db, "admin_roles", editingUser.id)

    try {
      await setDoc(userRef, {
        username: editingUser.username,
        role: editingUser.role
      }, { merge: true })

      if (editingUser.role === 'admin') {
        await setDoc(adminMarkerRef, {
          uid: editingUser.id,
          createdAt: serverTimestamp()
        }, { merge: true })
      } else {
        await deleteDoc(adminMarkerRef)
      }

      toast({ title: "User Updated", description: "The system roster has been synchronized." })
      setEditingUser(null)
    } catch (error: any) {
      toast({ title: "Update Error", description: error.message, variant: "destructive" })
    }
  }

  if (isUserLoading || adminRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  if (!user || !adminRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Admin clearance required.</p>
          <Button onClick={() => router.push('/')}>Return Home</Button>
        </div>
      </div>
    )
  }

  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "exams", label: "Assessment Vault", icon: FileText },
    { id: "authoring", label: "Exam Builder", icon: Sparkles },
    { id: "students", label: "User Management", icon: UserCog },
    { id: "audit", label: "Audit Logs", icon: History },
  ]

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex">
      <aside className={cn(
        "bg-card border-r transition-all duration-300 hidden md:flex flex-col z-50",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <ShieldCheck className="text-primary w-8 h-8" />
          {isSidebarOpen && <span className="font-bold text-lg">Admin Gate</span>}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2">
          <ModeToggle />
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 text-destructive" />
            {isSidebarOpen && <span>Secure Logout</span>}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex">
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-bold text-lg capitalize">{activeTab}</h2>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">System Live</Badge>
        </header>

        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "Active Exams", value: exams?.length, icon: FileText, color: "text-blue-500", loading: examsLoading },
                  { label: "User Base", value: allUsers?.length, icon: Users, color: "text-indigo-500", loading: usersLoading },
                  { label: "Total Attempts", value: results?.length, icon: ShieldCheck, color: "text-emerald-500", loading: resultsLoading },
                  { label: "Integrity Alerts", value: results?.filter(r => r.integrityStatus === 'Flagged').length, icon: ShieldAlert, color: "text-red-500", loading: resultsLoading },
                ].map((stat, i) => (
                  <Card key={i} className="border-none shadow-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                        {stat.loading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <p className="text-3xl font-extrabold">{stat.value ?? 0}</p>}
                      </div>
                      <stat.icon className={cn("w-8 h-8", stat.color)} />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Content Idea Lab</CardTitle>
                    <CardDescription>Generate assessment patterns using AI.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <Input placeholder="e.g. Cybersecurity" value={topic} onChange={(e) => setTopic(e.target.value)} />
                      <Button onClick={handleGenerate} disabled={isGenerating || !topic}>{isGenerating ? "Reasoning..." : "Generate"}</Button>
                    </div>
                    {aiIdeas && (
                      <ScrollArea className="h-64 rounded-xl border p-4">
                        <div className="space-y-4">
                          {aiIdeas.questions.map((q, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-muted border group flex items-center justify-between">
                              <p className="font-bold text-sm">{q.questionText}</p>
                              <Button variant="outline" size="sm" className="h-8" onClick={() => { addQuestion(q); setActiveTab("authoring"); }}>
                                Import <Plus className="ml-1 w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Assessments</CardTitle>
                    <CardDescription>Direct access to published exam data.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      {examsLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                      ) : (
                        <div className="space-y-3">
                          {exams?.map((exam) => (
                            <div key={exam.id} className="flex items-center justify-between p-4 rounded-xl bg-muted border">
                              <div className="space-y-0.5">
                                <p className="text-sm font-bold">{exam.title}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{exam.timeLimitMinutes} min limit</p>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => setActiveTab('exams')}><ChevronRight className="w-4 h-4" /></Button>
                            </div>
                          ))}
                          {(!exams || exams.length === 0) && <p className="text-center text-muted-foreground p-8">No assessments found.</p>}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-bold">Assessment Vault</h2>
                 <Button onClick={() => setActiveTab('authoring')} className="gap-2"><Plus className="w-4 h-4" /> New Exam</Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {examsLoading ? (
                   <div className="col-span-full flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                 ) : (
                   exams?.map((exam) => (
                     <Card key={exam.id} className="hover:border-primary transition-all">
                       <CardHeader>
                         <CardTitle className="text-lg">{exam.title}</CardTitle>
                         <CardDescription className="line-clamp-2">{exam.description}</CardDescription>
                       </CardHeader>
                       <CardContent className="flex items-center justify-between bg-muted/20 py-4 mt-4">
                          <span className="text-xs font-bold text-muted-foreground uppercase">Pass: {exam.passingScore}%</span>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setExamToDelete(exam.id)}>
                            <Trash2 className="w-4 h-4" /> Delete
                          </Button>
                       </CardContent>
                     </Card>
                   ))
                 )}
                 {(!exams || exams.length === 0) && !examsLoading && (
                   <div className="col-span-full text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                      <p className="text-muted-foreground">No assessments published to the vault yet.</p>
                   </div>
                 )}
               </div>
            </div>
          )}

          {activeTab === 'authoring' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="space-y-2">
                 <h2 className="text-3xl font-bold">Exam Builder</h2>
                 <p className="text-muted-foreground">Author secure multiple-choice assessments with AI assistance.</p>
               </div>

               <Card className="border-none shadow-sm p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Exam Title</Label>
                      <Input value={newExam.title} onChange={e => setNewExam({...newExam, title: e.target.value})} placeholder="e.g. Cybersecurity Fundamentals" />
                    </div>
                    <div className="space-y-2">
                      <Label>Time Limit (Min)</Label>
                      <Input type="number" value={newExam.timeLimitMinutes} onChange={e => setNewExam({...newExam, timeLimitMinutes: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Instructions / Description</Label>
                      <Textarea value={newExam.description} onChange={e => setNewExam({...newExam, description: e.target.value})} placeholder="Provide clear instructions for students..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Passing Score (%)</Label>
                      <Input type="number" value={newExam.passingScore} onChange={e => setNewExam({...newExam, passingScore: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>
               </Card>

               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold">Questions</h3>
                 </div>

                 <div className="space-y-6 pb-24">
                   {examQuestions.map((q, idx) => (
                     <Card key={q.id} className="shadow-sm border-none overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between py-4 bg-muted/20">
                          <Badge className="bg-primary hover:bg-primary/90 px-4 py-1 rounded-full text-sm font-medium">Question {idx + 1}</Badge>
                          <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6 bg-card">
                          <div className="space-y-3">
                            <Label className="text-sm font-bold text-foreground/80 uppercase tracking-tight">Question Text</Label>
                            <Input 
                              value={q.questionText} 
                              onChange={e => updateQuestion(q.id, 'questionText', e.target.value)}
                              className="bg-muted/30 border-muted-foreground/20 rounded-xl h-12 focus:bg-background transition-all"
                            />
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2 mb-4">
                              <Label className="text-sm font-bold text-foreground/80 uppercase tracking-tight">Options</Label>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground/60 border-muted-foreground/20 px-3 py-1">Select Correct</Badge>
                            </div>
                            <RadioGroup value={q.correctOptionIndex.toString()} onValueChange={v => updateQuestion(q.id, 'correctOptionIndex', parseInt(v))} className="grid grid-cols-1 gap-3">
                              {q.options.map((opt: string, oIdx: number) => (
                                <div key={oIdx} className={cn(
                                  "flex items-center gap-3 p-2 pr-4 rounded-xl border transition-all duration-300", 
                                  q.correctOptionIndex === oIdx 
                                    ? "bg-emerald-500/5 border-emerald-500/50 shadow-sm" 
                                    : "bg-muted/10 border-transparent hover:border-muted-foreground/20"
                                )}>
                                  <div className="pl-3">
                                    <RadioGroupItem value={oIdx.toString()} id={`q${idx}-o${oIdx}`} className="h-5 w-5" />
                                  </div>
                                  <Input 
                                    value={opt} 
                                    onChange={e => {
                                      const opts = [...q.options]
                                      opts[oIdx] = e.target.value
                                      updateQuestion(q.id, 'options', opts)
                                    }}
                                    className="border-none bg-transparent shadow-none focus-visible:ring-0 p-0 h-10 text-sm font-medium"
                                    placeholder={`Option ${oIdx + 1}`}
                                  />
                                  <div className="flex items-center gap-2">
                                    {q.correctOptionIndex === oIdx && <Badge className="bg-emerald-500 text-white border-none text-[10px] px-2 py-0.5 rounded-md">Correct</Badge>}
                                    {q.options.length > 2 && (
                                      <Button variant="ghost" size="icon" onClick={() => removeOption(q.id, oIdx)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                        <X className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </RadioGroup>
                            <Button type="button" variant="ghost" size="sm" onClick={() => addOption(q.id)} disabled={q.options.length >= 5} className="text-xs font-bold text-primary/80 hover:bg-primary/5 mt-2">
                              + Add Distractor
                            </Button>
                          </div>
                        </CardContent>
                     </Card>
                   ))}
                   {examQuestions.length === 0 && (
                     <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/30">
                       <Sparkles className="w-10 h-10 text-primary/40 mx-auto mb-4" />
                       <p className="text-muted-foreground">Start by appending a question or using the AI Idea Lab.</p>
                     </div>
                   )}
                   <div className="flex justify-center pt-4">
                     <Button variant="outline" onClick={() => addQuestion()} className="gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 px-8">
                       <Plus className="w-4 h-4" /> Append Question
                     </Button>
                   </div>
                 </div>
               </div>

               <div className="fixed bottom-8 right-8 z-50">
                 <Button className="px-10 py-6 text-lg shadow-2xl btn-premium rounded-2xl" onClick={handleSaveExam}>
                   <Save className="w-4 h-4 mr-2" /> Publish Assessment
                 </Button>
               </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-8">
               <div className="flex items-center justify-between">
                 <div className="space-y-1">
                   <h2 className="text-2xl font-bold">System Roster</h2>
                   <p className="text-muted-foreground text-sm">Audit and modify user identities across the gateway.</p>
                 </div>
                 <Dialog>
                   <DialogTrigger asChild>
                     <Button className="gap-2"><UserPlus className="w-4 h-4" /> Provision Identity</Button>
                   </DialogTrigger>
                   <DialogContent>
                     <DialogHeader>
                       <DialogTitle>Provision New User</DialogTitle>
                       <DialogDescription>Create a new secure identity in the gateway roster.</DialogDescription>
                     </DialogHeader>
                     <form onSubmit={handleProvisionUser} className="space-y-4 pt-4">
                        <Input required placeholder="Username" value={newStudent.username} onChange={e => setNewStudent({...newStudent, username: e.target.value})} />
                        <Input required type="email" placeholder="Organization Email" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} />
                        <Input required type="password" placeholder="Temporary Password" value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} />
                        <Select value={newStudent.role} onValueChange={(v: any) => setNewStudent({...newStudent, role: v})}>
                          <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="submit" className="w-full" disabled={isProvisioning}>{isProvisioning ? "Provisioning..." : "Create Account"}</Button>
                     </form>
                   </DialogContent>
                 </Dialog>
               </div>

               <Card className="border-none shadow-sm p-6">
                 {usersLoading ? (
                   <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                 ) : (
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Identity</TableHead>
                         <TableHead>Email Address</TableHead>
                         <TableHead>System Role</TableHead>
                         <TableHead className="text-right">Action</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {allUsers?.map((u) => (
                         <TableRow key={u.id} className="group">
                           <TableCell className="font-bold flex items-center gap-2">
                             {u.username}
                             {u.role === 'admin' && <Shield className="w-3 h-3 text-primary" />}
                           </TableCell>
                           <TableCell>{u.email}</TableCell>
                           <TableCell>
                             <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                               {u.role}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-right">
                             <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                               <Edit2 className="w-3 h-3" />
                             </Button>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 )}
               </Card>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">Audit Logs</h2>
                  <p className="text-muted-foreground text-sm">Detailed tracking of all exam attempts and integrity markers.</p>
                </div>
                <Button 
                  onClick={handleGradeAll} 
                  disabled={isGradingAll || !results || results.length === 0}
                  className="gap-2"
                >
                  {isGradingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  Grade All Results
                </Button>
              </div>
              <Card className="border-none shadow-sm p-6">
                {resultsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Identity</TableHead>
                        <TableHead>Assessment Title</TableHead>
                        <TableHead>Marks Gained</TableHead>
                        <TableHead>Calculated Score</TableHead>
                        <TableHead>Integrity Status</TableHead>
                        <TableHead className="text-right">Grading</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results?.map((res) => (
                        <TableRow key={res.id}>
                          <TableCell className="font-medium">{res.studentEmail}</TableCell>
                          <TableCell>{res.examTitle}</TableCell>
                          <TableCell className="font-mono">
                            {res.correctCount !== undefined ? (
                              <Badge variant="outline" className="gap-1 font-mono">
                                <Target className="w-3 h-3" /> {res.correctCount} / {res.totalQuestions || 0}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">Pending...</span>
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-primary">{res.score || 0}%</TableCell>
                          <TableCell>
                            <Badge variant={res.integrityStatus === 'Clean' ? 'outline' : 'destructive'} className="gap-1">
                              {res.integrityStatus === 'Flagged' && <AlertTriangle className="w-3 h-3" />}
                              {res.integrityStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={isGrading === res.id || isGradingAll}
                              onClick={() => handleGradeResult(res)}
                              className="gap-2"
                            >
                              {isGrading === res.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calculator className="w-3 h-3" />}
                              Grade
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!results || results.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No attempts recorded in the audit logs.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          )}
        </main>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit System Identity</DialogTitle>
            <DialogDescription>Modify the system-level details and permissions for this user.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Username / Display Name</Label>
                <Input value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>System Role</Label>
                <Select value={editingUser.role} onValueChange={(v: any) => setEditingUser({...editingUser, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" type="button" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!examToDelete} onOpenChange={(open) => !open && setExamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Assessment Purge</AlertDialogTitle>
            <AlertDialogDescription>This action will permanently remove the assessment and all associated metadata from the secure vault. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} className="bg-destructive text-destructive-foreground">Purge Data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
