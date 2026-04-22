-- Must drop and recreate — can't remove columns with CREATE OR REPLACE
drop view if exists posts_with_author;

create view posts_with_author as
select
  p.id,
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

grant select on posts_with_author to anon;
