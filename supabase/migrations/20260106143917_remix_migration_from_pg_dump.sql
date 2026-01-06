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



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    visibility text DEFAULT 'private'::text NOT NULL,
    author text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    views_count integer DEFAULT 0 NOT NULL,
    helpful_yes integer DEFAULT 0 NOT NULL,
    helpful_no integer DEFAULT 0 NOT NULL,
    reading_time_minutes integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT articles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))),
    CONSTRAINT articles_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'internal'::text])))
);


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
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: proposal_views proposal_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_views
    ADD CONSTRAINT proposal_views_pkey PRIMARY KEY (id);


--
-- Name: idx_articles_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_category ON public.articles USING btree (category);


--
-- Name: idx_articles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_created_at ON public.articles USING btree (created_at DESC);


--
-- Name: idx_articles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_status ON public.articles USING btree (status);


--
-- Name: idx_proposal_views_proposal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_views_proposal_id ON public.proposal_views USING btree (proposal_id);


--
-- Name: articles update_articles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: articles Anyone can create articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create articles" ON public.articles FOR INSERT WITH CHECK (true);


--
-- Name: articles Anyone can delete articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete articles" ON public.articles FOR DELETE USING (true);


--
-- Name: articles Anyone can update articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update articles" ON public.articles FOR UPDATE USING (true);


--
-- Name: articles Anyone can view articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view articles" ON public.articles FOR SELECT USING (true);


--
-- Name: proposal_views Deny public inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny public inserts" ON public.proposal_views FOR INSERT WITH CHECK (false);


--
-- Name: proposal_views Deny public reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny public reads" ON public.proposal_views FOR SELECT USING (false);


--
-- Name: articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_views ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;