/**
 * Outreach Dashboard API Type Definitions
 *
 * Types for Outreach Dashboard API responses from:
 * https://outreachdashboard.wmflabs.org/courses/
 */

export interface OutreachCourse {
  id: number;
  title: string;
  description: string;
  start: string; // ISO 8601 timestamp
  end: string; // ISO 8601 timestamp
  school: string;
  subject: string;
  slug: string;
  url: string | null;
  submitted: boolean;
  expected_students: number;
  timeline_start: string; // ISO 8601 timestamp
  timeline_end: string; // ISO 8601 timestamp
  day_exceptions: string;
  weekdays: string;
  no_day_exceptions: boolean;
  updated_at: string; // ISO 8601 timestamp
  string_prefix: string;
  use_start_and_end_times: boolean;
  type: string; // e.g., "BasicCourse"
  home_wiki: {
    id: number;
    language: string; // e.g., "en"
    project: string; // e.g., "wikipedia"
  };
  character_sum: number;
  upload_count: number;
  uploads_in_use_count: number;
  upload_usages_count: number;
  cloned_status: string | null;
  flags: {
    academic_system: string | null;
    format: string;
    timeslice_duration: {
      default: number;
    };
    longest_update: number;
    first_update: {
      enqueued_at: string; // ISO 8601 timestamp
      queue_name: string;
      queue_latency: number;
    };
    timeline_enabled: boolean;
    wiki_edits_enabled: boolean;
    online_volunteers_enabled: boolean;
    disable_student_emails: boolean;
    stay_in_sandbox: boolean;
    no_sandboxes: boolean;
    retain_available_articles: boolean;
    edit_settings: {
      wiki_course_page_enabled: boolean;
      assignment_edits_enabled: boolean;
      enrollment_edits_enabled: boolean;
    };
    unfinished_update_logs: Record<string, unknown>;
    update_logs: Record<
      string,
      {
        start_time: string; // ISO 8601 timestamp
        end_time: string; // ISO 8601 timestamp
        sentry_tag_uuid: string;
        error_count: number;
        processed: number;
        reprocessed: number;
      }
    >;
    average_update_delay: number;
  };
  level: string;
  private: boolean;
  closed?: boolean;
  training_library_slug: string;
  peer_review_count: number | null;
  needs_update: boolean;
  update_until: string; // ISO 8601 timestamp
  withdrawn: boolean;
  created_at: string; // ISO 8601 timestamp
  wikis: Array<{
    language: string;
    project: string;
  }>;
  namespaces: string[];
  timeslice_update_ran: boolean;
  disable_student_emails: boolean;
  academic_system: string | null;
  home_wiki_bytes_per_word: number;
  home_wiki_edits_enabled: boolean;
  wiki_edits_enabled: boolean;
  assignment_edits_enabled: boolean;
  wiki_course_page_enabled: boolean;
  enrollment_edits_enabled: boolean;
  account_requests_enabled: boolean;
  online_volunteers_enabled: boolean;
  progress_tracker_enabled: boolean;
  stay_in_sandbox: boolean;
  no_sandboxes: boolean;
  retain_available_articles: boolean;
  review_bibliography: boolean;
  term: string;
  legacy: boolean;
  ended: boolean;
  published: boolean;
  enroll_url: string;
  wiki_string_prefix: string;
  returning_instructor: boolean;
  course_stats: {
    id: number;
    stats_hash: Record<
      string,
      {
        edited_count: string;
        new_count: string;
        revision_count: string;
        user_count: string;
        word_count: string;
        reference_count: string;
        view_count: string;
      }
    >;
  };
  created_count: string;
  edited_count: string;
  article_count: number;
  edit_count: string;
  student_count: number;
  trained_count: number;
  word_count: string;
  references_count: string;
  view_count: string;
  character_sum_human: string;
  updates: {
    average_delay: number;
    last_update: {
      start_time: string; // ISO 8601 timestamp
      end_time: string; // ISO 8601 timestamp
      sentry_tag_uuid: string;
      error_count: number;
      processed: number;
      reprocessed: number;
    };
  };
  passcode: string;
  canUploadSyllabus: boolean;
}

export interface OutreachUser {
  id: number;
  username: string;
  character_sum_ms: number; // Main space character sum
  character_sum_us: number; // User space character sum
  character_sum_draft: number; // Draft space character sum
  references_count: number;
  role: number; // 0 = student, 1 = instructor, etc.
  role_description: string | null;
  recent_revisions: number;
  content_expert: boolean;
  program_manager: boolean;
  contribution_url: string;
  sandbox_url: string;
  global_contribution_url: string;
  total_uploads: number;
  enrolled_at: string; // ISO 8601 timestamp
  admin: boolean;
  // Additional fields from test data
  name?: string;
  real_name?: string;
  email?: string;
}

export interface OutreachUpload {
  id: number;
  file_name: string;
  uploader: string; // Username of uploader
  uploaded_at: string; // ISO 8601 timestamp
  url: string;
  thumburl: string;
  thumbwidth: number;
  thumbheight: number;
  usage_count: number;
  deleted: boolean;
  // Additional fields from test data
  title?: string;
  date?: string;
}

// Response wrappers as expected by the tests
export interface CourseData {
  course: OutreachCourse;
}

export interface UserData {
  course?: {
    users: OutreachUser[];
  };
  users?: OutreachUser[];
}

export interface UploadData {
  uploads: OutreachUpload[];
}
