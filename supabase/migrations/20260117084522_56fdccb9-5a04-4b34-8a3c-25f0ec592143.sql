-- Corrigir policies permissivas da tabela articles
DROP POLICY IF EXISTS "Anyone can create articles" ON public.articles;
DROP POLICY IF EXISTS "Anyone can delete articles" ON public.articles;
DROP POLICY IF EXISTS "Anyone can update articles" ON public.articles;
DROP POLICY IF EXISTS "Anyone can view articles" ON public.articles;

-- Criar policies seguras para articles (apenas authenticated pode CRUD)
CREATE POLICY "articles_select_authenticated"
ON public.articles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "articles_insert_authenticated"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "articles_update_authenticated"
ON public.articles
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "articles_delete_authenticated"
ON public.articles
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);