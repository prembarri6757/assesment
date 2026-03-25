
"use client"

import { useState, useEffect, useMemo } from "react"
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
  Target,
  Search,
  Filter,
  Send,
  CheckSquare,
  Square,
  Calendar,
  CheckCircle2,
  XCircle,
  Download
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, collectionGroup, getDocs, updateDoc, writeBatch } from "firebase/firestore"
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
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export default function AdminDashboard() {
  const containerRef = useScrollReveal()
  const db = useFirestore()
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiIdeas, setAiIdeas] = useState<GenerateQuestionIdeasOutput | null>(null)
  const [topic, setTopic] = useState("")
  const [examToDelete, setExamToDelete] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [logsToDelete, setLogsToDelete] = useState<any[] | null>(null)
  
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [newStudent, setNewStudent] = useState({ email: "", password: "", username: "", role: "student" as "student" | "admin" })
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [isGrading, setIsGrading] = useState<string | null>(null)
  const [isGradingAll, setIsGradingAll] = useState(false)

  const [selectedLogs, setSelectedLogs] = useState<string[]>([])

  const [editingExamId, setEditingExamId] = useState<string | null>(null)
  const [isLoadingExam, setIsLoadingExam] = useState(false)
  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    timeLimitMinutes: 30,
    passingScore: 70,
    status: "draft" as "draft" | "published"
  })
  const [examQuestions, setExamQuestions] = useState<any[]>([])

  const [userSearch, setUserSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const [auditSearch, setAuditSearch] = useState("")
  const [auditExamFilter, setAuditExamFilter] = useState<string>("all")
  const [auditStatusFilter, setAuditStatusFilter] = useState<string>("all")

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const handleEditExam = async (examId: string) => {
    setIsLoadingExam(true)
    try {
      const examToEdit = exams?.find(e => e.id === examId)
      if (!examToEdit) throw new Error("Exam not found")

      setNewExam({
        title: examToEdit.title,
        description: examToEdit.description,
        timeLimitMinutes: examToEdit.timeLimitMinutes,
        passingScore: examToEdit.passingScore,
        status: examToEdit.status || "draft"
      })

      const publicQuestionsRef = collection(db, `exams/${examId}/questions`)
      const privateAnswersRef = collection(db, `exams/${examId}/answers`)
      
      const [questionsSnap, answersSnap] = await Promise.all([
        getDocs(publicQuestionsRef),
        getDocs(privateAnswersRef)
      ])

      const answersMap: Record<string, number> = {}
      answersSnap.forEach(doc => {
        answersMap[doc.id] = doc.data().correctOptionIndex
      })

      const questions = questionsSnap.docs.map(doc => ({
        id: doc.id,
        questionText: doc.data().questionText,
        options: doc.data().options,
        correctOptionIndex: answersMap[doc.id] || 0
      }))

      setExamQuestions(questions)
      setEditingExamId(examId)
      setActiveTab("authoring")
    } catch (e: any) {
      toast({ title: "Edit Error", description: e.message, variant: "destructive" })
    } finally {
      setIsLoadingExam(false)
    }
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
        correctAnswers: answerKey, 
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
      const resultsByExam: Record<string, any[]> = {};
      results.forEach(res => {
        if (!resultsByExam[res.examId]) resultsByExam[res.examId] = [];
        resultsByExam[res.examId].push(res);
      });

      for (const examId in resultsByExam) {
        const answersRef = collection(db, `exams/${examId}/answers`);
        const answersSnap = await getDocs(answersRef);
        const answerKey: Record<string, number> = {};
        answersSnap.forEach(doc => {
          answerKey[doc.id] = doc.data().correctOptionIndex;
        });
        const total = Object.keys(answerKey).length;

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
            correctAnswers: answerKey, 
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
        const newOptions = q.options.filter((_: any, i: number = 0) => i !== oIdx)
        const newCorrectIndex = q.correctOptionIndex >= oIdx ? Math.max(0, q.correctOptionIndex - 1) : q.correctOptionIndex
        return { ...q, options: newOptions, correctOptionIndex: newCorrectIndex }
      }
      return q
    }))
  }

  const handleDeleteExam = () => {
    if (!examToDelete) return
    const examRef = doc(db, "exams", examToDelete)
    deleteDoc(examRef).catch(async (e) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: examRef.path,
        operation: 'delete'
      }));
    });
    toast({ title: "Assessment Deleted", description: "The exam has been removed from the vault." })
    setExamToDelete(null)
  }

  const handleDeleteUser = () => {
    if (!userToDelete) return
    const userRef = doc(db, "users", userToDelete)
    const adminRef = doc(db, "admin_roles", userToDelete)

    deleteDoc(userRef).catch(async (e) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'delete'
      }));
    });
    
    deleteDoc(adminRef).catch(() => {});

    toast({ title: "Identity Purged", description: "The user has been removed from the roster." })
    setUserToDelete(null)
  }

  const handleDeleteLogs = async () => {
    if (!logsToDelete || logsToDelete.length === 0) return;
    
    const batch = writeBatch(db);
    logsToDelete.forEach(log => {
      const logRef = doc(db, "users", log.studentId, "results", log.id);
      batch.delete(logRef);
    });

    try {
      await batch.commit();
      toast({ title: "Audit Logs Purged", description: `Successfully removed ${logsToDelete.length} records.` });
      setSelectedLogs([]);
    } catch (e: any) {
      toast({ title: "Purge Error", description: e.message, variant: "destructive" });
    } finally {
      setLogsToDelete(null);
    }
  };

  const toggleLogSelection = (id: string) => {
    setSelectedLogs(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllLogs = (resultsOnPage: any[]) => {
    if (selectedLogs.length === resultsOnPage.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(resultsOnPage.map(r => r.id));
    }
  };

  const handleSaveExam = async (e: React.MouseEvent, status: "draft" | "published") => {
    e.preventDefault()
    if (!user) return
    if (!newExam.title || examQuestions.length === 0) {
      toast({ title: "Validation Error", description: "Exam must have a title and questions.", variant: "destructive" })
      return
    }

    const examId = editingExamId || doc(collection(db, "exams")).id
    const examRef = doc(db, "exams", examId)

    try {
      await setDoc(examRef, {
        ...newExam,
        id: examId,
        status: status,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        ...(editingExamId ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });

      const batch = writeBatch(db);
      examQuestions.forEach(q => {
        const qId = q.id;
        const publicQRef = doc(db, `exams/${examId}/questions`, qId)
        const privateARef = doc(db, `exams/${examId}/answers`, qId)

        batch.set(publicQRef, {
          id: qId,
          examId,
          questionText: q.questionText,
          options: q.options
        }, { merge: true });

        batch.set(privateARef, {
          id: qId,
          correctOptionIndex: q.correctOptionIndex
        }, { merge: true });
      });

      await batch.commit();
      
      toast({ title: "Success", description: status === 'published' ? "Assessment published." : "Draft saved successfully." })
      setNewExam({ title: "", description: "", timeLimitMinutes: 30, passingScore: 70, status: "draft" })
      setExamQuestions([])
      setEditingExamId(null)
      setActiveTab("exams")
    } catch (e: any) {
      toast({ title: "Save Error", description: e.message, variant: "destructive" })
    }
  }

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProvisioning(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newStudent.email, newStudent.password)
      const newUser = userCredential.user

      const userRef = doc(db, "users", newUser.uid)
      await setDoc(userRef, {
        id: newUser.uid,
        email: newUser.email,
        username: newStudent.username,
        role: newStudent.role,
        createdAt: serverTimestamp()
      });

      if (newStudent.role === 'admin') {
        const adminRef = doc(db, "admin_roles", newUser.uid)
        await setDoc(adminRef, {
          uid: newUser.uid,
          createdAt: serverTimestamp()
        }, { merge: true });
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
      await updateDoc(userRef, {
        username: editingUser.username,
        role: editingUser.role
      });

      if (editingUser.role === 'admin') {
        await setDoc(adminMarkerRef, {
          uid: editingUser.id,
          createdAt: serverTimestamp()
        }, { merge: true });
      } else {
        await deleteDoc(adminMarkerRef);
      }

      toast({ title: "User Updated", description: "The system roster has been synchronized." })
      setEditingUser(null)
    } catch (error: any) {
      toast({ title: "Update Error", description: error.message, variant: "destructive" })
    }
  }

  const filteredUsers = useMemo(() => {
    return allUsers?.filter(u => {
      const matchesSearch = (u.username?.toLowerCase() || "").includes(userSearch.toLowerCase()) || 
                            (u.email?.toLowerCase() || "").includes(userSearch.toLowerCase())
      const matchesRole = roleFilter === "all" || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [allUsers, userSearch, roleFilter])

  const filteredResults = useMemo(() => {
    return results?.filter(res => {
      const matchesSearch = (res.studentEmail?.toLowerCase() || "").includes(auditSearch.toLowerCase()) || 
                            (res.examTitle?.toLowerCase() || "").includes(auditSearch.toLowerCase())
      const matchesExam = auditExamFilter === "all" || res.examTitle === auditExamFilter
      const matchesStatus = auditStatusFilter === "all" || res.integrityStatus === auditStatusFilter
      return matchesSearch && matchesExam && matchesStatus
    })
  }, [results, auditSearch, auditExamFilter, auditStatusFilter])

  const uniqueExamTitles = useMemo(() => {
    const titles = new Set<string>()
    results?.forEach(res => {
      if (res.examTitle) titles.add(res.examTitle)
    })
    return Array.from(titles).sort()
  }, [results])

  const handleDownloadCSV = () => {
    if (!filteredResults || filteredResults.length === 0) return;

    const headers = ["Student Email", "Exam Title", "Date", "Score", "Marks", "Outcome", "Integrity Status"];
    const rows = filteredResults.map(res => {
      const examData = exams?.find(e => e.id === res.examId);
      const isGraded = res.score !== undefined;
      const isPassed = isGraded && res.score >= (examData?.passingScore || 0);
      const attemptDate = getSafeDate(res.startedAt);
      const dateStr = attemptDate ? format(attemptDate, 'yyyy-MM-dd HH:mm') : 'N/A';
      const outcome = isGraded ? (isPassed ? "PASS" : "FAIL") : "UNMARKED";
      const marks = res.correctCount !== undefined ? `${res.correctCount}/${res.totalQuestions}` : "N/A";
      
      return [
        res.studentEmail,
        `"${res.examTitle}"`,
        dateStr,
        `${res.score || 0}%`,
        marks,
        outcome,
        res.integrityStatus
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSingle = (res: any) => {
    const examData = exams?.find(e => e.id === res.examId);
    const isGraded = res.score !== undefined;
    const isPassed = isGraded && res.score >= (examData?.passingScore || 0);
    const attemptDate = getSafeDate(res.startedAt);
    const dateStr = attemptDate ? format(attemptDate, 'yyyy-MM-dd HH:mm') : 'N/A';
    
    const content = `
ASSESSMENT RESULT EXPORT
------------------------
Student: ${res.studentEmail}
Exam: ${res.examTitle}
Date: ${dateStr}
Integrity Status: ${res.integrityStatus}

RESULTS
-------
Score: ${res.score || 0}%
Correct: ${res.correctCount || 0}
Total: ${res.totalQuestions || 0}
Outcome: ${isGraded ? (isPassed ? "PASS" : "FAIL") : "PENDING"}

SYSTEM METRICS
--------------
Result ID: ${res.id}
Exam ID: ${res.examId}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `result_${res.studentEmail}_${res.id}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSafeDate = (dateVal: any) => {
    if (!dateVal) return null;
    if (dateVal.toDate) return dateVal.toDate();
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }

  if (isUserLoading || adminRoleLoading || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" suppressHydrationWarning>
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
              onClick={() => {
                setActiveTab(item.id)
                if (item.id !== 'authoring') {
                  setEditingExamId(null)
                }
              }}
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
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-muted-foreground uppercase">{exam.timeLimitMinutes} min limit</p>
                                  <Badge variant={exam.status === 'published' ? 'default' : 'secondary'} className="text-[8px] h-4 px-1 font-bold uppercase">
                                    {exam.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
                                  </Badge>
                                </div>
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
                 <Button onClick={() => { setActiveTab('authoring'); setEditingExamId(null); setExamQuestions([]); setNewExam({ title: "", description: "", timeLimitMinutes: 30, passingScore: 70, status: "draft" }); }} className="gap-2">
                   <Plus className="w-4 h-4" /> New Exam
                 </Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {examsLoading ? (
                   <div className="col-span-full flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                 ) : (
                   exams?.map((exam) => (
                     <Card key={exam.id} className="hover:border-primary transition-all overflow-hidden flex flex-col">
                       <CardHeader>
                         <div className="flex items-center justify-between mb-2">
                            <Badge variant={exam.status === 'published' ? 'default' : 'secondary'} className="uppercase text-[10px] font-bold">
                              {exam.status === 'published' ? 'Published' : 'Draft'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">{exam.timeLimitMinutes}m Limit</span>
                         </div>
                         <CardTitle className="text-lg">{exam.title}</CardTitle>
                         <CardDescription className="line-clamp-2">{exam.description}</CardDescription>
                       </CardHeader>
                       <CardContent className="flex items-center justify-between bg-muted/20 py-4 mt-auto">
                          <span className="text-xs font-bold text-muted-foreground uppercase">Pass: {exam.passingScore}%</span>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditExam(exam.id)}>
                              <Edit2 className="w-4 h-4" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setExamToDelete(exam.id)}>
                              <Trash2 className="w-4 h-4" /> Delete
                            </Button>
                          </div>
                       </CardContent>
                     </Card>
                   ))
                 )}
               </div>
            </div>
          )}

          {activeTab === 'authoring' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="space-y-2">
                 <h2 className="text-3xl font-bold">{editingExamId ? "Update Assessment" : "Exam Builder"}</h2>
                 <p className="text-muted-foreground">Author secure multiple-choice assessments with AI assistance.</p>
               </div>

               {isLoadingExam ? (
                 <div className="flex flex-col items-center justify-center p-20 gap-4">
                   <Loader2 className="w-10 h-10 animate-spin text-primary" />
                   <p className="text-muted-foreground font-bold">Loading secure assessment data...</p>
                 </div>
               ) : (
                 <>
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
                       <div className="flex justify-center pt-4">
                         <Button variant="outline" onClick={() => addQuestion()} className="gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 px-8">
                           <Plus className="w-4 h-4" /> Append Question
                         </Button>
                       </div>
                     </div>
                   </div>

                   <div className="fixed bottom-8 right-8 z-50 flex gap-4">
                     <Button variant="outline" onClick={() => setActiveTab('exams')} className="px-6 py-6 rounded-2xl">
                       Discard Changes
                     </Button>
                     <Button variant="secondary" className="px-8 py-6 text-lg rounded-2xl" onClick={(e) => handleSaveExam(e, "draft")}>
                       <Save className="w-4 h-4 mr-2" /> Save Draft
                     </Button>
                     <Button className="px-10 py-6 text-lg shadow-2xl btn-premium rounded-2xl" onClick={(e) => handleSaveExam(e, "published")}>
                       <Send className="w-4 h-4 mr-2" /> Publish Assessment
                     </Button>
                   </div>
                 </>
               )}
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

               <Card className="border-none shadow-sm overflow-hidden">
                 <div className="p-4 border-b bg-muted/20 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name or email..." 
                        className="pl-10" 
                        value={userSearch} 
                        onChange={(e) => setUserSearch(e.target.value)} 
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full md:w-[150px]">
                          <SelectValue placeholder="Filter Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                 </div>
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
                       {filteredUsers?.map((u) => (
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
                             <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)}>
                                 <Edit2 className="w-3 h-3" />
                               </Button>
                               <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setUserToDelete(u.id)}>
                                 <Trash2 className="w-3 h-3" />
                               </Button>
                             </div>
                           </TableCell>
                         </TableRow>
                       ))}
                       {filteredUsers?.length === 0 && (
                         <TableRow>
                           <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                             No identities match your criteria.
                           </TableCell>
                         </TableRow>
                       )}
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
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDownloadCSV} disabled={!filteredResults || filteredResults.length === 0} className="gap-2">
                    <Download className="w-4 h-4" /> Download Results (CSV)
                  </Button>
                  {selectedLogs.length > 0 && (
                    <Button 
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        const logs = filteredResults?.filter(r => selectedLogs.includes(r.id)) || [];
                        setLogsToDelete(logs);
                      }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete Selected ({selectedLogs.length})
                    </Button>
                  )}
                  <Button 
                    onClick={handleGradeAll} 
                    disabled={isGradingAll || !results || results.length === 0}
                    className="gap-2"
                  >
                    {isGradingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                    Grade All Results
                  </Button>
                </div>
              </div>

              <Card className="border-none shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/20 flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by student or exam..." 
                      className="pl-10" 
                      value={auditSearch} 
                      onChange={(e) => setAuditSearch(e.target.value)} 
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={auditExamFilter} onValueChange={setAuditExamFilter}>
                      <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="All Assessments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Assessments</SelectItem>
                        {uniqueExamTitles.map(title => (
                          <SelectItem key={title} value={title}>{title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={auditStatusFilter} onValueChange={setAuditStatusFilter}>
                      <SelectTrigger className="w-full md:w-[150px]">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Clean">Clean</SelectItem>
                        <SelectItem value="Flagged">Flagged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {resultsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox 
                            checked={filteredResults?.length > 0 && selectedLogs.length === filteredResults?.length}
                            onCheckedChange={() => toggleAllLogs(filteredResults || [])}
                          />
                        </TableHead>
                        <TableHead>Student Identity</TableHead>
                        <TableHead>Assessment Title</TableHead>
                        <TableHead>Attempt Time</TableHead>
                        <TableHead>Marks Gained</TableHead>
                        <TableHead>Calculated Score</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Integrity Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults?.map((res) => {
                        const examData = exams?.find(e => e.id === res.examId);
                        const isGraded = res.score !== undefined;
                        const isPassed = isGraded && res.score >= (examData?.passingScore || 0);
                        const attemptDate = getSafeDate(res.startedAt);

                        return (
                          <TableRow key={res.id} className={cn(selectedLogs.includes(res.id) && "bg-muted/50")}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedLogs.includes(res.id)}
                                onCheckedChange={() => toggleLogSelection(res.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="text-sm">{res.studentEmail}</span>
                            </TableCell>
                            <TableCell>{res.examTitle}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{attemptDate ? format(attemptDate, 'MMM dd, yyyy') : 'N/A'}</span>
                                <span className="text-[10px] text-muted-foreground">{attemptDate ? format(attemptDate, 'hh:mm a') : ''}</span>
                              </div>
                            </TableCell>
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
                              {isGraded ? (
                                <Badge 
                                  variant={isPassed ? 'default' : 'destructive'} 
                                  className={cn("gap-1 font-bold", isPassed ? "bg-emerald-500 hover:bg-emerald-600" : "")}
                                >
                                  {isPassed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {isPassed ? "PASS" : "FAIL"}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic text-[10px]">Unmarked</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={res.integrityStatus === 'Clean' ? 'outline' : 'destructive'} className="gap-1">
                                {res.integrityStatus === 'Flagged' && <AlertTriangle className="w-3 h-3" />}
                                {res.integrityStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDownloadSingle(res)}
                                  className="text-primary hover:text-primary hover:bg-primary/5"
                                  title="Download Individual Result"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
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
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-destructive"
                                  onClick={() => setLogsToDelete([res])}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredResults?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-10 text-muted-foreground italic">
                            No exam attempts match your criteria.
                          </TableCell>
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

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge System Identity?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this user from the gateway roster. They will lose all access and their results will be orphaned. This action is irreversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Identity</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">Purge Identity</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!logsToDelete} onOpenChange={(open) => !open && setLogsToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge Audit Records?</AlertDialogTitle>
            <AlertDialogDescription>
              {logsToDelete && logsToDelete.length > 1 
                ? `You are about to permanently delete ${logsToDelete.length} exam attempts. This action is irreversible and will remove all student performance data for these sessions.` 
                : "This specific exam attempt will be permanently removed from the audit logs."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Records</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLogs} className="bg-destructive text-destructive-foreground">Purge Records</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
