export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          role: string;
          total_minutes_all_time: number;
          current_streak: number;
          max_streak: number;
          is_pro_member: boolean;
          pro_expires_at: string | null;
          pro_cancelled: boolean;
          created_at: string;
          updated_at: string;
          // Gamification fields
          xp_points: number;
          xp_level: number;
          streak_shields_remaining: number;
          streak_shields_reset_at: string | null;
          profile_frame: string | null;
          study_goal_weekly_minutes: number | null;
          study_goal_monthly_minutes: number | null;
          // Study AI daily limit tracking
          study_ai_generations_today: number;
          study_ai_last_generation_date: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: string;
          total_minutes_all_time?: number;
          current_streak?: number;
          max_streak?: number;
          is_pro_member?: boolean;
          pro_expires_at?: string | null;
          pro_cancelled?: boolean;
          created_at?: string;
          updated_at?: string;
          xp_points?: number;
          xp_level?: number;
          streak_shields_remaining?: number;
          streak_shields_reset_at?: string | null;
          profile_frame?: string | null;
          study_goal_weekly_minutes?: number | null;
          study_goal_monthly_minutes?: number | null;
          study_ai_generations_today?: number;
          study_ai_last_generation_date?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: string;
          total_minutes_all_time?: number;
          current_streak?: number;
          max_streak?: number;
          is_pro_member?: boolean;
          pro_expires_at?: string | null;
          pro_cancelled?: boolean;
          created_at?: string;
          updated_at?: string;
          xp_points?: number;
          xp_level?: number;
          streak_shields_remaining?: number;
          streak_shields_reset_at?: string | null;
          profile_frame?: string | null;
          study_goal_weekly_minutes?: number | null;
          study_goal_monthly_minutes?: number | null;
          study_ai_generations_today?: number;
          study_ai_last_generation_date?: string | null;
        };
      };
      daily_study_logs: {
        Row: {
          id: number;
          user_id: string;
          study_date: string;
          minutes_studied: number;
        };
        Insert: {
          id?: number;
          user_id: string;
          study_date?: string;
          minutes_studied?: number;
        };
        Update: {
          id?: number;
          user_id?: string;
          study_date?: string;
          minutes_studied?: number;
        };
      };
      exam_categories: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          icon: string | null;
          sort_order: number;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
        };
      };
      tests: {
        Row: {
          id: number;
          title: string;
          description: string | null;
          category_id: number | null;
          is_premium: boolean;
          duration_minutes: number;
          total_marks: number | null;
          passing_marks: number | null;
          created_by: string | null;
          created_at: string;
          test_type: "mcq" | "conventional" | "mixed";
          difficulty: "easy" | "moderate" | "hard" | "none";
        };
        Insert: {
          id?: number;
          title: string;
          description?: string | null;
          category_id?: number | null;
          is_premium?: boolean;
          duration_minutes?: number;
          total_marks?: number | null;
          passing_marks?: number | null;
          created_by?: string | null;
          created_at?: string;
          test_type?: "mcq" | "conventional" | "mixed";
          difficulty?: "easy" | "moderate" | "hard" | "none";
        };
        Update: {
          id?: number;
          title?: string;
          description?: string | null;
          category_id?: number | null;
          is_premium?: boolean;
          duration_minutes?: number;
          total_marks?: number | null;
          passing_marks?: number | null;
          created_by?: string | null;
          created_at?: string;
          test_type?: "mcq" | "conventional" | "mixed";
          difficulty?: "easy" | "moderate" | "hard" | "none";
        };
      };
      questions: {
        Row: {
          id: number;
          test_id: number;
          content: string;
          type: string;
          options: Json | null;
          correct_answer: string | null;
          marks: number;
          negative_marks: number;
          explanation: string | null;
          sort_order: number;
          word_limit: number | null;
          model_answer: string | null;
          evaluation_criteria: Json | null;
          section_id: number | null;
          ai_explanation: Json | null; // Pregenerated AI explanation for MCQs
        };
        Insert: {
          id?: number;
          test_id: number;
          content: string;
          type: string;
          options?: Json | null;
          correct_answer?: string | null;
          marks?: number;
          negative_marks?: number;
          explanation?: string | null;
          sort_order?: number;
          word_limit?: number | null;
          model_answer?: string | null;
          evaluation_criteria?: Json | null;
          section_id?: number | null;
          ai_explanation?: Json | null;
        };
        Update: {
          id?: number;
          test_id?: number;
          content?: string;
          type?: string;
          options?: Json | null;
          correct_answer?: string | null;
          marks?: number;
          negative_marks?: number;
          explanation?: string | null;
          sort_order?: number;
          word_limit?: number | null;
          model_answer?: string | null;
          evaluation_criteria?: Json | null;
          section_id?: number | null;
          ai_explanation?: Json | null;
        };
      };
      test_attempts: {
        Row: {
          id: number;
          user_id: string;
          test_id: number;
          started_at: string;
          completed_at: string | null;
          score: number | null;
          total_marks: number | null;
          time_taken_seconds: number | null;
          status: string;
          attempt_number: number;
        };
        Insert: {
          id?: number;
          user_id: string;
          test_id: number;
          started_at?: string;
          completed_at?: string | null;
          score?: number | null;
          total_marks?: number | null;
          time_taken_seconds?: number | null;
          status?: string;
          attempt_number?: number;
        };
        Update: {
          id?: number;
          user_id?: string;
          test_id?: number;
          started_at?: string;
          completed_at?: string | null;
          score?: number | null;
          total_marks?: number | null;
          time_taken_seconds?: number | null;
          status?: string;
          attempt_number?: number;
        };
      };
      user_answers: {
        Row: {
          id: number;
          attempt_id: number;
          question_id: number;
          user_answer: string | null;
          is_correct: boolean | null;
          marks_obtained: number;
          answer_file_url: string | null;
          ai_feedback: Json | null;
          grading_status: string;
        };
        Insert: {
          id?: number;
          attempt_id: number;
          question_id: number;
          user_answer?: string | null;
          is_correct?: boolean | null;
          marks_obtained?: number;
          answer_file_url?: string | null;
          ai_feedback?: Json | null;
          grading_status?: string;
        };
        Update: {
          id?: number;
          attempt_id?: number;
          question_id?: number;
          user_answer?: string | null;
          is_correct?: boolean | null;
          marks_obtained?: number;
          answer_file_url?: string | null;
          ai_feedback?: Json | null;
          grading_status?: string;
        };
      };
      bookmarks: {
        Row: {
          id: number;
          user_id: string;
          question_id: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          question_id: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          question_id?: number;
          notes?: string | null;
          created_at?: string;
        };
      };
      rooms: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          category: string | null;
          category_id: number | null;
          is_active: boolean;
          created_at: string;
          privacy_level: "public" | "private" | "premium";
          owner_id: string | null;
          max_members: number;
          tags: string[];
          icon: string | null;
          color: string;
          max_tables: number;
          sort_order: number;
          created_by: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          category?: string | null;
          category_id?: number | null;
          is_active?: boolean;
          created_at?: string;
          privacy_level?: "public" | "private" | "premium";
          owner_id?: string | null;
          max_members?: number;
          tags?: string[];
          icon?: string | null;
          color?: string;
          max_tables?: number;
          sort_order?: number;
          created_by?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          category?: string | null;
          category_id?: number | null;
          is_active?: boolean;
          created_at?: string;
          privacy_level?: "public" | "private" | "premium";
          owner_id?: string | null;
          max_members?: number;
          tags?: string[];
          icon?: string | null;
          color?: string;
          max_tables?: number;
          sort_order?: number;
          created_by?: string | null;
        };
      };
      user_room_subscriptions: {
        Row: {
          id: number;
          user_id: string;
          room_id: number;
          joined_at: string;
          is_favorite: boolean;
          notification_level: "muted" | "normal" | "important";
          last_read_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          room_id: number;
          joined_at?: string;
          is_favorite?: boolean;
          notification_level?: "muted" | "normal" | "important";
          last_read_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          room_id?: number;
          joined_at?: string;
          is_favorite?: boolean;
          notification_level?: "muted" | "normal" | "important";
          last_read_at?: string;
        };
      };
      room_notifications: {
        Row: {
          id: number;
          user_id: string;
          room_id: number;
          type: "new_message" | "mention" | "room_update" | "member_joined";
          title: string;
          message: string | null;
          metadata: Json;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          room_id: number;
          type: "new_message" | "mention" | "room_update" | "member_joined";
          title: string;
          message?: string | null;
          metadata?: Json;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          room_id?: number;
          type?: "new_message" | "mention" | "room_update" | "member_joined";
          title?: string;
          message?: string | null;
          metadata?: Json;
          is_read?: boolean;
          created_at?: string;
        };
      };
      room_presence: {
        Row: {
          id: number;
          user_id: string;
          room_id: number;
          last_seen_at: string;
          status: "online" | "away" | "studying";
        };
        Insert: {
          id?: number;
          user_id: string;
          room_id: number;
          last_seen_at?: string;
          status?: "online" | "away" | "studying";
        };
        Update: {
          id?: number;
          user_id?: string;
          room_id?: number;
          last_seen_at?: string;
          status?: "online" | "away" | "studying";
        };
      };
      messages: {
        Row: {
          id: number;
          room_id: number;
          user_id: string;
          content: string | null;
          type: string;
          is_deleted: boolean;
          deleted_by: string | null;
          created_at: string;
          table_id: number | null;
          message_scope: "room" | "table";
          reply_to_id: number | null;
        };
        Insert: {
          id?: number;
          room_id: number;
          user_id: string;
          content?: string | null;
          type?: string;
          is_deleted?: boolean;
          deleted_by?: string | null;
          created_at?: string;
          table_id?: number | null;
          message_scope?: "room" | "table";
          reply_to_id?: number | null;
        };
        Update: {
          id?: number;
          room_id?: number;
          user_id?: string;
          content?: string | null;
          type?: string;
          is_deleted?: boolean;
          deleted_by?: string | null;
          created_at?: string;
          table_id?: number | null;
          message_scope?: "room" | "table";
          reply_to_id?: number | null;
        };
      };
      study_tables: {
        Row: {
          id: number;
          room_id: number;
          name: string;
          created_by: string | null;
          max_capacity: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          room_id: number;
          name: string;
          created_by?: string | null;
          max_capacity?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          room_id?: number;
          name?: string;
          created_by?: string | null;
          max_capacity?: number;
          created_at?: string;
        };
      };
      table_members: {
        Row: {
          id: number;
          table_id: number;
          user_id: string;
          joined_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: number;
          table_id: number;
          user_id: string;
          joined_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: number;
          table_id?: number;
          user_id?: string;
          joined_at?: string;
          last_seen_at?: string;
        };
      };
      room_bans: {
        Row: {
          id: number;
          room_id: number;
          user_id: string;
          banned_by: string | null;
          reason: string | null;
          banned_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: number;
          room_id: number;
          user_id: string;
          banned_by?: string | null;
          reason?: string | null;
          banned_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: number;
          room_id?: number;
          user_id?: string;
          banned_by?: string | null;
          reason?: string | null;
          banned_at?: string;
          expires_at?: string | null;
        };
      };
      payments: {
        Row: {
          id: number;
          user_id: string;
          cashfree_order_id: string | null;
          cashfree_payment_id: string | null;
          amount: number | null;
          currency: string;
          status: string | null;
          plan_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          cashfree_order_id?: string | null;
          cashfree_payment_id?: string | null;
          amount?: number | null;
          currency?: string;
          status?: string | null;
          plan_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          cashfree_order_id?: string | null;
          cashfree_payment_id?: string | null;
          amount?: number | null;
          currency?: string;
          status?: string | null;
          plan_type?: string | null;
          created_at?: string;
        };
      };
      test_sections: {
        Row: {
          id: number;
          test_id: number;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          test_id: number;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          test_id?: number;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      test_analytics: {
        Row: {
          id: number;
          user_id: string;
          test_id: number;
          total_attempts: number;
          best_score: number;
          average_score: number;
          last_attempt_at: string | null;
          strengths: Json;
          weaknesses: Json;
          improvement_trend: Json;
          section_performance: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          test_id: number;
          total_attempts?: number;
          best_score?: number;
          average_score?: number;
          last_attempt_at?: string | null;
          strengths?: Json;
          weaknesses?: Json;
          improvement_trend?: Json;
          section_performance?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          test_id?: number;
          total_attempts?: number;
          best_score?: number;
          average_score?: number;
          last_attempt_at?: string | null;
          strengths?: Json;
          weaknesses?: Json;
          improvement_trend?: Json;
          section_performance?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Gamification tables
      achievements: {
        Row: {
          id: number;
          slug: string;
          name: string;
          description: string;
          icon: string;
          category: "streak" | "study_time" | "tests" | "special";
          xp_reward: number;
          is_pro_only: boolean;
          requirement_value: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          slug: string;
          name: string;
          description: string;
          icon: string;
          category: "streak" | "study_time" | "tests" | "special";
          xp_reward?: number;
          is_pro_only?: boolean;
          requirement_value?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          name?: string;
          description?: string;
          icon?: string;
          category?: "streak" | "study_time" | "tests" | "special";
          xp_reward?: number;
          is_pro_only?: boolean;
          requirement_value?: number | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      user_achievements: {
        Row: {
          id: number;
          user_id: string;
          achievement_id: number;
          unlocked_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          achievement_id: number;
          unlocked_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          achievement_id?: number;
          unlocked_at?: string;
        };
      };
      profile_frames: {
        Row: {
          id: number;
          slug: string;
          name: string;
          preview_url: string | null;
          css_class: string;
          is_pro_only: boolean;
          unlock_condition: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          slug: string;
          name: string;
          preview_url?: string | null;
          css_class: string;
          is_pro_only?: boolean;
          unlock_condition?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          name?: string;
          preview_url?: string | null;
          css_class?: string;
          is_pro_only?: boolean;
          unlock_condition?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      study_goals: {
        Row: {
          id: number;
          user_id: string;
          goal_type: "weekly" | "monthly";
          target_minutes: number;
          start_date: string;
          end_date: string;
          progress_minutes: number;
          status: "active" | "completed" | "failed";
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          goal_type: "weekly" | "monthly";
          target_minutes: number;
          start_date: string;
          end_date: string;
          progress_minutes?: number;
          status?: "active" | "completed" | "failed";
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          goal_type?: "weekly" | "monthly";
          target_minutes?: number;
          start_date?: string;
          end_date?: string;
          progress_minutes?: number;
          status?: "active" | "completed" | "failed";
          created_at?: string;
        };
      };
      xp_transactions: {
        Row: {
          id: number;
          user_id: string;
          amount: number;
          reason: string;
          multiplier: number;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          amount: number;
          reason: string;
          multiplier?: number;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          amount?: number;
          reason?: string;
          multiplier?: number;
          reference_id?: string | null;
          created_at?: string;
        };
      };
      study_sessions: {
        Row: {
          id: number;
          user_id: string;
          room_id: number | null;
          duration_seconds: number;
          mode: "pomodoro" | "stopwatch" | "countdown";
          xp_earned: number;
          started_at: string;
          ended_at: string;
          notes: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          room_id?: number | null;
          duration_seconds: number;
          mode: "pomodoro" | "stopwatch" | "countdown";
          xp_earned?: number;
          started_at: string;
          ended_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          room_id?: number | null;
          duration_seconds?: number;
          mode?: "pomodoro" | "stopwatch" | "countdown";
          xp_earned?: number;
          started_at?: string;
          ended_at?: string;
          notes?: string | null;
        };
      };
      room_categories: {
        Row: {
          id: number;
          slug: string;
          label: string;
          icon: string;
          color: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          slug: string;
          label: string;
          icon?: string;
          color?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          label?: string;
          icon?: string;
          color?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      // =========================================================================
      // STUDY WITH AI MODULE TABLES
      // =========================================================================
      study_ai_goals: {
        Row: {
          id: number;
          user_id: string;
          goal_text: string;
          created_at: string;
          next_revision_at: string | null;
          revision_count: number;
          last_revised_at: string | null;
          leitner_box: number;
          is_archived: boolean;
        };
        Insert: {
          id?: number;
          user_id: string;
          goal_text: string;
          created_at?: string;
          next_revision_at?: string | null;
          revision_count?: number;
          last_revised_at?: string | null;
          leitner_box?: number;
          is_archived?: boolean;
        };
        Update: {
          id?: number;
          user_id?: string;
          goal_text?: string;
          created_at?: string;
          next_revision_at?: string | null;
          revision_count?: number;
          last_revised_at?: string | null;
          leitner_box?: number;
          is_archived?: boolean;
        };
      };
      study_uploads: {
        Row: {
          id: number;
          user_id: string;
          goal_id: number;
          upload_type: "pdf" | "image" | "youtube" | "anki";
          file_url: string | null;
          file_name: string | null;
          extracted_text: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          goal_id: number;
          upload_type: "pdf" | "image" | "youtube" | "anki";
          file_url?: string | null;
          file_name?: string | null;
          extracted_text?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          goal_id?: number;
          upload_type?: "pdf" | "image" | "youtube" | "anki";
          file_url?: string | null;
          file_name?: string | null;
          extracted_text?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      ai_generations: {
        Row: {
          id: number;
          user_id: string;
          goal_id: number;
          generation_type: "mindmap" | "summary" | "flashcards" | "quiz" | "infographic";
          output_data: Json;
          title: string | null;
          is_saved: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          goal_id: number;
          generation_type: "mindmap" | "summary" | "flashcards" | "quiz" | "infographic";
          output_data: Json;
          title?: string | null;
          is_saved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          goal_id?: number;
          generation_type?: "mindmap" | "summary" | "flashcards" | "quiz" | "infographic";
          output_data?: Json;
          title?: string | null;
          is_saved?: boolean;
          created_at?: string;
        };
      };
      revision_items: {
        Row: {
          id: number;
          user_id: string;
          generation_id: number;
          item_index: number;
          leitner_box: number;
          next_review_at: string | null;
          last_reviewed_at: string | null;
          review_count: number;
          item_type: "flashcard" | "quiz_question";
          front_content: string | null;
          back_content: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          user_id: string;
          generation_id: number;
          item_index: number;
          leitner_box?: number;
          next_review_at?: string | null;
          last_reviewed_at?: string | null;
          review_count?: number;
          item_type: "flashcard" | "quiz_question";
          front_content?: string | null;
          back_content?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          user_id?: string;
          generation_id?: number;
          item_index?: number;
          leitner_box?: number;
          next_review_at?: string | null;
          last_reviewed_at?: string | null;
          review_count?: number;
          item_type?: "flashcard" | "quiz_question";
          front_content?: string | null;
          back_content?: string | null;
          is_active?: boolean;
        };
      };
      blurt_sessions: {
        Row: {
          id: number;
          user_id: string;
          goal_id: number | null;
          topic: string | null;
          mode: "digital" | "paper";
          user_input: string | null;
          paper_image_url: string | null;
          ai_analysis: Json | null;
          score: number | null;
          xp_earned: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          goal_id?: number | null;
          topic?: string | null;
          mode: "digital" | "paper";
          user_input?: string | null;
          paper_image_url?: string | null;
          ai_analysis?: Json | null;
          score?: number | null;
          xp_earned?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          goal_id?: number | null;
          topic?: string | null;
          mode?: "digital" | "paper";
          user_input?: string | null;
          paper_image_url?: string | null;
          ai_analysis?: Json | null;
          score?: number | null;
          xp_earned?: number;
          created_at?: string;
        };
      };
      study_ai_notifications: {
        Row: {
          id: number;
          user_id: string;
          goal_id: number;
          type: "revision_due";
          title: string;
          message: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          goal_id: number;
          type: "revision_due";
          title: string;
          message?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          goal_id?: number;
          type?: "revision_due";
          title?: string;
          message?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
      };
      // =========================================================================
      // FEEDBACK SYSTEM TABLES
      // =========================================================================
      feedback_reports: {
        Row: {
          id: number;
          user_id: string;
          description: string;
          page_feature: string | null;
          steps_to_reproduce: string | null;
          when_started: "just_now" | "after_update" | "sometimes" | "always" | null;
          device_info: Json;
          screenshot_url: string | null;
          status: "new" | "in_progress" | "resolved" | "closed";
          is_verified_bug: boolean;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          description: string;
          page_feature?: string | null;
          steps_to_reproduce?: string | null;
          when_started?: "just_now" | "after_update" | "sometimes" | "always" | null;
          device_info?: Json;
          screenshot_url?: string | null;
          status?: "new" | "in_progress" | "resolved" | "closed";
          is_verified_bug?: boolean;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          description?: string;
          page_feature?: string | null;
          steps_to_reproduce?: string | null;
          when_started?: "just_now" | "after_update" | "sometimes" | "always" | null;
          device_info?: Json;
          screenshot_url?: string | null;
          status?: "new" | "in_progress" | "resolved" | "closed";
          is_verified_bug?: boolean;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      feedback_replies: {
        Row: {
          id: number;
          feedback_id: number;
          admin_id: string;
          message: string;
          is_internal: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          feedback_id: number;
          admin_id: string;
          message: string;
          is_internal?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          feedback_id?: number;
          admin_id?: string;
          message?: string;
          is_internal?: boolean;
          created_at?: string;
        };
      };
      user_notifications: {
        Row: {
          id: number;
          user_id: string;
          type: "feedback_reply" | "feedback_status" | "system";
          title: string;
          message: string | null;
          metadata: Json;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          type: "feedback_reply" | "feedback_status" | "system";
          title: string;
          message?: string | null;
          metadata?: Json;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          type?: "feedback_reply" | "feedback_status" | "system";
          title?: string;
          message?: string | null;
          metadata?: Json;
          is_read?: boolean;
          created_at?: string;
        };
      };
      // =========================================================================
      // AI EVALUATION QUEUE (for background processing of conventional answers)
      // =========================================================================
      ai_evaluation_tasks: {
        Row: {
          id: number;
          attempt_id: number;
          question_id: number;
          answer_id: number;
          task_type: "conventional" | "mcq_migration";
          status: "pending" | "processing" | "completed" | "failed";
          priority: number;
          retry_count: number;
          max_retries: number;
          error_message: string | null;
          created_at: string;
          updated_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: number;
          attempt_id: number;
          question_id: number;
          answer_id: number;
          task_type?: "conventional" | "mcq_migration";
          status?: "pending" | "processing" | "completed" | "failed";
          priority?: number;
          retry_count?: number;
          max_retries?: number;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: number;
          attempt_id?: number;
          question_id?: number;
          answer_id?: number;
          task_type?: "conventional" | "mcq_migration";
          status?: "pending" | "processing" | "completed" | "failed";
          priority?: number;
          retry_count?: number;
          max_retries?: number;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Commonly used types
export type Profile = Tables<"profiles">;
export type Test = Tables<"tests">;
export type Question = Tables<"questions">;
export type TestAttempt = Tables<"test_attempts">;
export type UserAnswer = Tables<"user_answers">;
export type Bookmark = Tables<"bookmarks">;
export type Room = Tables<"rooms">;
export type Message = Tables<"messages">;
export type ExamCategory = Tables<"exam_categories">;
export type DailyStudyLog = Tables<"daily_study_logs">;
export type Payment = Tables<"payments">;
export type UserRoomSubscription = Tables<"user_room_subscriptions">;
export type RoomNotification = Tables<"room_notifications">;
export type RoomPresence = Tables<"room_presence">;
export type StudyTable = Tables<"study_tables">;
export type TableMember = Tables<"table_members">;
export type RoomBan = Tables<"room_bans">;

// Question option type
export type QuestionOption = {
  id: string;
  text: string;
};

// Test section type
export type TestSection = Tables<"test_sections">;

// Test analytics type
export type TestAnalytics = Tables<"test_analytics">;

// Gamification types
export type Achievement = Tables<"achievements">;
export type UserAchievement = Tables<"user_achievements">;
export type ProfileFrame = Tables<"profile_frames">;
export type StudyGoal = Tables<"study_goals">;
export type XPTransaction = Tables<"xp_transactions">;
export type StudySession = Tables<"study_sessions">;
export type RoomCategory = Tables<"room_categories">;

// Achievement category type
export type AchievementCategory = "streak" | "study_time" | "tests" | "special";

// Study goal type
export type GoalType = "weekly" | "monthly";
export type GoalStatus = "active" | "completed" | "failed";

// Timer mode type
export type TimerMode = "pomodoro" | "stopwatch" | "countdown";

// AI Feedback types
export interface MCQFeedback {
  isCorrect: boolean;
  explanation: string;
  incorrectOptionsExplanation?: Record<string, string>; // Map of option ID to explanation of why it's wrong
  userChoiceExplanation?: string;
}

// MCQ Pregenerated Explanation (stored in questions.ai_explanation)
export interface MCQPregenExplanation {
  explanation: string;                    // Why correct answer is correct (4-6 sentences)
  incorrectOptionsExplanation: {          // Why each wrong option is wrong (2-3 sentences each)
    [optionId: string]: string;
  };
  generatedAt: string;                    // ISO timestamp of when this was generated
}

export interface SectionFeedback {
  section: string;
  positive: string;
  improve: string;
}

export interface ConventionalFeedback {
  extractedText: string;
  score: number;
  maxScore: number;
  wordCountEstimate: number;
  wordLimitStatus: "within" | "over" | "under";
  contentScore: number;
  structureScore: number;
  presentationScore: number;
  languageScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  sectionFeedback?: SectionFeedback[];
  modelConclusion?: string;
}

export type AIFeedback = MCQFeedback | ConventionalFeedback;

// Test type enum
export type TestType = "mcq" | "conventional" | "mixed";
export type TestDifficulty = "easy" | "moderate" | "hard" | "none";

// Analytics types
export interface ImprovementTrend {
  attempt: number;
  score: number;
  date: string;
}

export interface SectionPerformance {
  [sectionName: string]: number; // percentage score
}

// Study with AI types
export type StudyAIGoalRow = Tables<"study_ai_goals">;
export type StudyUploadRow = Tables<"study_uploads">;
export type AIGenerationRow = Tables<"ai_generations">;
export type RevisionItemRow = Tables<"revision_items">;
export type BlurtSessionRow = Tables<"blurt_sessions">;
export type StudyAINotificationRow = Tables<"study_ai_notifications">;

// Study AI enums
export type StudyAIUploadType = "pdf" | "image" | "youtube" | "anki";
export type StudyAIGenerationType = "mindmap" | "summary" | "flashcards" | "quiz" | "infographic";
export type BlurtMode = "digital" | "paper";
export type RevisionItemType = "flashcard" | "quiz_question";

// Feedback system types
export type FeedbackReport = Tables<"feedback_reports">;
export type FeedbackReply = Tables<"feedback_replies">;
export type UserNotification = Tables<"user_notifications">;
export type FeedbackStatus = "new" | "in_progress" | "resolved" | "closed";
export type FeedbackWhenStarted = "just_now" | "after_update" | "sometimes" | "always";
export type NotificationType = "feedback_reply" | "feedback_status" | "system";

// AI Evaluation Queue types
export type AIEvaluationTask = Tables<"ai_evaluation_tasks">;
export type AIEvaluationTaskStatus = "pending" | "processing" | "completed" | "failed";
export type AIEvaluationTaskType = "conventional" | "mcq_migration";
