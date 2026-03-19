
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
  UserCog
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, collectionGroup, getDocs } from "firebase/firestore"
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
      // 1. Save Exam Metadata
      await setDoc(examRef, {
        ...newExam,
        id: examId,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      })

      // 2. Save Questions and Answer Keys separately for security
      for (const q of examQuestions) {
        const qId = q.id || doc(collection(db, `exams/${examId}/questions`)).id
        
        // Public Question (Student viewable)
        await setDoc(doc(db, `exams/${examId}/questions`, qId), {
          id: qId,
          examId,
          questionText: q.questionText,
          options: q.options
        })

        // Protected Answer (Admin only)
        await setDoc(doc(db, `exams/${examId}/answers`, qId), {
          id: qId,
          correctOptionIndex: q.correctOptionIndex
        })
      }

      toast({ title: "Success", description: "Assessment published to the secure vault." })
      setIsGenerating(false)
      setNewExam({ title: "", description: "", timeLimitMinutes: 30, passingScore: 70 })
      setExamQuestions([])
      setActiveTab("exams")
    } catch (error: any) {
      toast({ title: "Operation Failed", description: error.message, variant: "destructive" })
    }
  }

  const handlePromote = async (uid: string) => {
    try {
      await setDoc(doc(db, "admin_roles", uid), { uid, createdAt: serverTimestamp() })
      await setDoc(doc(db, "users", uid), { role: 'admin' }, { merge: true })
      toast({ title: "User Promoted", description: "Administrative privileges granted." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  if (isUserLoading || adminRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium animate-pulse">Synchronizing Secure Session...</p>
        </div>
      </div>
    )
  }

  if (!user || !adminRole) return null

  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "exams", label: "Assessment Vault", icon: FileText },
    { id: "authoring", label: "Exam Builder", icon: Sparkles },
    { id: "students", label: "User Management", icon: UserCog },
    { id: "audit", label: "Audit Logs", icon: History },
  ]

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex">
      {/* Sidebar */}
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
               System Live
             </Badge>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                    <Button onClick={handleGenerate} disabled={isGenerating || !topic}>
                      {isGenerating ? "Reasoning..." : "Generate Ideas"}
                    </Button>
                  </div>
                  {aiIdeas && (
                    <ScrollArea className="h-64 rounded-xl border bg-background p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {aiIdeas.questions.map((q, idx) => (
                          <div key={idx} className="p-4 rounded-lg bg-muted border border-transparent hover:border-primary/20 transition-all group">
                            <p className="font-bold text-sm mb-2">{q.questionText}</p>
                            <Button variant="link" className="h-auto p-0 text-xs text-primary" onClick={() => {
                              setActiveTab("authoring")
                              addQuestion(q)
                            }}>Import to Builder <Plus className="ml-1 w-3 h-3" /></Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
               <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-bold">Assessment Vault</h2>
                 <Button onClick={() => setActiveTab('authoring')} className="gap-2">
                   <Plus className="w-4 h-4" /> New Exam
                 </Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {exams?.map((exam) => (
                   <Card key={exam.id} className="group hover:border-primary transition-all">
                     <CardHeader>
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <CardTitle>{exam.title}</CardTitle>
                           <CardDescription className="line-clamp-2">{exam.description}</CardDescription>
                         </div>
                         <Badge variant="secondary">{exam.timeLimitMinutes}m</Badge>
                       </div>
                     </CardHeader>
                     <CardContent className="flex items-center justify-between pt-0">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pass: {exam.passingScore}%</span>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDoc(doc(db, "exams", exam.id))}>
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
                        <Input type="number" value={newExam.timeLimitMinutes} onChange={e => setNewExam({...newExam, timeLimitMinutes: parseInt(e.target.value)})} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Detailed Instructions</Label>
                        <Textarea value={newExam.description} onChange={e => setNewExam({...newExam, description: e.target.value})} placeholder="Describe the focus of this assessment..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Passing Score (%)</Label>
                        <Input type="number" value={newExam.passingScore} onChange={e => setNewExam({...newExam, passingScore: parseInt(e.target.value)})} />
                      </div>
                    </div>
                 </CardContent>
               </Card>

               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold">Question Blocks</h3>
                   <Button variant="outline" size="sm" onClick={() => addQuestion()} className="gap-2">
                     <Plus className="w-4 h-4" /> Append Question
                   </Button>
                 </div>

                 <div className="space-y-4">
                   {examQuestions.map((q, idx) => (
                     <Card key={q.id} className="reveal-up border-l-4 border-l-primary animate-in slide-in-from-left-4 duration-300">
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                          <Badge variant="outline">Q{idx + 1}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => removeQuestion(q.id)} className="text-destructive h-8 w-8 p-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Input 
                            placeholder="Prompt..." 
                            value={q.questionText} 
                            onChange={e => updateQuestion(q.id, 'questionText', e.target.value)}
                            className="text-lg font-medium"
                          />
                          <div className="space-y-3">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Answer Configuration</Label>
                            <RadioGroup 
                              value={q.correctOptionIndex.toString()} 
                              onValueChange={v => updateQuestion(q.id, 'correctOptionIndex', parseInt(v))}
                              className="space-y-2"
                            >
                              {q.options.map((opt: string, oIdx: number) => (
                                <div key={oIdx} className="flex items-center gap-3">
                                  <RadioGroupItem value={oIdx.toString()} />
                                  <Input 
                                    placeholder={`Option ${oIdx + 1}`} 
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
                 <Button className="px-10 py-6 text-lg btn-premium" onClick={handleSaveExam}>
                   <Save className="w-4 h-4 mr-2" /> Finalize & Publish
                 </Button>
               </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <Card className="border-none shadow-sm">
                 <CardHeader>
                   <CardTitle>System Roster</CardTitle>
                   <CardDescription>Manage user identities and elevate administrative roles.</CardDescription>
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
                               {u.role !== 'admin' && (
                                 <Button variant="outline" size="sm" onClick={() => handlePromote(u.id)}>Elevate to Admin</Button>
                               )}
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
    </div>
  )
}
