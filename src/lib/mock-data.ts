
export type Question = {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
};

export type Exam = {
  id: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questions: Question[];
  createdBy: string;
};

export type Result = {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  startedAt: string;
  completedAt: string;
  integrityStatus: 'Clean' | 'Flagged';
};

export const MOCK_EXAMS: Exam[] = [
  {
    id: '1',
    title: 'Advanced Cybersecurity Principles',
    description: 'A comprehensive evaluation of zero-trust architectures and encryption standards.',
    timeLimitMinutes: 45,
    passingScore: 70,
    createdBy: 'Admin',
    questions: [
      {
        id: 'q1',
        questionText: 'What is the primary goal of a Zero Trust architecture?',
        options: ['Perimeter security', 'Implicit trust for internal users', 'Never trust, always verify', 'Simple password authentication'],
        correctOptionIndex: 2
      },
      {
        id: 'q2',
        questionText: 'Which encryption algorithm is considered asymmetric?',
        options: ['AES', 'DES', 'RSA', 'Blowfish'],
        correctOptionIndex: 2
      }
    ]
  },
  {
    id: '2',
    title: 'Cloud Infrastructure Management',
    description: 'Basics of AWS, Azure and GCP resource orchestration.',
    timeLimitMinutes: 30,
    passingScore: 65,
    createdBy: 'Admin',
    questions: []
  }
];

export const MOCK_RESULTS: Result[] = [
  {
    id: 'r1',
    studentId: 's1',
    studentName: 'John Doe',
    examId: '1',
    examTitle: 'Advanced Cybersecurity Principles',
    score: 85,
    totalQuestions: 10,
    startedAt: '2023-10-01T10:00:00Z',
    completedAt: '2023-10-01T10:35:00Z',
    integrityStatus: 'Clean'
  },
  {
    id: 'r2',
    studentId: 's1',
    studentName: 'John Doe',
    examId: '2',
    examTitle: 'Cloud Infrastructure Management',
    score: 40,
    totalQuestions: 10,
    startedAt: '2023-10-05T14:00:00Z',
    completedAt: '2023-10-05T14:28:00Z',
    integrityStatus: 'Flagged'
  }
];
