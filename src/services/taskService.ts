import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import crypto from 'crypto';
import { 
  Task, 
  TaskStatus, 
  Attachment, 
  TimelineEvent, 
  TaskComment, 
  CreateTaskDTO, 
  UpdateStatusDTO, 
  UpdateTaskDTO,
  AddAttachmentDTO, 
  AddCommentDTO 
} from '../types/index.js';

// Clean empty task store for production
let inMemoryTasks: Task[] = [];

export function clearInMemoryTasks(): void {
  inMemoryTasks = [];
}

export async function getAllTasks(filters: { status?: string; student_id?: string; tuple_id?: string } = {}): Promise<Task[]> {
  const { status, student_id, tuple_id } = filters;

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          attachments (*),
          timeline_events (*),
          comments:task_comments (*)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (student_id) {
        query = query.eq('student_id', student_id);
      }
      if (tuple_id) {
        query = query.eq('tuple_id', tuple_id);
      }

      const { data, error } = await query;
      if (!error && data) return data as Task[];
      console.warn('⚠️ Supabase fetch error, fallback to memory:', error?.message);
    } catch (err: any) {
      console.warn('⚠️ Supabase error in getAllTasks:', err.message);
    }
  }

  // Fallback
  return inMemoryTasks.filter(task => {
    if (status && status !== 'all' && task.status !== status) return false;
    if (student_id && task.student_id !== student_id) return false;
    if (tuple_id && task.tuple_id !== tuple_id) return false;
    return true;
  });
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          attachments (*),
          timeline_events (*),
          comments:task_comments (*)
        `)
        .eq('id', taskId)
        .single();

      if (!error && data) return data as Task;
    } catch (err: any) {
      console.warn('⚠️ Supabase error in getTaskById:', err.message);
    }
  }

  return inMemoryTasks.find(t => t.id === taskId) || null;
}

export async function createTask(taskData: CreateTaskDTO): Promise<Task> {
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  const formattedTask: Task = {
    id: newId,
    tuple_id: taskData.tuple_id || null,
    title: taskData.title,
    description: taskData.description || '',
    subject: taskData.subject || 'General',
    status: taskData.status || 'start',
    student_id: taskData.student_id || 'student-1',
    student_name: taskData.student_name || 'Mohona',
    tutor_id: taskData.tutor_id || 'tutor-1',
    tutor_name: taskData.tutor_name || 'Tutor Axis',
    priority: taskData.priority || 'medium',
    deadline: taskData.deadline || null,
    created_at: now,
    updated_at: now,
    attachments: [],
    timeline_events: [
      {
        id: crypto.randomUUID(),
        task_id: newId,
        from_status: null,
        to_status: taskData.status || 'start',
        actor_role: taskData.creator_role || 'student',
        note: taskData.initial_note || 'Task created and added to timeline.',
        created_at: now
      }
    ],
    comments: []
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: insertedTask, error: insertError } = await supabase
        .from('tasks')
        .insert([{
          id: formattedTask.id,
          tuple_id: formattedTask.tuple_id,
          title: formattedTask.title,
          description: formattedTask.description,
          subject: formattedTask.subject,
          status: formattedTask.status,
          student_id: formattedTask.student_id,
          student_name: formattedTask.student_name,
          tutor_id: formattedTask.tutor_id,
          tutor_name: formattedTask.tutor_name,
          priority: formattedTask.priority,
          deadline: formattedTask.deadline,
          created_at: formattedTask.created_at,
          updated_at: formattedTask.updated_at
        }])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Supabase insert error in createTask:', insertError.message);
      } else if (insertedTask) {
        await supabase.from('timeline_events').insert([{
          id: formattedTask.timeline_events![0].id,
          task_id: formattedTask.id,
          from_status: null,
          to_status: formattedTask.status,
          actor_role: formattedTask.timeline_events![0].actor_role,
          note: formattedTask.timeline_events![0].note,
          created_at: now
        }]);

        return { ...insertedTask, attachments: [], timeline_events: formattedTask.timeline_events, comments: [] } as Task;
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase exception in createTask:', err.message);
    }
  }

  inMemoryTasks.unshift(formattedTask);
  return formattedTask;
}

export async function updateTaskStatus(
  taskId: string, 
  { newStatus, actorRole = 'student', note = '' }: UpdateStatusDTO
): Promise<Task> {
  const validStatuses: TaskStatus[] = ['start', 'ongoing', 'update raised', 'done'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
  }

  const now = new Date().toISOString();
  const timelineEvent: TimelineEvent = {
    id: crypto.randomUUID(),
    task_id: taskId,
    from_status: null,
    to_status: newStatus,
    actor_role: actorRole,
    note: note || `Status transitioned to ${newStatus} by ${actorRole}`,
    created_at: now
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('status')
        .eq('id', taskId)
        .single();

      timelineEvent.from_status = (currentTask?.status as TaskStatus) || null;

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: now })
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Supabase error in updateTaskStatus:', updateError.message);
      } else {
        await supabase.from('timeline_events').insert([timelineEvent]);
        const task = await getTaskById(taskId);
        if (task) return task;
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase exception in updateTaskStatus:', err.message);
    }
  }

  const taskIndex = inMemoryTasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) throw new Error('Task not found');

  timelineEvent.from_status = inMemoryTasks[taskIndex].status;
  inMemoryTasks[taskIndex].status = newStatus;
  inMemoryTasks[taskIndex].updated_at = now;
  if (!inMemoryTasks[taskIndex].timeline_events) {
    inMemoryTasks[taskIndex].timeline_events = [];
  }
  inMemoryTasks[taskIndex].timeline_events!.push(timelineEvent);

  return inMemoryTasks[taskIndex];
}

export async function updateTask(taskId: string, dto: UpdateTaskDTO): Promise<Task> {
  const now = new Date().toISOString();
  const existing = await getTaskById(taskId);
  if (!existing) {
    throw new Error(`Task not found with ID: ${taskId}`);
  }

  const updatedFields: Partial<Task> = {
    title: dto.title.trim(),
    description: dto.description !== undefined ? dto.description.trim() : existing.description,
    subject: dto.subject || existing.subject,
    priority: dto.priority || existing.priority,
    deadline: dto.deadline !== undefined ? dto.deadline : existing.deadline,
    updated_at: now
  };

  const editTimelineEvent: TimelineEvent = {
    id: crypto.randomUUID(),
    task_id: taskId,
    from_status: existing.status,
    to_status: existing.status,
    actor_role: dto.actor_role,
    note: `Task details edited by ${dto.actor_name || dto.actor_role}`,
    created_at: now
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: updatedFields.title,
          description: updatedFields.description,
          subject: updatedFields.subject,
          priority: updatedFields.priority,
          deadline: updatedFields.deadline,
          updated_at: now
        })
        .eq('id', taskId)
        .select(`
          *,
          attachments (*),
          timeline_events (*),
          comments:task_comments (*)
        `)
        .single();

      if (!error && data) {
        // Record timeline event
        try {
          await supabase.from('timeline_events').insert([{
            id: editTimelineEvent.id,
            task_id: taskId,
            from_status: editTimelineEvent.from_status,
            to_status: editTimelineEvent.to_status,
            actor_role: editTimelineEvent.actor_role,
            note: editTimelineEvent.note,
            created_at: now
          }]);
        } catch {
          // timeline insert fallback
        }

        const fresh = await getTaskById(taskId);
        return fresh || (data as Task);
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase error in updateTask:', err.message);
    }
  }

  // In-memory fallback
  const idx = inMemoryTasks.findIndex(t => t.id === taskId);
  if (idx !== -1) {
    inMemoryTasks[idx] = {
      ...inMemoryTasks[idx],
      ...updatedFields,
      timeline_events: [editTimelineEvent, ...(inMemoryTasks[idx].timeline_events || [])]
    };
    return inMemoryTasks[idx];
  }

  return { ...existing, ...updatedFields };
}

export async function addAttachment(
  taskId: string, 
  { type, content, fileUrl, fileName, uploaderRole = 'student' }: AddAttachmentDTO
): Promise<Attachment> {
  const now = new Date().toISOString();
  const attachment: Attachment = {
    id: crypto.randomUUID(),
    task_id: taskId,
    type,
    content: content || '',
    file_url: fileUrl || null,
    file_name: fileName || null,
    uploader_role: uploaderRole,
    created_at: now
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('attachments')
        .insert([attachment])
        .select()
        .single();

      if (!error && data) {
        return data as Attachment;
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase error in addAttachment:', err.message);
    }
  }

  const task = inMemoryTasks.find(t => t.id === taskId);
  if (task) {
    if (!task.attachments) task.attachments = [];
    task.attachments.push(attachment);
    task.updated_at = now;
  }
  return attachment;
}

export async function addComment(
  taskId: string, 
  { authorRole = 'student', authorName, message }: AddCommentDTO
): Promise<TaskComment> {
  const now = new Date().toISOString();
  const comment: TaskComment = {
    id: crypto.randomUUID(),
    task_id: taskId,
    author_role: authorRole,
    author_name: authorName || (authorRole === 'tutor' ? 'Tutor Axis' : 'Mohona'),
    message,
    created_at: now
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert([comment])
        .select()
        .single();

      if (!error && data) return data as TaskComment;
    } catch (err: any) {
      console.warn('⚠️ Supabase error in addComment:', err.message);
    }
  }

  const task = inMemoryTasks.find(t => t.id === taskId);
  if (task) {
    if (!task.comments) task.comments = [];
    task.comments.push(comment);
    task.updated_at = now;
  }
  return comment;
}

/**
 * Permanently deletes a task, cascading DB records and removing related storage files.
 * Authority restricted strictly to tutors only.
 */
export async function deleteTask(taskId: string, actorRole: string): Promise<Task> {
  if (actorRole !== 'tutor') {
    throw new Error('Forbidden: Only tutors have the authority to delete tasks.');
  }

  // 1. Retrieve the task with its attachments first
  const task = await getTaskById(taskId);
  if (!task) {
    throw new Error(`Task not found with ID: ${taskId}`);
  }

  // 2. Remove all related image files from Supabase Storage bucket
  if (task.attachments && task.attachments.length > 0 && isSupabaseConfigured && supabase) {
    const bucketName = process.env.STORAGE_BUCKET || 'problem-screenshots';
    const filesToRemove: string[] = [];

    for (const att of task.attachments) {
      if (att.file_url) {
        // Extract fileName from URL
        const parts = att.file_url.split('/');
        const extracted = parts[parts.length - 1]?.split('?')[0];
        if (extracted) filesToRemove.push(extracted);
      }
      if (att.file_name && !filesToRemove.includes(att.file_name)) {
        filesToRemove.push(att.file_name);
      }
    }

    if (filesToRemove.length > 0) {
      try {
        const { error: storageErr } = await supabase.storage.from(bucketName).remove(filesToRemove);
        if (storageErr) {
          console.warn('⚠️ Supabase storage file removal error:', storageErr.message);
        } else {
          console.log(`🗑️ Successfully deleted ${filesToRemove.length} storage file(s) for task: ${taskId}`);
        }
      } catch (e: any) {
        console.warn('⚠️ Exception deleting storage files for task:', e.message);
      }
    }
  }

  // 3. Delete from Supabase PostgreSQL (cascade deletes attachments, timeline_events, comments)
  if (isSupabaseConfigured && supabase) {
    try {
      const { error: dbErr } = await supabase.from('tasks').delete().eq('id', taskId);
      if (dbErr) {
        console.error('❌ Supabase error deleting task:', dbErr.message);
        throw new Error(`Database error deleting task: ${dbErr.message}`);
      }
      console.log(`✅ [Supabase] Deleted task from database: ${taskId}`);
    } catch (e: any) {
      console.warn('⚠️ Supabase exception in deleteTask:', e.message);
    }
  }

  // 4. Remove from in-memory fallback
  inMemoryTasks = inMemoryTasks.filter(t => t.id !== taskId);

  return task;
}
