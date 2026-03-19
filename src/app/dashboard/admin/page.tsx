
"use client"

import { useState } from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, LayoutDashboard, FileText, Users, ShieldAlert, Sparkles, Search } from "lucide-react"
import { MOCK_EXAMS, MOCK_RESULTS } from "@/lib/mock-data"
import { generateQuestionIdeas, type GenerateQuestionIdeasOutput } from "@/ai/flows/admin-question-idea-generator"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function AdminDashboard() {
  const containerRef = useScrollReveal()
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiIdeas, setAiIdeas] = useState<GenerateQuestionIdeasOutput | null>(null)
  const [topic, setTopic] = useState("")

  const handleGenerate = async () => {
    if (!topic) return
    setIsGenerating(true)
    try {
      const ideas = await generateQuestionIdeas({ topic, difficultyLevel: 'medium' })
      setAiIdeas(ideas)
    } catch (error) {
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ShieldAlert className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-xl hidden sm:inline-block">Admin Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs">v2.1 Premium</Badge>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/'}>Logout</Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4 sm:p-8 space-y-8">
        <header className="reveal-up flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
            <p className="text-muted-foreground">Manage assessments and monitor integrity metrics.</p>
          </div>
          <Button className="btn-premium flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create New Exam
          </Button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Active Exams", value: "12", icon: FileText, color: "text-blue-500" },
            { label: "Total Students", value: "248", icon: Users, color: "text-indigo-500" },
            { label: "Completion Rate", value: "94%", icon: LayoutDashboard, color: "text-emerald-500" },
            { label: "Integrity Alerts", value: "3", icon: ShieldAlert, color: "text-red-500" },
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
            <TabsTrigger value="results" className="h-full px-6">Results & Integrity</TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {MOCK_EXAMS.map((exam) => (
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
                      <span>Questions: {exam.questions.length}</span>
                      <span>Pass: {exam.passingScore}%</span>
                    </div>
                    <Button variant="ghost" size="sm" className="group-hover:text-primary">Edit Details</Button>
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
                <CardDescription>
                  Enter a topic to generate diverse question ideas using GenAI.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="e.g. Network Security Fundamentals" 
                      className="pl-10 h-12"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleGenerate} 
                    disabled={isGenerating || !topic}
                    className="h-12 btn-premium"
                  >
                    {isGenerating ? "Analyzing..." : "Generate Ideas"}
                  </Button>
                </div>

                {aiIdeas && (
                  <ScrollArea className="h-[400px] rounded-lg border p-4 bg-muted/20">
                    <div className="space-y-4">
                      {aiIdeas.questions.map((q, idx) => (
                        <Card key={idx} className="bg-card animate-in slide-in-from-bottom-2 duration-300">
                          <CardHeader className="p-4">
                            <CardTitle className="text-sm font-semibold">Idea {idx + 1}</CardTitle>
                            <p className="text-md">{q.questionText}</p>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.suggestedOptions.map((opt, oIdx) => (
                                <div key={oIdx} className={`text-xs p-2 rounded border ${oIdx === q.correctOptionIndex ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-bold' : 'bg-background'}`}>
                                  {opt}
                                </div>
                              ))}
                            </div>
                            <Button variant="link" size="sm" className="p-0 h-auto text-xs">Add to current exam builder</Button>
                          </CardContent>
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
               <CardHeader>
                 <CardTitle>Global Integrity Log</CardTitle>
                 <CardDescription>Real-time monitoring of active and completed sessions.</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   {MOCK_RESULTS.map((res) => (
                     <div key={res.id} className="flex items-center justify-between p-4 border rounded-lg">
                       <div className="flex items-center gap-4">
                         <div className={`w-2 h-10 rounded-full ${res.integrityStatus === 'Clean' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                         <div>
                           <p className="font-semibold">{res.studentName}</p>
                           <p className="text-xs text-muted-foreground">{res.examTitle}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="font-bold">{res.score}/{res.totalQuestions*10}</p>
                         <Badge variant={res.integrityStatus === 'Clean' ? 'secondary' : 'destructive'} className="text-[10px] h-4">
                           {res.integrityStatus}
                         </Badge>
                       </div>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
