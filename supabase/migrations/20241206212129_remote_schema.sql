

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."current_user_tier"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$-- SQL code with fully qualified schema references
  SELECT user_tier
  FROM public.user_profiles
  WHERE id = auth.uid();$$;


ALTER FUNCTION "public"."current_user_tier"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_unique_char_id"("site_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    base_id TEXT;
    new_id TEXT;
    suffix INTEGER := 1;
BEGIN
    -- Generate base char_id: first four letters, uppercase, no spaces
    base_id := UPPER(REGEXP_REPLACE(SUBSTRING(site_name FROM 1 FOR 4), '\s+', '', 'g'));
    new_id := base_id;
    
    -- Loop to find a unique char_id
    WHILE EXISTS (SELECT 1 FROM sample_locations WHERE char_id = new_id) LOOP
        new_id := base_id || suffix::TEXT;
        suffix := suffix + 1;
    END LOOP;
    
    RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."generate_unique_char_id"("site_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = NEW.version + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."file_nodes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "parent_id" "text",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1 NOT NULL,
    "sample_group_id" "uuid",
    "children" "text"[],
    "droppable" boolean,
    CONSTRAINT "file_nodes_type_check" CHECK (("type" = ANY (ARRAY['folder'::"text", 'file'::"text", 'sampleGroup'::"text"])))
);


ALTER TABLE "public"."file_nodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."license_keys" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "key" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."license_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."license_keys" IS 'Activation keys for first signup';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_short_id" "text" DEFAULT 'ZZZZ'::"text" NOT NULL,
    CONSTRAINT "organizations_org_short_id_check" CHECK (("length"("org_short_id") = 4))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS 'Organizations';



CREATE TABLE IF NOT EXISTS "public"."processed_data" (
    "key" "text" NOT NULL,
    "config_id" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "raw_file_paths" "text"[] NOT NULL,
    "processed_path" "text",
    "timestamp" bigint NOT NULL,
    "status" "text" NOT NULL,
    "metadata" "jsonb",
    "sample_id" "uuid",
    "human_readable_sample_id" "text",
    "org_short_id" "text",
    "org_id" "uuid",
    "id" "text" NOT NULL,
    "process_function_name" "text",
    "processed_file_paths" "text"[]
);


ALTER TABLE "public"."processed_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sample_group_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_id" "uuid",
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "human_readable_sample_id" "text" NOT NULL,
    "collection_date" "date",
    "storage_folder" "text",
    "collection_datetime_utc" timestamp with time zone,
    "loc_id" "uuid",
    "latitude_recorded" numeric,
    "longitude_recorded" numeric,
    "notes" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."sample_group_metadata" OWNER TO "postgres";


COMMENT ON TABLE "public"."sample_group_metadata" IS 'Supersample metadata';



COMMENT ON COLUMN "public"."sample_group_metadata"."latitude_recorded" IS 'Latitude recorded on data sheet during actual sampling';



COMMENT ON COLUMN "public"."sample_group_metadata"."longitude_recorded" IS 'Longitude recorded during actual sampling';



COMMENT ON COLUMN "public"."sample_group_metadata"."notes" IS 'Notes input from researchers';



CREATE TABLE IF NOT EXISTS "public"."sample_locations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "label" "text" NOT NULL,
    "lat" numeric(9,6),
    "long" numeric(9,6),
    "is_enabled" boolean NOT NULL,
    "char_id" "text" NOT NULL
);


ALTER TABLE "public"."sample_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."sample_locations" IS 'Possible sampling sites';



CREATE TABLE IF NOT EXISTS "public"."sample_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_id" "uuid",
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "human_readable_sample_id" "text" NOT NULL,
    "file_name" "text",
    "file_type" "text",
    "data_type" "text",
    "lat" double precision,
    "long" double precision,
    "status" "text",
    "processed_storage_path" "text",
    "processed_datetime_utc" timestamp with time zone,
    "upload_datetime_utc" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "process_function_name" "text",
    "sample_group_id" "uuid",
    "raw_storage_paths" "text"[],
    "updated_at" timestamp without time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    CONSTRAINT "sample_metadata_file_type_check" CHECK (("file_type" = ANY (ARRAY['text/plain'::"text", 'application/pdf'::"text", 'image/png'::"text", 'application/json'::"text"])))
);


ALTER TABLE "public"."sample_metadata" OWNER TO "postgres";


COMMENT ON TABLE "public"."sample_metadata" IS 'Sample metadata';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "user_tier" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'Profiles for individuals';



