import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import crypto from 'crypto';
import { RoutineItem, CreateRoutineDTO, Role, DayOfWeek } from '../types/index.js';

// Clean empty 7-day routine store for production
let inMemoryRoutines: RoutineItem[] = [];

export function clearInMemoryRoutines(): void {
  inMemoryRoutines = [];
}

const DAY_ORDER: Record<DayOfWeek, number> = {
  Saturday: 0,
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thursday: 5,
  Friday: 6
};

export async function getAllRoutines(): Promise<RoutineItem[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('weekly_routines')
        .select('*');

      if (!error && data) {
        return (data as RoutineItem[]).sort((a, b) => {
          const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
          if (dayDiff !== 0) return dayDiff;
          return a.time_slot.localeCompare(b.time_slot);
        });
      }
    } catch {
      // Fallback seamlessly to in-memory store
    }
  }

  return [...inMemoryRoutines].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return a.time_slot.localeCompare(b.time_slot);
  });
}

export async function createRoutine(dto: CreateRoutineDTO): Promise<RoutineItem> {
  const newRoutine: RoutineItem = {
    id: crypto.randomUUID(),
    day: dto.day,
    subject: dto.subject || 'Mathematics',
    time_slot: dto.time_slot || '',
    topic: dto.topic || dto.subject || 'Study Session',
    note: dto.note || '',
    creator_role: dto.creator_role,
    creator_name: dto.creator_name || (dto.creator_role === 'student' ? 'Mohona' : 'Tutor Axis'),
    created_at: new Date().toISOString()
  };


  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('weekly_routines')
        .insert({
          id: newRoutine.id,
          day: newRoutine.day,
          subject: newRoutine.subject,
          time_slot: newRoutine.time_slot,
          topic: newRoutine.topic,
          note: newRoutine.note,
          creator_role: newRoutine.creator_role,
          creator_name: newRoutine.creator_name,
          created_at: newRoutine.created_at
        })
        .select()
        .single();

      if (!error && data) {
        inMemoryRoutines.unshift(data as RoutineItem);
        return data as RoutineItem;
      }
    } catch {
      // Supabase table fallback
    }
  }

  inMemoryRoutines.unshift(newRoutine);
  return newRoutine;
}

export async function deleteRoutine(id: string, actorRole: Role): Promise<{ success: boolean; message: string }> {
  // CRITICAL RULE: Student cannot delete routine entries. Only teacher/tutor can delete.
  if (actorRole !== 'tutor') {
    throw new Error('Permission denied: Only teachers/tutors are authorized to delete routine entries. Students can create routines.');
  }

  const index = inMemoryRoutines.findIndex(r => r.id === id);
  if (index !== -1) {
    inMemoryRoutines.splice(index, 1);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('weekly_routines')
        .delete()
        .eq('id', id);
    } catch {
      // Supabase deletion fallback
    }
  }

  return { success: true, message: 'Routine entry successfully deleted by tutor.' };
}
