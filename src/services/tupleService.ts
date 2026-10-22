import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import crypto from 'crypto';
import { 
  TutorStudentPair, 
  TeacherProfile, 
  RequestConnectionDTO, 
  RespondConnectionDTO,
  Role
} from '../types/index.js';
import { sendTupleRequestEmail, sendTupleResponseEmail } from './emailService.js';
import { getAllInMemoryUsers } from './authService.js';
import { AppUser } from '../types/index.js';

let inMemoryTuples: TutorStudentPair[] = [];

export function clearInMemoryTuples(): void {
  inMemoryTuples = [];
}

/**
 * Returns all teachers and the student's connection status with each teacher
 */
export async function getAvailableTeachers(studentEmail?: string): Promise<TeacherProfile[]> {
  const normStudentEmail = studentEmail ? studentEmail.trim().toLowerCase() : '';

  // 1. Fetch teachers from Supabase app_users or fallback
  let teachers: Array<{ id: string; name: string; email: string }> = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, name, email')
        .eq('role', 'tutor')
        .order('name', { ascending: true });

      if (!error && data) {
        teachers = data;
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase error in getAvailableTeachers:', err.message);
    }
  }

  if (teachers.length === 0) {
    // In-memory fallback
    const allUsers: AppUser[] = getAllInMemoryUsers();
    teachers = allUsers
      .filter((u: AppUser) => u.role === 'tutor')
      .map((u: AppUser) => ({ id: u.id, name: u.name, email: u.email }));
  }

  // 2. Fetch existing pairs for this student
  let pairsForStudent: TutorStudentPair[] = [];
  if (normStudentEmail) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tutor_student_pairs')
          .select('*')
          .eq('student_email', normStudentEmail);

        if (!error && data) {
          pairsForStudent = data as TutorStudentPair[];
        }
      } catch (err: any) {
        console.warn('⚠️ Supabase error fetching student pairs:', err.message);
      }
    }

    if (pairsForStudent.length === 0) {
      pairsForStudent = inMemoryTuples.filter(
        p => p.student_email.toLowerCase() === normStudentEmail
      );
    }
  }

  // Map to TeacherProfile with status
  return teachers.map(t => {
    const normTutorEmail = t.email.trim().toLowerCase();
    const existingPair = pairsForStudent.find(
      p => p.tutor_email.trim().toLowerCase() === normTutorEmail
    );

    return {
      id: t.id,
      name: t.name,
      email: t.email,
      role: 'tutor' as const,
      connectionStatus: existingPair ? existingPair.status : 'none',
      pairId: existingPair?.id,
      pair: existingPair
    };
  });
}

/**
 * Retrieves all tuples for a student or tutor
 */
export async function getMyTuples(
  email: string, 
  role: Role
): Promise<{ all: TutorStudentPair[]; pending: TutorStudentPair[]; accepted: TutorStudentPair[] }> {
  const normEmail = email.trim().toLowerCase();
  let pairs: TutorStudentPair[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const field = role === 'student' ? 'student_email' : 'tutor_email';
      const { data, error } = await supabase
        .from('tutor_student_pairs')
        .select('*')
        .eq(field, normEmail)
        .order('created_at', { ascending: false });

      if (!error && data) {
        pairs = data as TutorStudentPair[];
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase error in getMyTuples:', err.message);
    }
  }

  if (pairs.length === 0) {
    pairs = inMemoryTuples.filter(p => {
      const field = role === 'student' ? p.student_email : p.tutor_email;
      return field.trim().toLowerCase() === normEmail;
    });
  }

  return {
    all: pairs,
    pending: pairs.filter(p => p.status === 'pending'),
    accepted: pairs.filter(p => p.status === 'accepted')
  };
}

/**
 * Student requests a connection with a teacher
 */