CREATE TABLE IF NOT EXISTS "public"."user_tiers" (
    "name" "text" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."user_tiers" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_tiers" IS 'Possible user tiers';



ALTER TABLE ONLY "public"."file_nodes"
    ADD CONSTRAINT "file_nodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_keys"
    ADD CONSTRAINT "license_keys_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."license_keys"
    ADD CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_org_short_id_key" UNIQUE ("org_short_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_data"
    ADD CONSTRAINT "processed_data_pkey" PRIMARY KEY ("key", "id");



ALTER TABLE ONLY "public"."sample_locations"
    ADD CONSTRAINT "sample_locations_char_id_key" UNIQUE ("char_id");



ALTER TABLE ONLY "public"."sample_locations"
    ADD CONSTRAINT "sample_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sample_metadata"
    ADD CONSTRAINT "sample_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sample_group_metadata"
    ADD CONSTRAINT "sampling_event_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sample_group_metadata"
    ADD CONSTRAINT "sampling_event_metadata_sample_id_key" UNIQUE ("human_readable_sample_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tiers"
    ADD CONSTRAINT "user_tiers_pkey" PRIMARY KEY ("name", "id");



CREATE INDEX "idx_file_nodes_org_id" ON "public"."file_nodes" USING "btree" ("org_id");



CREATE INDEX "idx_file_nodes_parent_id" ON "public"."file_nodes" USING "btree" ("parent_id");



CREATE INDEX "idx_file_nodes_type" ON "public"."file_nodes" USING "btree" ("type");



CREATE INDEX "idx_processed_data_status" ON "public"."processed_data" USING "btree" ("status");



CREATE INDEX "idx_processed_data_timestamp" ON "public"."processed_data" USING "btree" ("timestamp");



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."file_nodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."file_nodes"
    ADD CONSTRAINT "file_nodes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_nodes"
    ADD CONSTRAINT "file_nodes_sample_group_id_fkey" FOREIGN KEY ("sample_group_id") REFERENCES "public"."sample_group_metadata"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."license_keys"
    ADD CONSTRAINT "license_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."processed_data"
    ADD CONSTRAINT "processed_data_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."sample_group_metadata"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sample_metadata"
    ADD CONSTRAINT "sample_metadata_human_readable_sample_id_fkey" FOREIGN KEY ("human_readable_sample_id") REFERENCES "public"."sample_group_metadata"("human_readable_sample_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sample_metadata"
    ADD CONSTRAINT "sample_metadata_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."sample_metadata"
    ADD CONSTRAINT "sample_metadata_sample_group_id_fkey" FOREIGN KEY ("sample_group_id") REFERENCES "public"."sample_group_metadata"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sample_metadata"
    ADD CONSTRAINT "sample_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."sample_group_metadata"
    ADD CONSTRAINT "sampling_event_metadata_loc_id_fkey" FOREIGN KEY ("loc_id") REFERENCES "public"."sample_locations"("id");



ALTER TABLE ONLY "public"."sample_group_metadata"
    ADD CONSTRAINT "sampling_event_metadata_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."sample_group_metadata"
    ADD CONSTRAINT "sampling_event_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



CREATE POLICY "Allow DELETE for authenticated users" ON "public"."file_nodes" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow INSERT for authenticated users" ON "public"."file_nodes" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow SELECT for authenticated users" ON "public"."file_nodes" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow UPDATE for authenticated users" ON "public"."file_nodes" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow org members to update their sample_group_metadata" ON "public"."sample_group_metadata" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."organization_id" = "sample_group_metadata"."org_id")))))) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."organization_id" = "sample_group_metadata"."org_id"))))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."sample_group_metadata" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."sample_metadata" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."license_keys" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."organizations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."sample_group_metadata" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."sample_metadata" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."user_tiers" FOR SELECT USING (true);



CREATE POLICY "Enable select for authenticated users only" ON "public"."sample_locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Super admins can manage organizations" ON "public"."organizations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE ((( SELECT "auth"."uid"() AS "uid") = "user_profiles"."id") AND ("user_profiles"."organization_id" = "organizations"."id") AND ("user_profiles"."user_tier" = 'admin'::"text")))));



CREATE POLICY "Update own sample_metadata" ON "public"."sample_metadata" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own profiles" ON "public"."user_profiles" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "allow_all_authenticated_users" ON "public"."processed_data" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "delete_if_lead_or_admin" ON "public"."sample_group_metadata" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = "auth"."uid"()) AND ("up"."organization_id" = "sample_group_metadata"."org_id")))));



CREATE POLICY "delete_if_lead_or_admin" ON "public"."sample_metadata" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = "auth"."uid"()) AND ("up"."organization_id" = "sample_metadata"."org_id") AND ("up"."user_tier" = ANY (ARRAY['lead'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."file_nodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."license_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sample_group_metadata" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sample_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sample_metadata" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tiers" ENABLE ROW LEVEL SECURITY;


CREATE PUBLICATION "powersync" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "powersync" OWNER TO "postgres";




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."file_nodes";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."license_keys";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."organizations";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."processed_data";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."sample_group_metadata";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."sample_locations";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."sample_metadata";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."user_profiles";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."user_tiers";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."current_user_tier"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_tier"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_tier"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_unique_char_id"("site_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_unique_char_id"("site_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_unique_char_id"("site_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."file_nodes" TO "anon";
GRANT ALL ON TABLE "public"."file_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."file_nodes" TO "service_role";



GRANT ALL ON TABLE "public"."license_keys" TO "anon";
GRANT ALL ON TABLE "public"."license_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."license_keys" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."processed_data" TO "anon";
GRANT ALL ON TABLE "public"."processed_data" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_data" TO "service_role";



GRANT ALL ON TABLE "public"."sample_group_metadata" TO "anon";
GRANT ALL ON TABLE "public"."sample_group_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."sample_group_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."sample_locations" TO "anon";
GRANT ALL ON TABLE "public"."sample_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."sample_locations" TO "service_role";



GRANT ALL ON TABLE "public"."sample_metadata" TO "anon";
GRANT ALL ON TABLE "public"."sample_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."sample_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_tiers" TO "anon";
GRANT ALL ON TABLE "public"."user_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tiers" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
