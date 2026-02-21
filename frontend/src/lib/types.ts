export type RoleCode = "ADMIN" | "MANAGER" | "USER";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Me {
  id: number;
  username: string;
  email: string;
  role: RoleCode;
  is_locked: boolean;
  created_at: string;
}

export interface Board {
  id: number;
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
  read_roles: RoleCode[];
  write_roles: RoleCode[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: number;
  name: string;
  path: string;
  icon: string | null;
  parent_id: number | null;
  board_id: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostListItem {
  id: number;
  board_id: number;
  title: string;
  author_id: number;
  author_name: string;
  is_pinned: boolean;
  is_deleted: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  qna_status: string | null;
  created_at: string;
}

export interface AttachmentMeta {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface PostDetail {
  id: number;
  board_id: number;
  title: string;
  content: string;
  author_id: number;
  author_name: string;
  is_pinned: boolean;
  is_deleted: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  qna_status: string | null;
  created_at: string;
  updated_at: string;
  attachments: AttachmentMeta[];
}

export interface PostListResponse {
  items: PostListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CommentItem {
  id: number;
  post_id: number;
  author_id: number;
  author_name: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserItem {
  id: number;
  username: string;
  email: string;
  role: RoleCode;
  is_locked: boolean;
  is_active: boolean;
  created_at: string;
}

export interface UserListResponse {
  items: UserItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface RoleMatrixRole {
  role_code: RoleCode;
  role_name: string;
  system_permissions: string[];
}

export interface RoleMatrixBoard {
  board_id: number;
  board_key: string;
  board_name: string;
  read_roles: RoleCode[];
  write_roles: RoleCode[];
}

export interface RoleMatrixMenu {
  menu_id: number;
  menu_name: string;
  menu_path: string;
  parent_id: number | null;
  category_name: string | null;
  board_id: number | null;
  read_roles: RoleCode[];
  write_roles: RoleCode[];
}

export interface RoleMatrixResponse {
  roles: RoleMatrixRole[];
  menus: RoleMatrixMenu[];
  boards: RoleMatrixBoard[];
}
