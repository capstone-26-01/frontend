import type { RepoGraphNode, RepoGraphEdge } from '@/lib/api';

/**
 * Home "Live Preview" sample graph.
 *
 * Shaped exactly like a real `/api/graph/` response (RepoGraphNode / RepoGraphEdge)
 * so the landing-page preview renders through the same GraphFlow code path as the
 * graph you get after entering a repo — same node styles, File/Class/Func view
 * toggle, legend, and layout. Models a small Express-style API server.
 */
export const SAMPLE_NODES: RepoGraphNode[] = [
  // ── Directories ──
  { id: 'src',                       label: 'src',             kind: 'directory', methods: [] },
  { id: 'src/routes',                label: 'routes',          kind: 'directory', methods: [] },
  { id: 'src/services',              label: 'services',        kind: 'directory', methods: [] },
  { id: 'src/models',                label: 'models',          kind: 'directory', methods: [] },

  // ── Files (modules) ──
  { id: 'src/app.ts',                label: 'app.ts',          kind: 'module', methods: [] },
  { id: 'src/routes/user.ts',        label: 'user.ts',         kind: 'module', methods: [] },
  { id: 'src/routes/auth.ts',        label: 'auth.ts',         kind: 'module', methods: [] },
  { id: 'src/services/userService.ts', label: 'userService.ts', kind: 'module', methods: [] },
  { id: 'src/services/authService.ts', label: 'authService.ts', kind: 'module', methods: [] },
  { id: 'src/models/User.ts',        label: 'User.ts',         kind: 'module', methods: [] },
  { id: 'src/models/Base.ts',        label: 'Base.ts',         kind: 'module', methods: [] },

  // ── Code symbols ──
  {
    id: 'src/models/Base.ts::BaseModel', label: 'BaseModel', kind: 'abstract',
    properties: ['id: string', 'createdAt: Date'],
    methods: ['save(): Promise<void>', 'validate(): boolean'],
  },
  {
    id: 'src/models/User.ts::User', label: 'User', kind: 'class',
    properties: ['email: string', 'name: string'],
    methods: ['hashPassword(): void', 'toJSON(): object'],
  },
  {
    id: 'src/services/userService.ts::UserService', label: 'UserService', kind: 'class',
    methods: ['findById(id): User', 'create(dto): User'],
  },
  {
    id: 'src/services/authService.ts::AuthService', label: 'AuthService', kind: 'class',
    methods: ['login(creds): Token', 'verify(token): User'],
  },
  {
    id: 'src/routes/user.ts::createUserRouter', label: 'createUserRouter', kind: 'function',
    methods: [],
  },
  {
    id: 'src/routes/auth.ts::createAuthRouter', label: 'createAuthRouter', kind: 'function',
    methods: [],
  },
  {
    id: 'src/app.ts::bootstrap', label: 'bootstrap', kind: 'function',
    methods: [],
  },
];

export const SAMPLE_EDGES: RepoGraphEdge[] = [
  // ── contains (file tree) ──
  { source: 'src', target: 'src/routes',   kind: 'contains' },
  { source: 'src', target: 'src/services', kind: 'contains' },
  { source: 'src', target: 'src/models',   kind: 'contains' },
  { source: 'src', target: 'src/app.ts',   kind: 'contains' },

  { source: 'src/routes',   target: 'src/routes/user.ts',          kind: 'contains' },
  { source: 'src/routes',   target: 'src/routes/auth.ts',          kind: 'contains' },
  { source: 'src/services', target: 'src/services/userService.ts', kind: 'contains' },
  { source: 'src/services', target: 'src/services/authService.ts', kind: 'contains' },
  { source: 'src/models',   target: 'src/models/User.ts',          kind: 'contains' },
  { source: 'src/models',   target: 'src/models/Base.ts',          kind: 'contains' },

  { source: 'src/app.ts',                  target: 'src/app.ts::bootstrap',                kind: 'contains' },
  { source: 'src/routes/user.ts',          target: 'src/routes/user.ts::createUserRouter', kind: 'contains' },
  { source: 'src/routes/auth.ts',          target: 'src/routes/auth.ts::createAuthRouter', kind: 'contains' },
  { source: 'src/services/userService.ts', target: 'src/services/userService.ts::UserService', kind: 'contains' },
  { source: 'src/services/authService.ts', target: 'src/services/authService.ts::AuthService', kind: 'contains' },
  { source: 'src/models/User.ts',          target: 'src/models/User.ts::User',             kind: 'contains' },
  { source: 'src/models/Base.ts',          target: 'src/models/Base.ts::BaseModel',        kind: 'contains' },

  // ── inherits ──
  { source: 'src/models/Base.ts::BaseModel', target: 'src/models/User.ts::User', kind: 'inherits' },

  // ── imports ──
  { source: 'src/services/userService.ts', target: 'src/models/User.ts',          kind: 'imports' },
  { source: 'src/services/authService.ts', target: 'src/models/User.ts',          kind: 'imports' },
  { source: 'src/routes/user.ts',          target: 'src/services/userService.ts', kind: 'imports' },
  { source: 'src/routes/auth.ts',          target: 'src/services/authService.ts', kind: 'imports' },
  { source: 'src/app.ts',                  target: 'src/routes/user.ts',          kind: 'imports' },
  { source: 'src/app.ts',                  target: 'src/routes/auth.ts',          kind: 'imports' },

  // ── calls ──
  { source: 'src/app.ts::bootstrap',                target: 'src/routes/user.ts::createUserRouter', kind: 'calls' },
  { source: 'src/app.ts::bootstrap',                target: 'src/routes/auth.ts::createAuthRouter', kind: 'calls' },
  { source: 'src/routes/user.ts::createUserRouter', target: 'src/services/userService.ts::UserService', kind: 'calls' },
  { source: 'src/routes/auth.ts::createAuthRouter', target: 'src/services/authService.ts::AuthService', kind: 'calls' },

  // ── entrypoint ──
  { source: 'src/app.ts', target: 'src/app.ts::bootstrap', kind: 'entrypoint' },
];