export async function requestConnection(dto: RequestConnectionDTO): Promise<TutorStudentPair> {
  const normTutorEmail = dto.tutor_email.trim().toLowerCase();
  const normStudentEmail = dto.student_email.trim().toLowerCase();
  const now = new Date().toISOString();

  // Look for existing pair
  let existingPair: TutorStudentPair | null = null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('tutor_student_pairs')
        .select('*')
        .eq('tutor_email', normTutorEmail)
        .eq('student_email', normStudentEmail)
        .single();
      if (data) existingPair = data as TutorStudentPair;
    } catch {
      // none
    }
  }

  if (!existingPair) {
    existingPair = inMemoryTuples.find(
      p => p.tutor_email.trim().toLowerCase() === normTutorEmail &&
           p.student_email.trim().toLowerCase() === normStudentEmail
    ) || null;
  }

  if (existingPair) {
    // If already accepted, return as is
    if (existingPair.status === 'accepted') {
      return existingPair;
    }

    // Re-request if previously rejected or pending
    const updated: TutorStudentPair = {
      ...existingPair,
      status: 'pending',
      student_name: dto.student_name || existingPair.student_name,
      tutor_name: dto.tutor_name || existingPair.tutor_name,
      updated_at: now
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('tutor_student_pairs')
          .update({
            status: 'pending',
            student_name: updated.student_name,
            tutor_name: updated.tutor_name,
            updated_at: now
          })
          .eq('id', updated.id);
      } catch (err: any) {
        console.warn('⚠️ Supabase error updating tuple request:', err.message);
      }
    }

    const memIndex = inMemoryTuples.findIndex(p => p.id === updated.id);
    if (memIndex !== -1) inMemoryTuples[memIndex] = updated;

    // Send email to teacher
    sendTupleRequestEmail({
      tutorName: updated.tutor_name,
      tutorEmail: updated.tutor_email,
      studentName: updated.student_name,
      studentEmail: updated.student_email
    }).catch(() => {});

    return updated;
  }

  // Create new tuple
  const newPair: TutorStudentPair = {
    id: crypto.randomUUID(),
    tutor_id: dto.tutor_id || 'tutor-1',
    tutor_email: normTutorEmail,
    tutor_name: dto.tutor_name || 'Teacher',
    student_id: dto.student_id || 'student-1',
    student_email: normStudentEmail,
    student_name: dto.student_name || 'Student',
    status: 'pending',
    created_at: now,
    updated_at: now
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('tutor_student_pairs')
        .insert([{
          id: newPair.id,
          tutor_id: newPair.tutor_id,
          tutor_email: newPair.tutor_email,
          tutor_name: newPair.tutor_name,
          student_id: newPair.student_id,
          student_email: newPair.student_email,
          student_name: newPair.student_name,
          status: newPair.status,
          created_at: newPair.created_at,
          updated_at: newPair.updated_at
        }])
        .select()
        .single();

      if (!error && data) {
        inMemoryTuples.unshift(data as TutorStudentPair);
        sendTupleRequestEmail({
          tutorName: newPair.tutor_name,
          tutorEmail: newPair.tutor_email,
          studentName: newPair.student_name,
          studentEmail: newPair.student_email
        }).catch(() => {});
        return data as TutorStudentPair;
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase insert error for tuple:', err.message);
    }
  }

  inMemoryTuples.unshift(newPair);

  // Dispatch request email to Teacher
  sendTupleRequestEmail({
    tutorName: newPair.tutor_name,
    tutorEmail: newPair.tutor_email,
    studentName: newPair.student_name,
    studentEmail: newPair.student_email
  }).catch(() => {});

  return newPair;
}

/**
 * Teacher responds to student request (accept or reject)
 */
export async function respondToRequest(dto: RespondConnectionDTO): Promise<TutorStudentPair> {
  const now = new Date().toISOString();
  let pair = await getTupleById(dto.tuple_id);

  if (!pair) {
    throw new Error('Connection request not found.');
  }

  const updatedPair: TutorStudentPair = {
    ...pair,
    status: dto.status,
    updated_at: now
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('tutor_student_pairs')
        .update({
          status: dto.status,
          updated_at: now
        })
        .eq('id', dto.tuple_id)
        .select()
        .single();

      if (!error && data) {
        pair = data as TutorStudentPair;
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase error updating tuple response:', err.message);
    }
  }

  const memIdx = inMemoryTuples.findIndex(p => p.id === dto.tuple_id);
  if (memIdx !== -1) {
    inMemoryTuples[memIdx] = updatedPair;
  } else {
    inMemoryTuples.unshift(updatedPair);
  }

  // Dispatch email to student
  sendTupleResponseEmail({
    studentName: updatedPair.student_name,
    studentEmail: updatedPair.student_email,
    tutorName: updatedPair.tutor_name,
    tutorEmail: updatedPair.tutor_email,
    status: dto.status
  }).catch(() => {});

  return updatedPair;
}

/**
 * Helper to fetch a single tuple by id
 */
export async function getTupleById(tupleId: string): Promise<TutorStudentPair | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('tutor_student_pairs')
        .select('*')
        .eq('id', tupleId)
        .single();

      if (!error && data) {
        return data as TutorStudentPair;
      }
    } catch {
      // fallback
    }
  }

  return inMemoryTuples.find(p => p.id === tupleId) || null;
}
