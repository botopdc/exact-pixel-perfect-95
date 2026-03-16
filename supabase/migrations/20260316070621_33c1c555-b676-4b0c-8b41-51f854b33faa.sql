
-- Remove Pedro Gerente (legacy_user_id=5) to free it for Leandro
DELETE FROM public.role_audit_logs WHERE user_id = '1746ed05-740c-4583-b21b-bec09b683f3d';
DELETE FROM public.user_roles WHERE user_id = '1746ed05-740c-4583-b21b-bec09b683f3d';
DELETE FROM public.profiles WHERE id = '1746ed05-740c-4583-b21b-bec09b683f3d';
