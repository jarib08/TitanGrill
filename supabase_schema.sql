-- Create the clients table
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  phone text not null,
  email text,
  stamps_count int default 0,
  unique(phone)
);

-- Init RLS (Row Level Security) - Optional but recommended
alter table public.clients enable row level security;

-- Create policy to allow public insert (for the popup)
create policy "Enable insert for everyone" on public.clients for insert with check (true);

-- Create policy to allow public select (for the scanner - in a real app, this should be authenticated)
create policy "Enable read access for all users" on public.clients for select using (true);

-- Create policy to allow update (for the admin scanner)
create policy "Enable update for all users" on public.clients for update using (true);
