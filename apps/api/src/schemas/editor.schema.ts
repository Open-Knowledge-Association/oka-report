import { z } from "zod";

export const CreateEditorSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1).optional(),
});

export const BulkCreateEditorSchema = z.object({
  usernames: z.array(z.string().min(1)).min(1),
});

export const UpdateEditorSchema = z.object({
  displayName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const EditorQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).optional(),
});
