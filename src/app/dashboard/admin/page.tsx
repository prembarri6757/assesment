"use client"

import { useState, useEffect } from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, LayoutDashboard, FileText, Users, ShieldAlert, Sparkles, Search, Trash2, Save, LogOut, UserPlus, ShieldCheck } from "lucide-react"
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

export default function AdminDashboard() {
  const containerRef = useScrollReveal()
  const db = useFirestore()
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiIdeas, setAiIdeas] = useState<GenerateQuestionIdeasOutput | null>(null)
  const [topic, setTopic] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    timeLimitMinutes: 30,
    passingScore: 70
  })
  const [examQuestions, setExamQuestions] = useState<any[]>([])

  // Auth Redirection
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

  const examsQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return collection(db, "exams")
  }, [db, user, adminRole])
  const { data: exams, isLoading: examsLoading } = useCollection(examsQuery)

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

  const adminRolesQuery = useMemoFirebase(() => {
    if (!user || !adminRole) return null
    return collection(db, "admin_roles")
  }, [db, user, adminRole])
  const { data: allAdminRoles } = useCollection(adminRolesQuery)

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
      questionText: "",
      options: ["", "", "", ""],
      correctOptionIndex: 0
    }])
  }

  const removeQuestion = (index: number) => {
    setExamQuestions(examQuestions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...examQuestions]
    updated[index] = { ...updated[index], [field]: value }
    setExamQuestions(updated)
  }

  const handleSaveExam = async () => {
    if (!user) return
    if (!newExam.title || examQuestions.length === 0) {
      toast({ title: "Validation Error", description: "Please provide a title and at least one question.", variant: "destructive" })
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
          examId,
          examCreatedBy: user.uid
        })
      }

      toast({ title: "Exam Created", description: "The assessment is now live." })
      setIsCreateDialogOpen(false)
      setNewExam({ title: "", description: "", timeLimitMinutes: 30, passingScore: 70 })
      setExamQuestions([])
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" })
    }
  }

  const toggleAdminRole = async (targetUserId: string, currentStatus: boolean) => {
    try {
      const roleRef = doc(db, "admin_roles", targetUserId)
      if (currentStatus) {
        if (targetUserId === user?.uid) {
          toast({ title: "Action Denied", description: "You cannot revoke your own admin rights.", variant: "destructive" })
          return
        }
        await deleteDoc(roleRef)
        toast({ title: "Role Updated", description: "Administrator access revoked." })
      } else {
        await setDoc(roleRef, { uid: targetUserId, createdAt: serverTimestamp() })
        toast({ title: "Role Updated", description: "Administrator access granted." })
      }
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" })
    }
  }

  if (isUserLoading || adminRoleLoading) {
    return <div className="min-h-screen flex items-center justify-center">Verifying credentials...</div>
  }

  if (!user || !adminRole) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">This portal is for authorized administrators only.</p>
        <Button onClick={() => router.push('/')}>Return Home</Button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ShieldAlert className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-xl hidden sm:inline-block">Admin Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs">Live System</Badge>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4 sm:p-8 space-y-8">
        <header className="reveal-up flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
            <p className="text-muted-foreground">Manage assessments and monitor integrity metrics.</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-premium flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create New Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Author New Examination</DialogTitle>
                <DialogDescription>Define metadata and questions for the assessment.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={newExam.title} onChange={e => setNewExam({...newExam, title: e.target.value})} placeholder="Exam Title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Time Limit (Minutes)</Label>
                    <Input type="number" value={newExam.timeLimitMinutes} onChange={e => setNewExam({...newExam, timeLimitMinutes: parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Description</Label>
                    <Textarea value={newExam.description} onChange={e => setNewExam({...newExam, description: e.target.value})} placeholder="Instructions for students" />
                  </div>
                  <div className="space-y-2">
                    <Label>Passing Score (%)</Label>
                    <Input type="number" value={newExam.passingScore} onChange={e => setNewExam({...newExam, passingScore: parseInt(e.target.value)})} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">Questions ({examQuestions.length})</h3>
                    <Button variant="outline" size="sm" onClick={() => addQuestion()}>
                      <Plus className="w-4 h-4 mr-2" /> Add Question
                    </Button>
                  </div>
                  
                  {examQuestions.map((q, idx) => (
                    <Card key={idx} className="p-4 space-y-4 border-l-4 border-l-primary">
                      <div className="flex justify-between items-start">
                        <Badge>Q{idx + 1}</Badge>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeQuestion(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <Input 
                        placeholder="Question Prompt" 
                        value={q.questionText} 
                        onChange={e => updateQuestion(idx, 'questionText', e.target.value)} 
                      />
                      <div className="space-y-2">
                        <Label className="text-xs uppercase">Options (Select correct one)</Label>
                        <RadioGroup 
                          value={q.correctOptionIndex.toString()} 
                          onValueChange={v => updateQuestion(idx, 'correctOptionIndex', parseInt(v))}
                        >
                          {q.options.map((opt: string, oIdx: number) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <RadioGroupItem value={oIdx.toString()} />
                              <Input 
                                placeholder={`Option ${oIdx + 1}`} 
                                value={opt} 
                                onChange={e => {
                                  const opts = [...q.options]
                                  opts[oIdx] = e.target.value
                                  updateQuestion(idx, 'options', opts)
                                }}
                              />
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveExam} className="btn-premium">
                  <Save className="w-4 h-4 mr-2" /> Save & Publish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Active Exams", value: exams?.length || "0", icon: FileText, color: "text-blue-500" },
            { label: "Total Students", value: allUsers?.length || "0", icon: Users, color: "text-indigo-500" },
            { label: "Total Results", value: results?.length || "0", icon: LayoutDashboard, color: "text-emerald-500" },
            { label: "Integrity Alerts", value: results?.filter(r => r.integrityStatus === 'Flagged').length || "0", icon: ShieldAlert, color: "text-red-500" },
          ].map((stat, i) => (
            <Card key={i} className="reveal-up glass-card">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 bg-muted rounded-xl ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="exams" className="reveal-up space-y-6">
          <TabsList className="bg-card border h-12 p-1">
            <TabsTrigger value="exams" className="h-full px-6">Exam List</TabsTrigger>
            <TabsTrigger value="ai-generator" className="h-full px-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Tool
            </TabsTrigger>
            <TabsTrigger value="results" className="h-full px-6">Results</TabsTrigger>
            <TabsTrigger value="users" className="h-full px-6">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {exams?.map((exam) => (
                <Card key={exam.id} className="hover:border-primary/50 transition-colors group">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg">{exam.title}</CardTitle>
                      <CardDescription>{exam.description}</CardDescription>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20">{exam.timeLimitMinutes} mins</Badge>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Pass: {exam.passingScore}%</span>
                    </div>
                    <Button variant="ghost" size="sm" className="group-hover:text-destructive" onClick={() => deleteDoc(doc(db, "exams", exam.id))}>Delete</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ai-generator">
            <Card className="glass-card overflow-hidden">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI Question Idea Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Topic e.g. Network Security" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                  <Button onClick={handleGenerate} disabled={isGenerating || !topic}>
                    {isGenerating ? "Analyzing..." : "Generate Ideas"}
                  </Button>
                </div>
                {aiIdeas && (
                  <ScrollArea className="h-[400px] rounded-lg border p-4">
                    <div className="space-y-4">
                      {aiIdeas.questions.map((q, idx) => (
                        <Card key={idx} className="p-4">
                          <p className="font-bold mb-2">{q.questionText}</p>
                          <Button variant="link" size="sm" onClick={() => addQuestion(q)}>Add to exam</Button>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
             <Card>
               <CardHeader><CardTitle>Global Integrity Log</CardTitle></CardHeader>
               <CardContent>
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Student</TableHead>
                       <TableHead>Assessment</TableHead>
                       <TableHead>Score</TableHead>
                       <TableHead>Status</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {results?.map((res) => (
                       <TableRow key={res.id}>
                         <TableCell>{res.studentEmail}</TableCell>
                         <TableCell>{res.examTitle}</TableCell>
                         <TableCell className="font-bold">{res.score}%</TableCell>
                         <TableCell>
                           <Badge variant={res.integrityStatus === 'Clean' ? 'secondary' : 'destructive'}>
                             {res.integrityStatus}
                           </Badge>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View all registered users and manage administrator privileges.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers?.map((u) => {
                      const isTargetAdmin = allAdminRoles?.some(role => role.id === u.id)
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.username || "N/A"}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <Badge variant={isTargetAdmin ? "default" : "secondary"}>
                              {isTargetAdmin ? "Admin" : "Student"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant={isTargetAdmin ? "destructive" : "outline"} 
                              size="sm"
                              onClick={() => toggleAdminRole(u.id, !!isTargetAdmin)}
                            >
                              {isTargetAdmin ? "Revoke Admin" : "Make Admin"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}