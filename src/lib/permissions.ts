// Available permissions in the system
export const PERMISSIONS = {
  // Question management
  UPLOAD_QUESTIONS: "upload_questions",
  EDIT_QUESTIONS: "edit_questions",
  DELETE_QUESTIONS: "delete_questions",

  // Test management
  CREATE_TESTS: "create_tests",
  EDIT_TESTS: "edit_tests",
  DELETE_TESTS: "delete_tests",

  // Study hall/room management
  CREATE_ROOMS: "create_rooms",
  EDIT_ROOMS: "edit_rooms",
  DELETE_ROOMS: "delete_rooms",

  // Chat moderation
  MODERATE_CHAT: "moderate_chat",
  DELETE_MESSAGES: "delete_messages",
  BAN_USERS: "ban_users",

  // User management (limited)
  VIEW_USERS: "view_users",

  // Analytics
  VIEW_ANALYTICS: "view_analytics",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Permission categories for UI grouping
export const PERMISSION_CATEGORIES = [
  {
    name: "Questions",
    description: "Manage test questions",
    permissions: [
      {
        key: PERMISSIONS.UPLOAD_QUESTIONS,
        label: "Upload Questions",
        description: "Add new questions to tests",
      },
      {
        key: PERMISSIONS.EDIT_QUESTIONS,
        label: "Edit Questions",
        description: "Modify existing questions",
      },
      {
        key: PERMISSIONS.DELETE_QUESTIONS,
        label: "Delete Questions",
        description: "Remove questions from tests",
      },
    ],
  },
  {
    name: "Tests",
    description: "Manage tests and exams",
    permissions: [
      {
        key: PERMISSIONS.CREATE_TESTS,
        label: "Create Tests",
        description: "Create new tests and exams",
      },
      {
        key: PERMISSIONS.EDIT_TESTS,
        label: "Edit Tests",
        description: "Modify test details and settings",
      },
      {
        key: PERMISSIONS.DELETE_TESTS,
        label: "Delete Tests",
        description: "Remove tests from the system",
      },
    ],
  },
  {
    name: "Study Halls",
    description: "Manage study rooms",
    permissions: [
      {
        key: PERMISSIONS.CREATE_ROOMS,
        label: "Create Rooms",
        description: "Create new study halls",
      },
      {
        key: PERMISSIONS.EDIT_ROOMS,
        label: "Edit Rooms",
        description: "Modify room settings",
      },
      {
        key: PERMISSIONS.DELETE_ROOMS,
        label: "Delete Rooms",
        description: "Remove study halls",
      },
    ],
  },
  {
    name: "Moderation",
    description: "Chat and user moderation",
    permissions: [
      {
        key: PERMISSIONS.MODERATE_CHAT,
        label: "Moderate Chat",
        description: "View and manage chat messages",
      },
      {
        key: PERMISSIONS.DELETE_MESSAGES,
        label: "Delete Messages",
        description: "Remove inappropriate messages",
      },
      {
        key: PERMISSIONS.BAN_USERS,
        label: "Ban Users",
        description: "Temporarily ban users from chat",
      },
    ],
  },
  {
    name: "Other",
    description: "Additional permissions",
    permissions: [
      {
        key: PERMISSIONS.VIEW_USERS,
        label: "View Users",
        description: "See user list and profiles",
      },
      {
        key: PERMISSIONS.VIEW_ANALYTICS,
        label: "View Analytics",
        description: "Access analytics dashboard",
      },
    ],
  },
];

// Preset permission bundles for quick assignment
export const PERMISSION_PRESETS = [
  {
    name: "Content Creator",
    description: "Can create and manage questions and tests",
    permissions: [
      PERMISSIONS.UPLOAD_QUESTIONS,
      PERMISSIONS.EDIT_QUESTIONS,
      PERMISSIONS.CREATE_TESTS,
      PERMISSIONS.EDIT_TESTS,
    ],
  },
  {
    name: "Moderator",
    description: "Can moderate chat and manage study halls",
    permissions: [
      PERMISSIONS.MODERATE_CHAT,
      PERMISSIONS.DELETE_MESSAGES,
      PERMISSIONS.CREATE_ROOMS,
      PERMISSIONS.EDIT_ROOMS,
    ],
  },
  {
    name: "Full Teacher",
    description: "All teacher permissions except user management",
    permissions: [
      PERMISSIONS.UPLOAD_QUESTIONS,
      PERMISSIONS.EDIT_QUESTIONS,
      PERMISSIONS.DELETE_QUESTIONS,
      PERMISSIONS.CREATE_TESTS,
      PERMISSIONS.EDIT_TESTS,
      PERMISSIONS.DELETE_TESTS,
      PERMISSIONS.CREATE_ROOMS,
      PERMISSIONS.EDIT_ROOMS,
      PERMISSIONS.MODERATE_CHAT,
      PERMISSIONS.DELETE_MESSAGES,
      PERMISSIONS.VIEW_ANALYTICS,
    ],
  },
];
