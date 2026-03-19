
"use client"

import { useState, useEffect } from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, 
  LayoutDashboard, 
  FileText, 
  Users, 
  ShieldAlert, 
  Sparkles, 
  Search, 
  Trash2, 
  Save, 
  LogOut, 
  UserPlus, 
  ShieldCheck,
  History,
  Menu,
  X,
  ChevronRight
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, collectionGroup } from "firebase/firestore"
import { generateQuestionIdeas, type GenerateQuestionIdeasOutput } from "@/ai/flows/admin-question-idea-generator"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { useAuth } from "@/firebase"
import { signOut } from "firebase/auth"
import { cn } from "@/lib/utils"

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
  
  // Exam State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    timeLimitMinutes: 30,
    passingScore: 70
  })
  const [examQuestions, setExamQuestions] = useState<any[]>([])

  // Student Provisioning State
  const [newStudent, setNewStudent] = useState({ email: "", username: "" })

  // Auth Redirection & Verification
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

  const students = allUsers?.filter(u => u.role === 'student') || []

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/')
  }

  const handleGenerate = async () => {
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
    setExamQuestions([...examQuestions, q || {
      id: Math.random().toString(36).substr(2, 9),
      questionText: "",
      options: ["", "", "", ""],
      correctOptionIndex: 0
    }])
  }

  const removeQuestion = (id: string) => {
    setExamQuestions(examQuestions.filter(q => q.id !== id))
  }

  const updateQuestion = (id: string, field: string, value: any) => {
    setExamQuestions(examQuestions.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  const handleSaveExam = async () => {
    if (!user) return
    if (!newExam.title || examQuestions.length === 0) {
      toast({ title: "Validation Error", description: "Exam must have a title and questions.", variant: "destructive" })
      return
    }

    const examId = doc(collection(db, "exams")).id
    const examRef = doc(db, "exams", examId)

    try {
      await setDoc(examRef, {
        ...newExam,
        id: examId,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      })

      for (const q of examQuestions) {
        const qId = doc(collection(db, `exams/${examId}/questions`)).id
        await setDoc(doc(db, `exams/${examId}/questions`, qId), {
          ...q,
          id: qId,
          examId
        })
      }

      toast({ title: "Success", description: "Assessment published to the secure vault." })
      setIsCreateDialogOpen(false)
      setNewExam({ title: "", description: "", timeLimitMinutes: 30, passingScore: 70 })
      setExamQuestions([])
    } catch (error: any) {
      toast({ title: "Operation Failed", description: error.message, variant: "destructive" })
    }
  }

  if (isUserLoading || adminRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium animate-pulse">Establishing Secure Session...</p>
        </div>
      </div>
    )
  }

  if (!user || !adminRole) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-6 bg-background p-4 text-center">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Unauthorized Access</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You do not have the clearance required to view the primary gateway. Access attempts have been logged.
          </p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="gap-2">
          Return to Identity Verification
        </Button>
      </div>
    )
  }

  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "exams", label: "Assessment Vault", icon: FileText },
    { id: "authoring", label: "Exam Builder", icon: Sparkles },
    { id: "students", label: "User Roster", icon: Users },
    { id: "audit", label: "Audit Logs", icon: History },
  ]

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop */}
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
            className={cn("w-full justify-start gap-3", !isSidebarOpen && "px-2")}
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 text-destructive" />
            {isSidebarOpen && <span>Secure Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex">
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-bold text-lg capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
               System Online
             </Badge>
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                 {user.email?.[0].toUpperCase()}
               </div>
             </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "Active Exams", value: exams?.length || 0, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "Provisioned Students", value: students.length, icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                  { label: "Exam Attempts", value: results?.length || 0, icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { label: "Integrity Flags", value: results?.filter(r => r.integrityStatus === 'Flagged').length || 0, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10" },
                ].map((stat, i) => (
                  <Card key={i} className="reveal-up border-none shadow-sm hover:shadow-md transition-shadow">
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent System Activity</CardTitle>
                    <CardDescription>A real-time log of the latest examination attempts.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Assessment</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Integrity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results?.slice(0, 5).map((res) => (
                          <TableRow key={res.id}>
                            <TableCell className="font-medium text-xs">{res.studentEmail}</TableCell>
                            <TableCell className="text-xs">{res.examTitle}</TableCell>
                            <TableCell>
                              <Badge variant={res.score >= 70 ? 'secondary' : 'outline'} className="font-mono">
                                {res.score}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={res.integrityStatus === 'Clean' ? 'secondary' : 'destructive'} className="text-[10px] uppercase">
                                {res.integrityStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" /> AI Assistant
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enter a topic to generate high-quality assessment ideas.
                    </p>
                    <div className="space-y-2">
                      <Input 
                        placeholder="e.g. Quantum Computing" 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="bg-background"
                      />
                      <Button className="w-full gap-2" onClick={handleGenerate} disabled={isGenerating || !topic}>
                        {isGenerating ? "Processing..." : "Generate Insights"}
                      </Button>
                    </div>
                    {aiIdeas && (
                      <ScrollArea className="h-48 rounded-md border bg-background p-2">
                        {aiIdeas.questions.map((q, idx) => (
                          <div key={idx} className="p-3 mb-2 rounded-lg bg-muted text-xs border border-transparent hover:border-primary/20 transition-all">
                            <p className="font-bold mb-1">{q.questionText}</p>
                            <Button variant="link" className="h-auto p-0 text-[10px]" onClick={() => {
                              setActiveTab("authoring")
                              addQuestion(q)
                            }}>Import to Builder</Button>
                          </div>
                        ))}
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-bold">Assessment Vault</h2>
                 <Button onClick={() => setActiveTab('authoring')} className="gap-2">
                   <Plus className="w-4 h-4" /> New Assessment
                 </Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {exams?.map((exam) => (
                   <Card key={exam.id} className="group hover:border-primary transition-all">
                     <CardHeader className="flex flex-row items-start justify-between">
                       <div className="space-y-1">
                         <CardTitle className="group-hover:text-primary transition-colors">{exam.title}</CardTitle>
                         <CardDescription>{exam.description}</CardDescription>
                       </div>
                       <Badge variant="secondary">{exam.timeLimitMinutes}m</Badge>
                     </CardHeader>
                     <CardContent className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Pass: {exam.passingScore}%</span>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteDoc(doc(db, "exams", exam.id))}>
                          Archive
                        </Button>
                     </CardContent>
                   </Card>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'authoring' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
               <div className="space-y-2">
                 <h2 className="text-3xl font-bold">Assessment Builder</h2>
                 <p className="text-muted-foreground">Define criteria and author secure examination content.</p>
               </div>

               <Card className="border-none shadow-sm">
                 <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Exam Title</Label>
                        <Input value={newExam.title} onChange={e => setNewExam({...newExam, title: e.target.value})} placeholder="e.g. Cyber Resilience Certification" />
                      </div>
                      <div className="space-y-2">
                        <Label>Time Limit (Minutes)</Label>
                        <Input type="number" value={newExam.timeLimitMinutes} onChange={e => setNewExam({...newExam, timeLimitMinutes: parseInt(e.target.value)})} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Description</Label>
                        <Textarea value={newExam.description} onChange={e => setNewExam({...newExam, description: e.target.value})} placeholder="Provide detailed instructions for the candidate..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Passing Threshold (%)</Label>
                        <Input type="number" value={newExam.passingScore} onChange={e => setNewExam({...newExam, passingScore: parseInt(e.target.value)})} />
                      </div>
                    </div>
                 </CardContent>
               </Card>

               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold">Content Structure</h3>
                   <Button variant="outline" size="sm" onClick={() => addQuestion()} className="gap-2">
                     <Plus className="w-4 h-4" /> Append Question
                   </Button>
                 </div>

                 <div className="space-y-4">
                   {examQuestions.map((q, idx) => (
                     <Card key={q.id} className="reveal-up border-l-4 border-l-primary animate-in slide-in-from-left-4 duration-300">
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                          <Badge variant="outline" className="font-mono">QUESTION_BLOCK_{idx + 1}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => removeQuestion(q.id)} className="text-destructive h-8 w-8 p-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Input 
                            placeholder="Examination prompt..." 
                            value={q.questionText} 
                            onChange={e => updateQuestion(q.id, 'questionText', e.target.value)}
                            className="text-lg font-medium"
                          />
                          <div className="space-y-3">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Multiple Choice Options</Label>
                            <RadioGroup 
                              value={q.correctOptionIndex.toString()} 
                              onValueChange={v => updateQuestion(q.id, 'correctOptionIndex', parseInt(v))}
                              className="space-y-2"
                            >
                              {q.options.map((opt: string, oIdx: number) => (
                                <div key={oIdx} className="flex items-center gap-3">
                                  <RadioGroupItem value={oIdx.toString()} />
                                  <Input 
                                    placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} 
                                    value={opt} 
                                    onChange={e => {
                                      const opts = [...q.options]
                                      opts[oIdx] = e.target.value
                                      updateQuestion(q.id, 'options', opts)
                                    }}
                                  />
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        </CardContent>
                     </Card>
                   ))}
                 </div>
               </div>

               <div className="flex justify-end gap-4 pt-8">
                 <Button variant="ghost" onClick={() => {
                   setExamQuestions([])
                   setNewExam({ title: "", description: "", timeLimitMinutes: 30, passingScore: 70 })
                 }}>Clear Session</Button>
                 <Button className="px-10 btn-premium" onClick={handleSaveExam}>
                   <Save className="w-4 h-4 mr-2" /> Publish to Gateway
                 </Button>
               </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <Card className="border-none shadow-sm">
                 <CardHeader>
                   <CardTitle>System Provisioning</CardTitle>
                   <CardDescription>Directly register authorized personnel to the closed gateway.</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 space-y-2">
                        <Label>Email</Label>
                        <Input placeholder="candidate@org.com" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label>Full Name</Label>
                        <Input placeholder="John Doe" value={newStudent.username} onChange={e => setNewStudent({...newStudent, username: e.target.value})} />
                      </div>
                      <div className="flex items-end">
                        <Button className="gap-2" onClick={() => {
                          toast({ title: "Provisioning", description: "In production, this would trigger a Firebase Admin SDK call." })
                        }}>
                          <UserPlus className="w-4 h-4" /> Provision Student
                        </Button>
                      </div>
                   </div>
                 </CardContent>
               </Card>

               <Card className="border-none shadow-sm">
                 <CardHeader>
                   <CardTitle>Authorized Personnel</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Identity</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Access Status</TableHead>
                          <TableHead className="text-right">Manage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-bold">{u.username}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">Active</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                               <Button variant="ghost" size="sm" className="text-destructive">Revoke</Button>
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
            <Card className="border-none shadow-sm animate-in slide-in-from-top-4 duration-500">
              <CardHeader>
                <CardTitle>Audit & Integrity Log</CardTitle>
                <CardDescription>Comprehensive oversight of all gateway interactions.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Integrity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results?.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell className="text-xs font-medium">{res.studentEmail}</TableCell>
                        <TableCell className="text-xs">{res.examTitle}</TableCell>
                        <TableCell className="font-bold">{res.score}%</TableCell>
                        <TableCell className="text-xs">
                          {res.completedAt ? new Date(res.completedAt.seconds * 1000).toLocaleString() : 'Pending'}
                        </TableCell>
                        <TableCell>
                           <Badge variant={res.integrityStatus === 'Clean' ? 'secondary' : 'destructive'} className="text-[10px]">
                             {res.integrityStatus}
                           </Badge>
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
    </div>
  )
}
