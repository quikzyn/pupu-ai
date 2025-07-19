-- Create the user_api_keys table
CREATE TABLE public.user_api_keys (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    openai_key text,
    gemini_key text,
    xai_key text,
    search_key text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS) on the table
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for SELECT (read access)
CREATE POLICY "Users can view their own API keys." ON public.user_api_keys
FOR SELECT USING (auth.uid() = user_id);

-- Create RLS policy for INSERT (create access)
CREATE POLICY "Users can insert their own API keys." ON public.user_api_keys
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policy for UPDATE (modify access)
CREATE POLICY "Users can update their own API keys." ON public.user_api_keys
FOR UPDATE USING (auth.uid() = user_id);

-- Optional: Create a function to update 'updated_at' timestamp automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Optional: Create a trigger to call the update_updated_at_column function on UPDATE
CREATE TRIGGER update_user_api_keys_updated_at
BEFORE UPDATE ON public.user_api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions to the authenticated role
GRANT ALL ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;
