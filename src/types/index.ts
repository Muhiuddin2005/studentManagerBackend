export type TaskStatus = 'start' | 'ongoing' | 'update raised' | 'done';
export type Role = 'student' | 'tutor';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type AttachmentType = 'text_question' | 'screenshot' | 'solution' | 'feedback';

export interface Attachment {
  id: string;
  task_id: string;
  type: AttachmentType;
  content: string;
  file_url: string | null;
  file_name: string | null;
  uploader_role: Role;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  actor_role: Role;
  note: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_role: Role;
  author_name: string;
  message: string;
  created_at: string;
}

export interface Task {
  id: string;
  tuple_id?: string | null;
  title: string;
  description: string;
  subject: string;
  status: TaskStatus;
  student_id: string;
  student_name: string;
  tutor_id: string;
  tutor_name: string;
  priority: Priority;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  timeline_events?: TimelineEvent[];
  comments?: TaskComment[];
}

export interface CreateTaskDTO {
  title: string;
  tuple_id?: string | null;
  description?: string;
  subject?: string;
  priority?: Priority;
  deadline?: string | null;
  creator_role?: Role;
  initial_note?: string;
  student_id?: string;
  student_name?: string;
  tutor_id?: string;
  tutor_name?: string;
  status?: TaskStatus;
}

export interface UpdateStatusDTO {
  newStatus: TaskStatus;
  actorRole?: Role;
  note?: string;
}

export interface AddAttachmentDTO {
  type: AttachmentType;
  content?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  uploaderRole?: Role;
}

export interface AddCommentDTO {
  authorRole?: Role;
  authorName?: string;
  message: string;
}

// User & Authentication Types
export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // Plain password as requested (without hashing)
  role: Role;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegisterDTO {
  name: string;
  email: string;
  password: string; // Plain password as requested (without hashing)
  role?: Role;
}

export interface VerifyEmailDTO {
  email: string;
  code: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export type PasswordOnlyLoginDTO = LoginDTO;

export interface VerifyLoginOtpDTO {
  email: string;
  code: string;
}

export interface AuthResponseDTO {
  success: boolean;
  message?: string;
  token?: string;
  user?: Omit<AppUser, 'password'>;
  step?: 'completed' | 'verify_otp';
  email?: string;
  maskedEmail?: string;
}

export interface VerificationCodeRecord {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  created_at: string;
  type?: 'login' | 'register';
}


// 7-Day Weekly Routine Types
export type DayOfWeek = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface RoutineItem {
  id: string;
  tuple_id?: string | null;
  day: DayOfWeek;
  subject: string;
  time_slot: string;
  topic: string;
  note?: string;
  creator_role: Role;
  creator_name: string;
  created_at: string;
}

export interface CreateRoutineDTO {
  day: DayOfWeek;
  tuple_id?: string | null;
  subject: string;
  time_slot?: string;
  topic?: string;
  note?: string;
  creator_role: Role;
  creator_name?: string;
}

// Teacher-Student Tuple / Pairing Types
export type TupleStatus = 'pending' | 'accepted' | 'rejected';

export interface TutorStudentPair {
  id: string;
  tutor_id: string;
  tutor_email: string;
  tutor_name: string;
  student_id: string;
  student_email: string;
  student_name: string;
  status: TupleStatus;
  created_at: string;
  updated_at: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  role: 'tutor';
  connectionStatus: 'none' | 'pending' | 'accepted' | 'rejected';
  pairId?: string;
  pair?: TutorStudentPair;
}

export interface RequestConnectionDTO {
  tutor_email: string;
  tutor_name?: string;
  tutor_id?: string;
  student_email: string;
  student_name: string;
  student_id?: string;
}

export interface RespondConnectionDTO {
  tuple_id: string;
  status: 'accepted' | 'rejected';
  actor_email?: string;
}



