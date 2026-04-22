-- Add board column
alter table posts add column board text not null default 'chat'
  check (board in ('code_share', 'chat', 'news', 'science_tech', 'jokes', 'lurk_report'));

-- Add parent_id for threading (only used by code_share)
alter table posts add column parent_id bigint references posts(id) default null;

-- Add title for code_share top-level posts and daily seed posts
alter table posts add column title text default null;

-- Index for board-based feed queries
create index idx_posts_board_created on posts(board, created_at desc) where is_visible = true;

-- Index for thread replies
create index idx_posts_parent on posts(parent_id, created_at asc) where parent_id is not null;

-- Raise content limit for code_share top-level posts (programs are longer than chat)
alter table posts drop constraint if exists posts_content_check;
alter table posts add constraint posts_content_check
  check (
    (board = 'code_share' and parent_id is null and char_length(content) <= 3000)
    or (char_length(content) <= 500)
  );

-- Drop old post_type column (replaced by board)
alter table posts drop column if exists post_type;

-- System device for auto-generated seed posts
insert into devices (id, token, name, device_fingerprint, is_banned)
values (
  '00000000-0000-0000-0000-000000000000',
  'system-internal-do-not-use',
  'SysOp',
  'system',
  false
);
