import { Request, Response } from 'express';
import * as taskService from '../services/taskService.js';
import { saveAttachmentFile } from '../services/storageService.js';
import { TaskStatus, Role } from '../types/index.js';
import { sendTaskChangeNotificationEmail } from '../services/emailService.js';

export async function getTasks(req: Request, res: Response): Promise<void> {
  try {
    const status = req.query.status as string | undefined;
    const student_id = req.query.student_id as string | undefined;
    const tasks = await taskService.getAllTasks({ status, student_id });
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getTaskById(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const task = await taskService.getTaskById(id);
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, subject, priority, deadline, creator_role, initial_note } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: 'Title is required' });
      return;
    }

    const newTask = await taskService.createTask({
      title: title.trim(),
      description: description ? description.trim() : '',
      subject: subject || 'General',
      priority: priority || 'medium',
      deadline: deadline || null,
      creator_role: creator_role || 'student',
      initial_note
    });

    // Notify corresponding student via email (action taken by tutor)
    sendTaskChangeNotificationEmail({
      event: 'task_created',
      taskTitle: newTask.title,
      subject: newTask.subject,
      priority: newTask.priority,
      actorName: newTask.tutor_name || 'Tutor Axis',
      actorRole: 'tutor',
      studentId: newTask.student_id,
      studentName: newTask.student_name,
      tutorId: newTask.tutor_id,
      tutorName: newTask.tutor_name,
      newStatus: newTask.status,
      details: newTask.description || 'New task assigned for study timetable.'
    }).catch(err => console.warn('⚠️ [Email Notification] error:', err.message));

    res.status(201).json({ success: true, data: newTask });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateTaskStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { status, actor_role, note, question_text } = req.body;

    if (!status) {
      res.status(400).json({ success: false, message: 'Status is required' });
      return;
    }

    await taskService.updateTaskStatus(id, {
      newStatus: status as TaskStatus,
      actorRole: (actor_role as Role) || 'student',
      note: note || ''
    });

    // If an update was raised with an accompanying question text, attach it automatically
    if (status === 'update raised' && question_text && question_text.trim()) {
      await taskService.addAttachment(id, {
        type: 'text_question',
        content: question_text.trim(),
        fileUrl: null,
        fileName: null,
        uploaderRole: (actor_role as Role) || 'student'
      });
    }

    const finalTask = await taskService.getTaskById(id);

    // Notify corresponding recipient: student -> teacher only; tutor -> student only
    if (finalTask) {
      sendTaskChangeNotificationEmail({
        event: 'status_updated',
        taskTitle: finalTask.title,
        subject: finalTask.subject,
        priority: finalTask.priority,
        actorName: (actor_role === 'student' ? (finalTask.student_name || 'Mohona') : (finalTask.tutor_name || 'Tutor Axis')),
        actorRole: (actor_role as Role) || 'student',
        studentId: finalTask.student_id,
        studentName: finalTask.student_name,
        tutorId: finalTask.tutor_id,
        tutorName: finalTask.tutor_name,
        newStatus: status,
        details: note || (question_text ? `Question: ${question_text}` : `Status transitioned to ${status}`)
      }).catch(err => console.warn('⚠️ [Email Notification] error:', err.message));
    }

    res.json({ success: true, data: finalTask });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { type = 'screenshot', question_text, uploader_role = 'student', content } = req.body;
    const file = req.file;

    const task = await taskService.getTaskById(id);
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (file) {
      const uploadResult = await saveAttachmentFile(file, id);
      fileUrl = uploadResult.fileUrl;
      fileName = uploadResult.fileName;
    }

    const attachmentType = file ? 'screenshot' : (type || 'text_question');
    const attachmentContent = question_text || content || (file ? `Attached problem screenshot: ${fileName}` : '');

    const attachment = await taskService.addAttachment(id, {
      type: attachmentType,
      content: attachmentContent,
      fileUrl,
      fileName,
      uploaderRole: (uploader_role as Role) || 'student'
    });

    // Optionally auto-transition to 'update raised' if requested
    if (req.body.auto_raise_update === 'true' || req.body.auto_raise_update === true) {
      await taskService.updateTaskStatus(id, {
        newStatus: 'update raised',
        actorRole: (uploader_role as Role) || 'student',
        note: `Attached ${attachmentType === 'screenshot' ? 'screenshot' : 'question'}: ${attachmentContent.substring(0, 60)}...`
      });
    }

    const refreshedTask = await taskService.getTaskById(id);

    // Notify corresponding recipient (student -> teacher only; tutor -> student only)
    if (refreshedTask) {
      sendTaskChangeNotificationEmail({
        event: 'attachment_added',
        taskTitle: refreshedTask.title,
        subject: refreshedTask.subject,
        priority: refreshedTask.priority,
        actorName: (uploader_role === 'student' ? (refreshedTask.student_name || 'Mohona') : (refreshedTask.tutor_name || 'Tutor Axis')),
        actorRole: (uploader_role as Role) || 'student',
        studentId: refreshedTask.student_id,
        studentName: refreshedTask.student_name,
        tutorId: refreshedTask.tutor_id,
        tutorName: refreshedTask.tutor_name,
        details: attachmentType === 'screenshot' 
          ? `Uploaded problem screenshot (${fileName || 'image'}). ${attachmentContent}`
          : `Attached question: ${attachmentContent}`,
        imageUrl: fileUrl
      }).catch(err => console.warn('⚠️ [Email Notification] error:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Attachment saved successfully',
      data: attachment,
      task: refreshedTask
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function addComment(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { message, author_role, author_name } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: 'Message cannot be empty' });
      return;
    }

    const comment = await taskService.addComment(id, {
      authorRole: (author_role as Role) || 'student',
      authorName: author_name,
      message: message.trim()
    });

    const refreshedTask = await taskService.getTaskById(id);

    // Notify corresponding recipient (student -> teacher only; tutor -> student only)
    if (refreshedTask) {
      sendTaskChangeNotificationEmail({
        event: 'comment_added',
        taskTitle: refreshedTask.title,
        subject: refreshedTask.subject,
        priority: refreshedTask.priority,
        actorName: author_name || (author_role === 'tutor' ? 'Tutor Axis' : 'Mohona'),
        actorRole: (author_role as Role) || 'student',
        studentId: refreshedTask.student_id,
        studentName: refreshedTask.student_name,
        tutorId: refreshedTask.tutor_id,
        tutorName: refreshedTask.tutor_name,
        details: message.trim()
      }).catch(err => console.warn('⚠️ [Email Notification] error:', err.message));
    }

    res.status(201).json({ success: true, data: comment, task: refreshedTask });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Delete a task and all associated storage files.
 * Strictly restricted to tutors only.
 */
export async function deleteTask(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const actorRole = (req.body?.actor_role || req.query?.actor_role || req.headers['x-user-role'] || 'student') as string;

    if (actorRole !== 'tutor') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only tutors have the authority to delete tasks.'
      });
      return;
    }

    const deleted = await taskService.deleteTask(id, actorRole);

    // Notify corresponding student only (action taken by tutor)
    sendTaskChangeNotificationEmail({
      event: 'task_deleted',
      taskTitle: deleted.title,
      subject: deleted.subject,
      priority: deleted.priority,
      actorName: deleted.tutor_name || 'Tutor Axis',
      actorRole: 'tutor',
      studentId: deleted.student_id,
      studentName: deleted.student_name,
      tutorId: deleted.tutor_id,
      tutorName: deleted.tutor_name,
      details: 'This task and all its associated problem screenshots were permanently deleted by the tutor.'
    }).catch(err => console.warn('⚠️ [Email Notification] error:', err.message));

    res.json({
      success: true,
      message: 'Task and related images deleted successfully',
      data: deleted
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes('not found');
    const isForbidden = error.message?.includes('Only tutors') || error.message?.includes('Forbidden');
    res.status(isForbidden ? 403 : isNotFound ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
}

