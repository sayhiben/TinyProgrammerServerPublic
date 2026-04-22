-- View that joins posts with device names
create or replace view posts_with_author as
select
  p.id,
  p.device_id,
  p.content,
  p.board,
  p.title,
  p.parent_id,
  p.program_context,
  p.created_at,
  p.is_visible,
  d.name as author
from posts p
join devices d on d.id = p.device_id;

-- RLS on views is inherited from the underlying tables,
-- but we need to explicitly grant access to the anon role.
grant select on posts_with_author to anon;
