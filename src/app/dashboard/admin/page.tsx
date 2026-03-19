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
  Edit2
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, collectionGroup } from "firebase/firestore"
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
  
  // Provisioning State
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [newStudent, setNewStudent] = useState({ email: "", password: "", username: "", role: "student" as "student" | "admin" })

  // User Management State
  const [editingUser, setEditingUser] = useState<any | null>(null)

  // Exam State
  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    timeLimitMinutes: 30,
    passingScore: 70
  })
  const [examQuestions, setExamQuestions] = useState<any[]>([])

  // Auth Protection
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/')
    }
  }, [user, isUserLoading, router])

  const adminRoleRef = useMemoFirebase(() => {
    if (!user) return null
    return doc(db, "admin_roles", user.uid)
  }, [db, user])
  const { data: adminRole, isLoading: adminRoleLoading } = useDoc(adminRoleRef)

  // System Data
  const examsQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return collection(db, "exams")
  }, [db, user, adminRole])
  const { data: exams } = useCollection(examsQuery)

  const resultsQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return query(collectionGroup(db, "results"))
  }, [db, user, adminRole])
  const { data: results } = useCollection(resultsQuery)

  const usersQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return collection(db, "users")
  }, [db, user, adminRole])
  const { data: allUsers } = useCollection(usersQuery)

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/')
  }

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
      const qId = q.id || doc(collection(db, `exams/${examId}/questions`)).id
      const publicQRef = doc(db, `exams/${examId}/questions`, qId)
      const privateARef = doc(db, `exams/${examId}/answers`, qId)

      setDoc(publicQRef, {
        id: qId,
        examId,
        questionText: q.questionText,
        options: q.options
      }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: publicQRef.path,
          operation: 'create'
        }))
      })

      setDoc(privateARef, {
        id: qId,
        correctOptionIndex: q.correctOptionIndex
      }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: privateARef.path,
          operation: 'create'
        }))
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
    const adminRoleRef = doc(db, "admin_roles", editingUser.id)

    try {
      // Update User Profile
      await setDoc(userRef, {
        username: editingUser.username,
        role: editingUser.role
      }, { merge: true })

      // Manage Admin Role Marker
      if (editingUser.role === 'admin') {
        await setDoc(adminRoleRef, {
          uid: editingUser.id,
          createdAt: serverTimestamp()
        }, { merge: true })
      } else {
        await deleteDoc(adminRoleRef)
      }

      toast({ title: "User Updated", description: "The system roster has been synchronized." })
      setEditingUser(null)
    } catch (error: any) {
      toast({ title: "Update Error", description: error.message, variant: "destructive" })
    }
  }

  if (isUserLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium animate-pulse">Initial secure handshake...</p>
        </div>
      </div>
    )
  }

  if (!user || (!adminRole && !adminRoleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">This terminal requires validated administrator clearance markers.</p>
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
        "bg-card border-r transition-all duration-300 ease-in-out hidden md:flex flex-col z-50",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck className="text-primary-foreground w-6 h-6" />
          </div>
          {isSidebarOpen && <span className="font-bold text-lg tracking-tight">Admin Gate</span>}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all group",
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-primary-foreground" : "text-primary")} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t">
          <Button 
            variant="ghost" 
            type="button"
            className={cn("w-full justify-start gap-3", !isSidebarOpen && "px-2")}
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 text-destructive" />
            {isSidebarOpen && <span>Secure Logout</span>}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" type="button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex">
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-bold text-lg capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
               {adminRoleLoading ? "Authenticating..." : "System Live"}
             </Badge>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "Active Exams", value: exams?.length || 0, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "User Base", value: allUsers?.length || 0, icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                  { label: "Total Attempts", value: results?.length || 0, icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { label: "Integrity Alerts", value: results?.filter(r => r.integrityStatus === 'Flagged').length || 0, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10" },
                ].map((stat, i) => (
                  <Card key={i} className="reveal-up border-none shadow-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-extrabold">{stat.value}</p>
                      </div>
                      <div className={cn("p-4 rounded-2xl", stat.bg)}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" /> Content Idea Lab
                    </CardTitle>
                    <CardDescription>Generate secure assessment patterns using generative AI.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <Input 
                        placeholder="e.g. Advanced Cryptography" 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="bg-background flex-1"
                      />
                      <Button type="button" onClick={handleGenerate} disabled={isGenerating || !topic}>
                        {isGenerating ? "Reasoning..." : "Generate Ideas"}
                      </Button>
                    </div>
                    {aiIdeas && (
                      <ScrollArea className="h-64 rounded-xl border bg-background p-4">
                        <div className="grid grid-cols-1 gap-4">
                          {aiIdeas.questions.map((q, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-muted border border-transparent hover:border-primary/20 transition-all group">
                              <p className="font-bold text-sm mb-2">{q.questionText}</p>
                              <Button 
                                variant="link" 
                                type="button"
                                className="h-auto p-0 text-xs text-primary" 
                                onClick={() => {
                                  addQuestion(q)
                                  setActiveTab("authoring")
                                }}
                              >
                                Import to Builder <Plus className="ml-1 w-3 h-3" />
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
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" /> Published Assessments
                    </CardTitle>
                    <CardDescription>All active exams currently in the vault.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {exams?.map((exam) => (
                          <div key={exam.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border hover:border-primary/20 transition-colors">
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold">{exam.title}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{exam.timeLimitMinutes}M • {exam.passingScore}% PASS</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setActiveTab('exams')}>
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
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
                 <Button type="button" onClick={() => setActiveTab('authoring')} className="gap-2">
                   <Plus className="w-4 h-4" /> New Exam
                 </Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {exams?.map((exam) => (
                   <Card key={exam.id} className="group hover:border-primary transition-all overflow-hidden">
                     <CardHeader>
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <CardTitle className="text-lg">{exam.title}</CardTitle>
                           <CardDescription className="line-clamp-2">{exam.description}</CardDescription>
                         </div>
                         <Badge variant="secondary" className="shrink-0">{exam.timeLimitMinutes}m</Badge>
                       </div>
                     </CardHeader>
                     <CardContent className="flex items-center justify-between pt-0 bg-muted/20 py-4">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pass Score: {exam.passingScore}%</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          type="button"
                          className="text-destructive hover:bg-destructive/10 gap-2 h-8 px-3" 
                          onClick={() => setExamToDelete(exam.id)}
                        >
                          <Trash2 className="w-4 h-4" /> Delete Assessment
                        </Button>
                     </CardContent>
                   </Card>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'authoring' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="space-y-2">
                 <h2 className="text-3xl font-bold">Secure Builder</h2>
                 <p className="text-muted-foreground">Authoring content with separated question and answer key storage.</p>
               </div>

               <Card className="border-none shadow-sm">
                 <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Exam Title</Label>
                        <Input value={newExam.title} onChange={e => setNewExam({...newExam, title: e.target.value})} placeholder="e.g. SOC2 Compliance" />
                      </div>
                      <div className="space-y-2">
                        <Label>Time Limit (Min)</Label>
                        <Input type="number" value={newExam.timeLimitMinutes} onChange={e => setNewExam({...newExam, timeLimitMinutes: parseInt(e.target.value) || 0})} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Detailed Instructions</Label>
                        <Textarea value={newExam.description} onChange={e => setNewExam({...newExam, description: e.target.value})} placeholder="Describe the focus of this assessment..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Passing Score (%)</Label>
                        <Input type="number" value={newExam.passingScore} onChange={e => setNewExam({...newExam, passingScore: parseInt(e.target.value) || 0})} />
                      </div>
                    </div>
                 </CardContent>
               </Card>

               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold">Question Blocks</h3>
                   <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    onClick={(e) => {
                      e.preventDefault();
                      addQuestion();
                    }} 
                    className="gap-2"
                  >
                     <Plus className="w-4 h-4" /> Append Question
                   </Button>
                 </div>

                 <div className="space-y-4 pb-24">
                   {examQuestions.map((q, idx) => (
                     <Card key={q.id} className="border-l-4 border-l-primary animate-in zoom-in-95 duration-200 shadow-lg overflow-visible">
                        <CardHeader className="flex flex-row items-center justify-between py-4 bg-muted/30">
                          <div className="flex items-center gap-3">
                            <Badge variant="default">Question {idx + 1}</Badge>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">Key Secured</Badge>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            type="button" 
                            onClick={() => removeQuestion(q.id)} 
                            className="text-destructive h-8 w-8 p-0 hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Question Prompt</Label>
                            <Input 
                              placeholder="Enter the challenge text here..." 
                              value={q.questionText} 
                              onChange={e => updateQuestion(q.id, 'questionText', e.target.value)}
                              className="text-lg font-medium bg-background border-primary/20"
                            />
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Answer Key Configuration</Label>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                type="button"
                                className="text-[10px] h-6 px-2 text-primary hover:text-primary underline"
                                onClick={() => addOption(q.id)}
                                disabled={q.options.length >= 5}
                              >
                                + Add Choice
                              </Button>
                            </div>
                            
                            <RadioGroup 
                              value={q.correctOptionIndex.toString()} 
                              onValueChange={v => updateQuestion(q.id, 'correctOptionIndex', parseInt(v))}
                              className="grid grid-cols-1 gap-2"
                            >
                              {q.options.map((opt: string, oIdx: number) => (
                                <div 
                                  key={oIdx} 
                                  className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg border transition-all group relative",
                                    q.correctOptionIndex === oIdx 
                                      ? "bg-emerald-500/5 border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-sm" 
                                      : "bg-background border-border"
                                  )}
                                >
                                  <div className="flex flex-col items-center gap-1 min-w-[70px]">
                                    <RadioGroupItem value={oIdx.toString()} id={`q${idx}-o${oIdx}`} className="scale-125" />
                                    <Label 
                                      htmlFor={`q${idx}-o${oIdx}`} 
                                      className={cn(
                                        "text-[9px] uppercase font-black cursor-pointer",
                                        q.correctOptionIndex === oIdx ? "text-emerald-600" : "text-muted-foreground"
                                      )}
                                    >
                                      {q.correctOptionIndex === oIdx ? "CORRECT" : "CHOICE"}
                                    </Label>
                                  </div>

                                  <div className="flex-1 flex items-center gap-2">
                                    <span className="font-bold text-muted-foreground/50 w-4">{String.fromCharCode(65 + oIdx)}.</span>
                                    <Input 
                                      placeholder={`Enter choice content...`} 
                                      value={opt} 
                                      onChange={e => {
                                        const opts = [...q.options]
                                        opts[oIdx] = e.target.value
                                        updateQuestion(q.id, 'options', opts)
                                      }}
                                      className="border-none shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
                                    />
                                  </div>

                                  {q.options.length > 2 && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      type="button"
                                      onClick={() => removeOption(q.id, oIdx)}
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                  )}
                                  
                                  {q.correctOptionIndex === oIdx && (
                                    <CircleCheck className="absolute -right-2 -top-2 w-5 h-5 text-emerald-500 bg-background rounded-full" />
                                  )}
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        </CardContent>
                     </Card>
                   ))}
                 </div>
               </div>

               <div className="fixed bottom-8 right-8 z-50 flex items-center gap-4">
                 {examQuestions.length > 0 && (
                   <Badge variant="secondary" className="bg-card shadow-lg px-4 py-2 border-primary/20 animate-in slide-in-from-right-4">
                     {examQuestions.length} Questions Drafted
                   </Badge>
                 )}
                 <Button type="button" className="px-10 py-6 text-lg btn-premium shadow-2xl" onClick={handleSaveExam}>
                   <Save className="w-4 h-4 mr-2" /> Finalize & Publish
                 </Button>
               </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-8">
               <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-bold">User Management</h2>
                 <Dialog>
                   <DialogTrigger asChild>
                     <Button type="button" className="gap-2"><UserPlus className="w-4 h-4" /> Provision Identity</Button>
                   </DialogTrigger>
                   <DialogContent>
                     <DialogHeader>
                       <DialogTitle>Provision New User</DialogTitle>
                       <DialogDescription>Create a managed identity for the secure gateway.</DialogDescription>
                     </DialogHeader>
                     <form onSubmit={handleProvisionUser} className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Username</Label>
                          <Input required value={newStudent.username} onChange={e => setNewStudent({...newStudent, username: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input required type="email" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Temporary Password</Label>
                          <Input required type="password" value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>System Role</Label>
                          <Select value={newStudent.role} onValueChange={(v: any) => setNewStudent({...newStudent, role: v})}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={isProvisioning}>
                          {isProvisioning ? "Provisioning..." : "Create Account"}
                        </Button>
                     </form>
                   </DialogContent>
                 </Dialog>
               </div>

               <Card className="border-none shadow-sm">
                 <CardHeader>
                   <CardTitle>System Roster</CardTitle>
                   <CardDescription>Manage user identities, update profiles, and elevate administrative roles.</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Identity</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allUsers?.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-bold">{u.username}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                               <Button 
                                variant="ghost" 
                                size="sm" 
                                type="button"
                                className="gap-2"
                                onClick={() => setEditingUser(u)}
                              >
                                <Edit2 className="w-3 h-3" /> Edit Profile
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                 </CardContent>
               </Card>
            </div>
          )}

          {activeTab === 'audit' && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Audit & Integrity History</CardTitle>
                <CardDescription>Global tracking of every assessment attempt.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Integrity</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results?.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell className="text-xs font-medium">{res.studentEmail}</TableCell>
                        <TableCell className="text-xs">{res.examTitle}</TableCell>
                        <TableCell className="font-bold">{res.score || 0}%</TableCell>
                        <TableCell>
                           <Badge variant={res.integrityStatus === 'Clean' ? 'secondary' : 'destructive'} className="text-[10px]">
                             {res.integrityStatus}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {res.completedAt ? new Date(res.completedAt.seconds * 1000).toLocaleString() : 'Active'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit System Identity</DialogTitle>
            <DialogDescription>Modify user credentials and administrative clearance markers.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input 
                  value={editingUser.username} 
                  onChange={e => setEditingUser({...editingUser, username: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email (Read-only)</Label>
                <Input value={editingUser.email} readOnly className="bg-muted opacity-70 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label>System Role</Label>
                <Select value={editingUser.role} onValueChange={(v: any) => setEditingUser({...editingUser, role: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
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
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" /> Purge Assessment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the assessment from the vault. Students will no longer be able to attempt this exam. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
