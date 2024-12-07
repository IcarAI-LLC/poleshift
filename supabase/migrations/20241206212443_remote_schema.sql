drop policy "Enable read access for all users" on "public"."organizations";

create policy "Enable read access for all users"
on "public"."organizations"
as permissive
for select
to anon, authenticated
using (true);



