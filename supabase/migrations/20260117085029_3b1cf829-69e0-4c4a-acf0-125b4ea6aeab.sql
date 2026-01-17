-- 1) Garantir que RLS está ativo
ALTER TABLE public.tech_users ENABLE ROW LEVEL SECURITY;

-- 2) Remover a policy atual de bootstrap
DROP POLICY IF EXISTS tech_users_insert_bootstrap ON public.tech_users;

-- 3) Criar nova policy de bootstrap SEM FUNÇÃO helper
CREATE POLICY tech_users_insert_bootstrap
ON public.tech_users
FOR INSERT
TO authenticated
WITH CHECK (
  (
    (SELECT COUNT(*) FROM public.tech_users) = 0
  )
  OR
  (
    auth.uid() IN (
      SELECT id
      FROM public.tech_users
      WHERE role = 'ADMIN'
    )
  )
);

-- 4) Garantir UPDATE/DELETE somente ADMIN
DROP POLICY IF EXISTS tech_users_update_admin ON public.tech_users;
CREATE POLICY tech_users_update_admin
ON public.tech_users
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.tech_users WHERE role = 'ADMIN'
  )
);

DROP POLICY IF EXISTS tech_users_delete_admin ON public.tech_users;
CREATE POLICY tech_users_delete_admin
ON public.tech_users
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.tech_users WHERE role = 'ADMIN'
  )
);