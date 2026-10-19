import { Request, Response } from 'express';
import * as taskService from '../services/taskService.js';
import { saveAttachmentFile } from '../services/storageService.js';
import { TaskStatus, Role } from '../types/index.js';

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
    res.status(201).json({ success: true, data: comment, task: refreshedTask });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
