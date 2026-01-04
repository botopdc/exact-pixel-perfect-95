CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



SET default_table_access_method = heap;

--
-- Name: proposal_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id text NOT NULL,
    client_email text,
    source text DEFAULT 'link'::text NOT NULL,
    ip_address text,
    user_agent text,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: proposal_views proposal_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_views
    ADD CONSTRAINT proposal_views_pkey PRIMARY KEY (id);


--
-- Name: idx_proposal_views_proposal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_views_proposal_id ON public.proposal_views USING btree (proposal_id);


--
-- Name: proposal_views Deny public inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny public inserts" ON public.proposal_views FOR INSERT WITH CHECK (false);


--
-- Name: proposal_views Deny public reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny public reads" ON public.proposal_views FOR SELECT USING (false);


--
-- Name: proposal_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_views ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;