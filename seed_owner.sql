insert into bot_admins (chat_id)
values ('8708850161')
on conflict (chat_id) do nothing;

select chat_id from bot_admins;
