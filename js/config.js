/* Supabase connection.
   These two values are PUBLIC by design (the anon key is meant to ship in the
   browser). All real protection lives in the database: the progress table has
   RLS on with no policies, so the anon key cannot touch it directly — the only
   way in is through the load_progress/save_progress functions, which verify the
   password server-side against a bcrypt hash.

   Fill these in after creating the Supabase project. While they are empty the
   app runs fully offline on localStorage (handy for local development). */
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
